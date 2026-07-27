/**
 * Instrumented dial for one send — the node transport's answer to
 * `captureNetwork`.
 *
 * undici exposes no per-request socket timings on either result
 * surface, and its `diagnostics_channel` events carry no per-send
 * correlation (probed on 7.24.6) — but an `Agent` minted for exactly
 * one send makes correlation trivial: every connection its connector
 * dials belongs to that send. The connector here mirrors undici's own
 * (`lib/core/connect.js`) for the option set the transport uses —
 * `tls.connect` / `net.connect` with servername, ALPN, socket path,
 * keep-alive, no-delay, and a connect timeout — minus the TLS session
 * cache (a send-local agent never re-dials the same origin) and the
 * `httpSocket` upgrade seat (proxied sends never take this path).
 *
 * What the instrumentation observes per connection, straight off the
 * socket's own lifecycle events:
 *   - `'lookup'`        → DNS resolution done (absent for IP literals
 *                          and socket-path dials, which resolve nothing)
 *   - `'connect'`       → TCP established
 *   - `'secureConnect'` → TLS handshake done (TLS dials only)
 * plus, at readiness: the negotiated `alpnProtocol` and the socket's
 * local/remote endpoints. A TLSSocket extends `net.Socket` and dials
 * TCP itself when not handed an existing socket, so all three events
 * fire on the one object.
 *
 * The agent trades pooling for observability — the executor opts in
 * per interactive send only, and the transport closes the agent when
 * the send settles.
 */

import * as net from 'node:net';
import { isIP } from 'node:net';
import * as tls from 'node:tls';
import { Agent, type buildConnector, errors } from 'undici';
import type { ConnectOptions } from './node-request-transport';

/** Marks + facts for one dialed connection, `performance.now()` clock
 *  (the transport's phase-mark clock). */
export interface ConnectionRecord {
  /** `hostname:port` as dialed — matched against the final hop's URL
   *  to attribute the facts. Socket-path dials record the path. */
  origin: string;
  tlsUsed: boolean;
  startAt: number;
  dnsEndAt?: number;
  tcpEndAt?: number;
  /** Socket ready (TLS handshake done, or TCP established for
   *  cleartext). Absent when the dial failed. */
  readyAt?: number;
  /** Negotiated ALPN protocol (`'h2'` / `'http/1.1'`). Cleartext dials
   *  report `'http/1.1'` — the only protocol undici fetch speaks
   *  without TLS. */
  alpnProtocol?: string;
  localAddress?: string;
  localPort?: number;
  remoteAddress?: string;
  remotePort?: number;
}

export interface InstrumentedDial {
  agent: Agent;
  /** Every connection the agent dialed, in dial order. */
  connections: ConnectionRecord[];
}

/** undici's connect-timeout default, mirrored. */
const CONNECT_TIMEOUT_MS = 10_000;

type ConnectorCallback = Parameters<ReturnType<typeof buildConnector>>[1];

/** SNI servername for a dial — the URL's hostname unless it's an IP
 *  literal (RFC 6066 forbids IPs in SNI; Node warns and ignores). */
function servernameFor(hostname: string): string | undefined {
  return isIP(hostname) === 0 ? hostname : undefined;
}

/**
 * Mint the send-local instrumented agent. `connect` is the same option
 * bag the shared dispatcher path builds (`connectOptionsFor`), so every
 * per-request connection knob — TLS window, ciphers, pinned lookup,
 * client certificate, socket path — rides the instrumented dial
 * unchanged.
 */
export function createInstrumentedDial(connect: ConnectOptions, allowH2: boolean): InstrumentedDial {
  const connections: ConnectionRecord[] = [];
  const { socketPath, lookup, ...tlsOpts } = connect;

  const connector = ((opts, callback: ConnectorCallback) => {
    const { hostname, protocol, port } = opts;
    const secure = protocol === 'https:';
    const record: ConnectionRecord = {
      origin: socketPath ?? `${hostname}:${port || (secure ? 443 : 80)}`,
      tlsUsed: secure,
      startAt: performance.now(),
    };
    connections.push(record);

    let socket: net.Socket | tls.TLSSocket;
    if (secure) {
      socket = tls.connect({
        ...tlsOpts,
        ...(lookup !== undefined ? { lookup } : {}),
        ...(socketPath !== undefined ? { path: socketPath } : {}),
        servername: servernameFor(hostname),
        ALPNProtocols: allowH2 ? ['http/1.1', 'h2'] : ['http/1.1'],
        port: port !== undefined && port !== '' ? Number(port) : 443,
        host: hostname,
      });
    } else {
      socket = net.connect({
        ...(lookup !== undefined ? { lookup } : {}),
        ...(socketPath !== undefined ? { path: socketPath } : {}),
        port: port !== undefined && port !== '' ? Number(port) : 80,
        host: hostname,
      });
    }

    socket.setKeepAlive(true, 60_000);
    socket.setNoDelay(true);

    socket.once('lookup', () => {
      record.dnsEndAt = performance.now();
    });
    socket.once('connect', () => {
      record.tcpEndAt = performance.now();
    });

    const timeout = setTimeout(() => {
      socket.destroy(new errors.ConnectTimeoutError(`Connect Timeout Error (attempted address: ${record.origin})`));
    }, CONNECT_TIMEOUT_MS);

    let settled = false;
    socket.once(secure ? 'secureConnect' : 'connect', () => {
      clearTimeout(timeout);
      record.readyAt = performance.now();
      const alpn = secure ? (socket as tls.TLSSocket).alpnProtocol : null;
      // A TLS server that negotiated no ALPN speaks HTTP/1.1 — the
      // same assumption undici's h1 client makes.
      record.alpnProtocol = typeof alpn === 'string' && alpn !== '' ? alpn : 'http/1.1';
      if (socket.localAddress !== undefined) record.localAddress = socket.localAddress;
      if (socket.localPort !== undefined) record.localPort = socket.localPort;
      if (socket.remoteAddress !== undefined) record.remoteAddress = socket.remoteAddress;
      if (socket.remotePort !== undefined) record.remotePort = socket.remotePort;
      if (!settled) {
        settled = true;
        callback(null, socket);
      }
    });
    socket.once('error', (err) => {
      clearTimeout(timeout);
      if (!settled) {
        settled = true;
        callback(err, null);
      }
    });
  }) as ReturnType<typeof buildConnector>;

  return { agent: new Agent({ connect: connector, ...(allowH2 ? { allowH2: true } : {}) }), connections };
}
