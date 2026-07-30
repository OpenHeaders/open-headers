// Protocol-faithful fake HTTP/3 helper — speaks the framed stdio
// protocol (docs/REQUEST_ENGINE_H3_PROTOCOL.md) over real child-process
// stdio so the client/hop/transport suites exercise spawn, HELLO
// gating, multiplexing, cancel, and crash against the actual wire
// shape. Behaviors key off the request URL's path; session-level knobs
// ride env vars (FAKE_H3_PROTOCOL overrides the HELLO protocol int,
// FAKE_H3_SILENT=1 suppresses HELLO entirely).

import { existsSync, writeFileSync } from 'node:fs';
import process from 'node:process';

const HEADER_BYTES = 9;
const FRAME = {
  HELLO: 0x01,
  REQUEST: 0x10,
  REQUEST_BODY: 0x11,
  REQUEST_END: 0x12,
  CANCEL: 0x1f,
  RESPONSE_HEAD: 0x20,
  RESPONSE_BODY: 0x21,
  RESPONSE_TRAILERS: 0x22,
  RESPONSE_END: 0x23,
  ERROR: 0x2e,
};

function frame(type, id, payload = Buffer.alloc(0)) {
  const out = Buffer.allocUnsafe(HEADER_BYTES + payload.length);
  out.writeUInt8(type, 0);
  out.writeUInt32BE(id, 1);
  out.writeUInt32BE(payload.length, 5);
  payload.copy(out, HEADER_BYTES);
  return out;
}

function json(type, id, value) {
  return frame(type, id, Buffer.from(JSON.stringify(value), 'utf8'));
}

if (process.env.FAKE_H3_SILENT !== '1') {
  const protocol = process.env.FAKE_H3_PROTOCOL !== undefined ? Number(process.env.FAKE_H3_PROTOCOL) : 3;
  process.stdout.write(json(FRAME.HELLO, 0, { protocol, helper: 'fake' }));
}

let buffer = Buffer.alloc(0);
const pendingBodies = new Map();

process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (buffer.length >= HEADER_BYTES) {
    const length = buffer.readUInt32BE(5);
    if (buffer.length < HEADER_BYTES + length) break;
    const type = buffer.readUInt8(0);
    const id = buffer.readUInt32BE(1);
    const payload = buffer.subarray(HEADER_BYTES, HEADER_BYTES + length);
    buffer = buffer.subarray(HEADER_BYTES + length);
    handle(type, id, payload);
  }
});
process.stdin.on('end', () => process.exit(0));

function handle(type, id, payload) {
  if (type === FRAME.REQUEST) {
    const head = JSON.parse(payload.toString('utf8'));
    if (head.bodyBytes > 0) {
      pendingBodies.set(id, { head, chunks: [] });
      return;
    }
    respond(id, head, Buffer.alloc(0));
    return;
  }
  if (type === FRAME.REQUEST_BODY) {
    pendingBodies.get(id)?.chunks.push(Buffer.from(payload));
    return;
  }
  if (type === FRAME.REQUEST_END) {
    const entry = pendingBodies.get(id);
    pendingBodies.delete(id);
    if (entry) respond(id, entry.head, Buffer.concat(entry.chunks));
    return;
  }
  if (type === FRAME.CANCEL) {
    // The protocol's cancel contract: forget the id, send NOTHING more.
    pendingBodies.delete(id);
  }
}

function respond(id, head, body) {
  const path = new URL(head.url).pathname;
  if (path === '/error-pre') {
    process.stdout.write(json(FRAME.ERROR, id, { code: 'connect-timeout', message: 'nothing answered the QUIC handshake' }));
    return;
  }
  if (path === '/error-verify') {
    process.stdout.write(json(FRAME.ERROR, id, { code: 'tls-verify', message: 'invalid peer certificate: UnknownIssuer' }));
    return;
  }
  if (path === '/error-handshake') {
    process.stdout.write(json(FRAME.ERROR, id, { code: 'tls-handshake', message: 'connect: aborted by peer: the TLS handshake failed' }));
    return;
  }
  if (path === '/error-post') {
    process.stdout.write(json(FRAME.RESPONSE_HEAD, id, { status: 200, headers: [['content-type', 'text/plain']] }));
    process.stdout.write(frame(FRAME.RESPONSE_BODY, id, Buffer.from('partial')));
    process.stdout.write(json(FRAME.ERROR, id, { code: 'reset', message: 'stream reset mid-body' }));
    return;
  }
  if (path === '/crash') {
    process.exit(3);
  }
  if (path === '/exit-clean') {
    // The idle-exit shape: answer fully, then exit 0 with nothing in
    // flight — the client's clean-exit contract resets quietly.
    process.stdout.write(json(FRAME.RESPONSE_HEAD, id, { status: 200, headers: [['content-type', 'text/plain']] }));
    process.stdout.write(frame(FRAME.RESPONSE_BODY, id, Buffer.from('bye')));
    process.stdout.write(frame(FRAME.RESPONSE_END, id));
    process.stdout.once('drain', () => process.exit(0));
    if (process.stdout.writableLength === 0) process.exit(0);
    return;
  }
  if (path === '/exit-once') {
    // The idle-exit RACE shape: the first helper life exits 0 without
    // answering (as if the frames were never read); the marker file
    // makes the replay's fresh life answer normally — falling through
    // to the echo response below.
    const marker = process.env.FAKE_H3_EXIT_ONCE_FILE;
    if (marker !== undefined && marker !== '' && !existsSync(marker)) {
      writeFileSync(marker, '1');
      process.exit(0);
    }
  }
  if (path === '/exit-clean-midbody') {
    // Clean exit AFTER the response head — past the replay boundary;
    // the client must fail this send, never replay it.
    process.stdout.write(json(FRAME.RESPONSE_HEAD, id, { status: 200, headers: [['content-type', 'text/plain']] }));
    process.stdout.write(frame(FRAME.RESPONSE_BODY, id, Buffer.from('mid')));
    process.stdout.once('drain', () => process.exit(0));
    if (process.stdout.writableLength === 0) process.exit(0);
    return;
  }
  if (path === '/corrupt-head') {
    // A RESPONSE_HEAD whose payload is not JSON — the client must tear
    // the session down as a corrupt stream, never crash the host.
    process.stdout.write(frame(FRAME.RESPONSE_HEAD, id, Buffer.from('not-json')));
    return;
  }
  if (path === '/exit-clean-pending') {
    // Exit 0 WITHOUT answering — a clean code with a send still in
    // flight is a crash from the client's perspective.
    process.exit(0);
  }
  if (path === '/never') {
    // Stays silent — the cancel and dispose tests own the id's fate.
    return;
  }
  if (path === '/redirect') {
    process.stdout.write(json(FRAME.RESPONSE_HEAD, id, { status: 302, headers: [['location', '/ok']] }));
    process.stdout.write(frame(FRAME.RESPONSE_END, id));
    return;
  }
  // Default: echo exchange — the request's protocol-visible facts come
  // back as headers/body so assertions read what actually crossed.
  const headers = [
    ['content-type', 'application/json'],
    ['x-echo-method', head.method],
  ];
  if (head.authority !== undefined) headers.push(['x-echo-authority', head.authority]);
  if (head.insecure === true) headers.push(['x-echo-insecure', '1']);
  if (head.connectAddress !== undefined) headers.push(['x-echo-connect-address', head.connectAddress]);
  if (head.clientCert !== undefined) headers.push(['x-echo-client-cert-key', head.clientCert.keyPem.slice(0, 32)]);
  if (head.cipherSuites !== undefined) headers.push(['x-echo-cipher-suites', head.cipherSuites.join(':')]);
  if (head.captureNetwork === true) headers.push(['x-echo-capture-network', '1']);
  const responseHead = { status: 200, headers };
  if (head.captureNetwork === true) {
    // The v3 instrumented-dial facts a real helper reports on a
    // captureNetwork head — fixed values so assertions read them back.
    responseHead.socket = { localAddress: '127.0.0.1', localPort: 52341, remoteAddress: '203.0.113.7', remotePort: 443 };
    responseHead.timings = { dnsMs: 1.5, handshakeMs: 12.25 };
  }
  process.stdout.write(json(FRAME.RESPONSE_HEAD, id, responseHead));
  const responseBody = Buffer.from(JSON.stringify({ path, receivedBytes: body.length, headers: head.headers }), 'utf8');
  process.stdout.write(frame(FRAME.RESPONSE_BODY, id, responseBody));
  process.stdout.write(json(FRAME.RESPONSE_TRAILERS, id, [['x-fake-trailer', 'end']]));
  process.stdout.write(frame(FRAME.RESPONSE_END, id));
}
