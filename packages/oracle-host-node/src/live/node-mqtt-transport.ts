/**
 * Node MQTT byte-stream transport — the node hosts' implementation of
 * the engine's {@link MqttByteTransport} seam, scheme-dispatched (the
 * ratified fork-3 posture):
 *
 *   - `mqtt://` / `mqtts://` dial the raw byte stream MQTT actually
 *     speaks: `node:net` / `node:tls` (no broker/client dep). Wire
 *     ceremony owned here: the TLS verification policy (`mqtts:`
 *     verifies against the system roots unless the request's
 *     `sslVerification: false` opts out — the self-signed dev-broker
 *     knob), the client certificate pair a mutual-TLS broker demands
 *     (a ref that resolved to no vault entry fails the dial loudly),
 *     the SNI name and ALPN offer on the `mqtts:` handshake, the dial
 *     deadline (`timeoutMs` spans connect + TLS
 *     handshake with a local timer — an OPEN session has no ceiling),
 *     and dial-error truth captured at the socket, classified into
 *     user-actionable messages. Raw TCP dials are DIRECT in v1 — no
 *     ambient-proxy plane (a CONNECT tunnel has no MQTT leg today).
 *   - `ws://` / `wss://` ride MQTT-over-WebSocket on the proven node
 *     WS transport ({@link createNodeWsTransport} — undici underneath,
 *     ambient proxy plane included): the `mqtt` subprotocol offered,
 *     packets crossing as BINARY frames. Frame boundaries carry no
 *     packet meaning — the executor's incremental decoder reassembles
 *     either way, so the seam just forwards bytes.
 *
 * Abort (the Stop hook): before the stream establishes it settles
 * through `onEnd` with a classified error; after `onConnect` it tears
 * the socket down and settles `onEnd()` immediately with no error —
 * Stop materializes what arrived.
 */

import * as net from 'node:net';
import * as tls from 'node:tls';
import type {
  MqttByteTransport,
  MqttStreamCallbacks,
  MqttStreamWriter,
  MqttTransportRequest,
} from '@openheaders/oracle/live/mqtt-exec/transport';
import { MqttTransportError } from '@openheaders/oracle/live/mqtt-exec/transport';
import { createNodeWsTransport } from './node-ws-transport';

const MQTT_DEFAULT_PORT = 1883;
const MQTTS_DEFAULT_PORT = 8883;

/** `host[:port]` for messages — the URL may carry more. */
function hostLabelOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Classify a pre-connect dial failure into a user-actionable message
 *  — the WS transport's classifier vocabulary on the tcp leg. */
function classifyMqttDialFailure(url: string, err: unknown, certRef: string | undefined): string {
  const host = hostLabelOf(url);
  const code =
    err !== null && typeof err === 'object' && typeof (err as { code?: unknown }).code === 'string'
      ? ((err as { code: string }).code as string)
      : undefined;
  switch (code) {
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return `Could not resolve host ${host} (DNS lookup failed). Check the target and your network.`;
    case 'ECONNREFUSED':
      return `Connection refused by ${host}. Is the MQTT broker running on that host/port?`;
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
      return `No route to ${host} (${code}).`;
    case 'ETIMEDOUT':
      return `Connection to ${host} timed out.`;
    case 'ECONNRESET':
      return `Connection to ${host} was reset before the session opened.`;
    case 'CERT_HAS_EXPIRED':
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
    case 'SELF_SIGNED_CERT_IN_CHAIN':
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
      return `TLS certificate error reaching ${host} (${code}).`;
    default: {
      if (certRef !== undefined && code?.startsWith('ERR_OSSL_')) {
        return `The client certificate from vault entry "${certRef}" could not be loaded (${code}). Check that the entry's certificate and key are valid PEM, belong together, and that the passphrase is right.`;
      }
      if (code !== undefined && (code.startsWith('ERR_SSL_') || code === 'EPROTO')) {
        return `TLS handshake with ${host} failed (${code}). If the broker is plaintext, use mqtt:// instead of mqtts://.`;
      }
      const message = err instanceof Error ? err.message : String(err);
      return `Could not open an MQTT connection to ${host}: ${message}`;
    }
  }
}

/** A client-certificate ref that resolved to no vault entry on this
 *  device — the dial must not silently proceed without the pair. */
function danglingClientCertificateError(request: MqttTransportRequest): string | null {
  if (request.clientCertificateRef === undefined || request.clientCertificatePem !== undefined) return null;
  return `No vault certificate entry named "${request.clientCertificateRef}" on this device — add it to the vault or clear the request's client certificate setting.`;
}

function connectTcp(
  request: MqttTransportRequest,
  callbacks: MqttStreamCallbacks,
  secure: boolean,
  signal?: AbortSignal,
): MqttStreamWriter {
  let ended = false;
  let connected = false;
  let deadlineExpired = false;
  let lastError: unknown = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let socket: net.Socket | null = null;

  const cleanup = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    signal?.removeEventListener('abort', onAbort);
  };
  const settleError = (message: string): void => {
    if (ended) return;
    ended = true;
    cleanup();
    callbacks.onEnd(new MqttTransportError(message));
  };
  const settleComplete = (): void => {
    if (ended) return;
    ended = true;
    cleanup();
    callbacks.onEnd();
  };
  const settleClosed = (): void => {
    if (ended) return;
    if (connected) {
      settleComplete();
      return;
    }
    if (deadlineExpired) {
      settleError(`Connect deadline of ${request.timeoutMs} ms elapsed before the session opened.`);
      return;
    }
    if (signal?.aborted) {
      settleError('Session stopped before it connected.');
      return;
    }
    settleError(
      classifyMqttDialFailure(
        request.url,
        lastError ?? new Error('the connection closed during the dial'),
        request.clientCertificateRef,
      ),
    );
  };
  const onAbort = (): void => {
    // Stop-abort: tear down and settle NOW — after connect the arrived
    // capture materializes; before it, the classified stop error tells
    // the story (via the close path).
    socket?.destroy();
    if (connected) settleComplete();
    else settleClosed();
  };

  let parsed: URL;
  try {
    parsed = new URL(request.url);
  } catch {
    queueMicrotask(() => settleError('The URL is not valid.'));
    return { write: () => {}, end: () => {} };
  }
  const host = parsed.hostname;
  const port = parsed.port !== '' ? Number(parsed.port) : secure ? MQTTS_DEFAULT_PORT : MQTT_DEFAULT_PORT;

  if (signal?.aborted) {
    queueMicrotask(() => settleError('Session stopped before it connected.'));
    return { write: () => {}, end: () => {} };
  }
  const danglingCertificate = danglingClientCertificateError(request);
  if (danglingCertificate !== null) {
    queueMicrotask(() => settleError(danglingCertificate));
    return { write: () => {}, end: () => {} };
  }
  signal?.addEventListener('abort', onAbort);

  if (request.timeoutMs !== undefined) {
    timer = setTimeout(() => {
      if (connected) return;
      deadlineExpired = true;
      socket?.destroy();
    }, request.timeoutMs);
  }

  const onEstablished = (): void => {
    if (ended) return;
    connected = true;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    callbacks.onConnect();
  };

  const sock = secure
    ? tls.connect({
        host,
        port,
        servername: request.sniServerName ?? host,
        ...(request.sslVerification === false ? { rejectUnauthorized: false } : {}),
        ...(request.alpnProtocol !== undefined ? { ALPNProtocols: [request.alpnProtocol] } : {}),
        ...(request.clientCertificatePem !== undefined ? { cert: request.clientCertificatePem } : {}),
        ...(request.clientCertificateKeyPem !== undefined ? { key: request.clientCertificateKeyPem } : {}),
        ...(request.clientCertificatePassphrase !== undefined
          ? { passphrase: request.clientCertificatePassphrase }
          : {}),
      })
    : net.connect({ host, port });
  socket = sock;
  if (secure) (sock as tls.TLSSocket).on('secureConnect', onEstablished);
  else sock.on('connect', onEstablished);
  sock.on('data', (chunk: Buffer) => {
    if (ended) return;
    callbacks.onData(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
  });
  sock.on('error', (err) => {
    // The close event follows and settles; keep the real cause for its
    // classification.
    lastError = err;
  });
  sock.on('close', settleClosed);

  return {
    write(bytes: Uint8Array): void {
      if (ended || socket === null || socket.destroyed) return;
      socket.write(bytes);
    },
    end(): void {
      if (ended || socket === null || socket.destroyed) return;
      socket.end();
    },
  };
}

function connectWs(
  request: MqttTransportRequest,
  callbacks: MqttStreamCallbacks,
  signal?: AbortSignal,
): MqttStreamWriter {
  const wsTransport = createNodeWsTransport();
  const danglingCertificate = danglingClientCertificateError(request);
  if (danglingCertificate !== null) {
    queueMicrotask(() => callbacks.onEnd(new MqttTransportError(danglingCertificate)));
    return { write: () => {}, end: () => {} };
  }
  const writer = wsTransport.connect(
    {
      url: request.url,
      headers: [],
      // The MQTT-over-WebSocket contract: the client MUST offer the
      // `mqtt` subprotocol, and packets ride binary frames.
      subprotocols: ['mqtt'],
      ...(request.sslVerification !== undefined ? { sslVerification: request.sslVerification } : {}),
      ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
      ...(request.clientCertificatePem !== undefined ? { clientCertificatePem: request.clientCertificatePem } : {}),
      ...(request.clientCertificateKeyPem !== undefined
        ? { clientCertificateKeyPem: request.clientCertificateKeyPem }
        : {}),
      ...(request.clientCertificatePassphrase !== undefined
        ? { clientCertificatePassphrase: request.clientCertificatePassphrase }
        : {}),
    },
    {
      onOpen: (_protocol, _extensions, proxyRoute) => callbacks.onConnect(proxyRoute),
      onMessage: ({ data }) => callbacks.onData(data),
      // The Close accounting has no MQTT meaning — the byte stream's
      // end is the fact the executor consumes.
      onClose: () => {},
      onEnd: (error) => callbacks.onEnd(error !== undefined ? new MqttTransportError(error.message) : undefined),
    },
    signal,
  );
  return {
    write(bytes: Uint8Array): void {
      writer.sendBinary?.(bytes);
    },
    end(): void {
      writer.close(1000, '');
    },
  };
}

export function createNodeMqttTransport(): MqttByteTransport {
  return {
    connect(request: MqttTransportRequest, callbacks: MqttStreamCallbacks, signal?: AbortSignal): MqttStreamWriter {
      if (/^wss?:\/\//i.test(request.url)) return connectWs(request, callbacks, signal);
      return connectTcp(request, callbacks, /^mqtts:\/\//i.test(request.url), signal);
    },
  };
}
