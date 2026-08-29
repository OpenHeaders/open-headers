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
 *     deadline (`timeoutMs` spans route resolution + every dial
 *     attempt + TLS handshake with a local timer — an OPEN session has
 *     no ceiling), the address pin (the shared pinned `lookup` seat),
 *     the proxy walk (the shared session route: the request's own
 *     proxy setting first, else the host's system plane; an HTTP(S)
 *     proxy rides the shared hand-rolled CONNECT tunnel with the
 *     `mqtts:` TLS handshake run over the tunnel socket — a raw MQTT
 *     dial tunnels CONNECT only, so SOCKS5 is the honest pre-wire
 *     error; an ambient chain falls through a dead proxy like the
 *     other sessions), and dial-error truth captured at the socket,
 *     classified into user-actionable messages.
 *   - `ws://` / `wss://` ride MQTT-over-WebSocket on the proven node
 *     WS transport ({@link createNodeWsTransport} — undici underneath,
 *     the same TLS + dial policy handed through, proxy walk included):
 *     the `mqtt` subprotocol offered, packets crossing as BINARY
 *     frames. Frame boundaries carry no packet meaning — the
 *     executor's incremental decoder reassembles either way, so the
 *     seam just forwards bytes.
 *
 * Abort (the Stop hook): before the stream establishes it settles
 * through `onEnd` with a classified error; after `onConnect` it tears
 * the socket down and settles `onEnd()` immediately with no error —
 * Stop materializes what arrived.
 */

import * as net from 'node:net';
import * as tls from 'node:tls';
import type { TrustCertificateErrorHint } from '@openheaders/core/types';
import type {
  MqttByteTransport,
  MqttStreamCallbacks,
  MqttStreamWriter,
  MqttTransportRequest,
} from '@openheaders/oracle/live/mqtt-exec/transport';
import { MqttTransportError } from '@openheaders/oracle/live/mqtt-exec/transport';
import { classifyPinnedDialFailure, classifyProxyLegFailure, pinnedLookupOptionsFor } from './dial-policy';
import { createNodeWsTransport } from './node-ws-transport';
import { dialConnectTunnel } from './request-transport/connect-tunnel';
import { systemProxyResolver } from './system-proxy/registry';
import {
  isSessionProxyDialFailure,
  resolveSessionProxyAttempts,
  type SessionProxyAttempt,
  sessionRouteFieldsOf,
} from './system-proxy/session-route';
import type { SystemProxyResolver } from './system-proxy/types';
import { tlsPolicyOptionsFor } from './tls-policy';
import { isTlsVerificationCode, trustCertificateHintFor } from './tls-verification';

export interface NodeMqttTransportOptions {
  /** The system-plane resolver — injectable so unit rigs drive
   *  ambient-proxy dials with fake resolvers. `null` turns the plane
   *  off for this transport; omitted = the host's registered resolver
   *  (see `system-proxy/registry`). */
  systemProxy?: SystemProxyResolver | null;
}

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
/** The failure's `code` when the error carries one. */
function mqttFailureCode(err: unknown): string | undefined {
  return err !== null && typeof err === 'object' && typeof (err as { code?: unknown }).code === 'string'
    ? (err as { code: string }).code
    : undefined;
}

function classifyMqttDialFailure(
  request: MqttTransportRequest,
  err: unknown,
  attempt: SessionProxyAttempt | undefined,
): string {
  const host = hostLabelOf(request.url);
  const certRef = request.clientCertificateRef;
  const code = mqttFailureCode(err);
  // A proxied dial classifies against the PROXY leg (the shared prose
  // names the plane that sent it there); a pinned dial names the
  // resolve-to-address setting. Target-leg failures past the tunnel
  // fall through to the shared classification.
  const proxied = classifyProxyLegFailure(host, err, attempt, 'session', request.proxyCredentialRef);
  if (proxied !== undefined) return proxied;
  const pinned = classifyPinnedDialFailure(host, request.resolveToAddress, err);
  if (pinned !== undefined) return pinned;
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

/** One dial attempt's outcome: the stream established (or the connect
 *  already settled some other way), or a pre-connect failure the
 *  walker may fall through from. */
type MqttAttemptOutcome = { settled: true } | { settled: false; failure: unknown };

function connectTcp(
  request: MqttTransportRequest,
  callbacks: MqttStreamCallbacks,
  secure: boolean,
  resolver: SystemProxyResolver | null,
  signal?: AbortSignal,
): MqttStreamWriter {
  let ended = false;
  let connected = false;
  let deadlineExpired = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let socket: net.Socket | null = null;
  let activeAttempt: SessionProxyAttempt | undefined;
  // The walk's shared abort: a tunnel dial in flight stops with the
  // deadline or the Stop hook.
  const walk = new AbortController();

  const cleanup = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    signal?.removeEventListener('abort', onAbort);
  };
  const settleError = (message: string, hint?: TrustCertificateErrorHint): void => {
    if (ended) return;
    ended = true;
    cleanup();
    callbacks.onEnd(new MqttTransportError(message, hint));
  };
  const settleComplete = (): void => {
    if (ended) return;
    ended = true;
    cleanup();
    callbacks.onEnd();
  };
  const endWithError = (err: unknown): void => {
    if (ended) return;
    if (deadlineExpired) {
      settleError(`Connect deadline of ${request.timeoutMs} ms elapsed before the session opened.`);
      return;
    }
    if (signal?.aborted) {
      settleError('Session stopped before it connected.');
      return;
    }
    // A verification failure carries the trust remedy — the hint the
    // HTTP and WS transports attach, so the pane can offer the
    // presented chain for pinning.
    const code = mqttFailureCode(err);
    settleError(
      classifyMqttDialFailure(request, err, activeAttempt),
      isTlsVerificationCode(code) ? trustCertificateHintFor(request.url, code) : undefined,
    );
  };
  const onAbort = (): void => {
    // Stop-abort: tear down and settle NOW — after connect the arrived
    // capture materializes; before it, the classified stop error tells
    // the story.
    walk.abort();
    socket?.destroy();
    if (connected) settleComplete();
    else endWithError(new Error('aborted'));
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

  // ONE deadline spans route resolution and every dial attempt — the
  // HTTP transport's one-deadline discipline.
  if (request.timeoutMs !== undefined) {
    timer = setTimeout(() => {
      if (connected) return;
      deadlineExpired = true;
      walk.abort();
      socket?.destroy();
      endWithError(new Error('connect deadline elapsed'));
    }, request.timeoutMs);
  }

  const tlsOptions = (): tls.ConnectionOptions => ({
    servername: host,
    ...(request.alpnProtocol !== undefined ? { ALPNProtocols: [request.alpnProtocol] } : {}),
    ...tlsPolicyOptionsFor(request),
  });

  // The socket for one attempt: a direct dial (`mqtts:` handshake with
  // the policy bag, the pinned lookup seat) or the CONNECT tunnel to
  // the broker with the `mqtts:` handshake run over the tunnel socket.
  // A cleartext tunnel IS the connection — it already connected.
  const dialSocket = async (attempt: SessionProxyAttempt): Promise<{ sock: net.Socket; established: boolean }> => {
    if (attempt.proxy === undefined) {
      const lookup = pinnedLookupOptionsFor(request);
      return {
        sock: secure ? tls.connect({ host, port, ...lookup, ...tlsOptions() }) : net.connect({ host, port, ...lookup }),
        established: false,
      };
    }
    const tunnel = await dialConnectTunnel({ hostname: host, port }, { proxy: attempt.proxy, signal: walk.signal });
    return secure
      ? { sock: tls.connect({ socket: tunnel, ...tlsOptions() }), established: false }
      : { sock: tunnel, established: true };
  };

  // One dial attempt: open the socket, wire the stream events. A
  // pre-connect close resolves the attempt as a failure (the walker
  // decides fall-through); everything after the stream establishes
  // settles through the shared paths.
  const dialAttempt = async (attempt: SessionProxyAttempt): Promise<MqttAttemptOutcome> => {
    let dialed: { sock: net.Socket; established: boolean };
    try {
      dialed = await dialSocket(attempt);
    } catch (err) {
      return { settled: false, failure: err };
    }
    if (ended) {
      dialed.sock.destroy();
      return { settled: true };
    }
    return new Promise<MqttAttemptOutcome>((resolveAttempt) => {
      const sock = dialed.sock;
      socket = sock;
      let lastError: unknown = null;
      const onEstablished = (): void => {
        if (ended) return;
        connected = true;
        if (timer !== null) clearTimeout(timer);
        timer = null;
        callbacks.onConnect(attempt.route);
        resolveAttempt({ settled: true });
      };
      sock.on('data', (chunk: Buffer) => {
        if (ended) return;
        callbacks.onData(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
      });
      sock.on('error', (err) => {
        // The close event follows and settles; keep the real cause for
        // its classification.
        lastError = err;
      });
      sock.on('close', () => {
        if (connected) {
          settleComplete();
          resolveAttempt({ settled: true });
          return;
        }
        if (ended) {
          resolveAttempt({ settled: true });
          return;
        }
        resolveAttempt({ settled: false, failure: lastError ?? new Error('the connection closed during the dial') });
      });
      if (dialed.established) onEstablished();
      else if (secure) (sock as tls.TLSSocket).once('secureConnect', onEstablished);
      else sock.once('connect', onEstablished);
    });
  };

  const runConnect = async (): Promise<void> => {
    const resolved = await resolveSessionProxyAttempts(
      { ...sessionRouteFieldsOf(request), capability: 'connect-only' },
      resolver,
    );
    if (ended) return;
    if ('errorMessage' in resolved) {
      // The honest pre-wire gate — an explicit contradiction, or a
      // chain resolving only to proxies this dial cannot traverse.
      settleError(resolved.errorMessage);
      return;
    }
    const attempts = resolved.attempts;
    for (let i = 0; i < attempts.length; i += 1) {
      if (ended) return;
      const attempt = attempts[i];
      activeAttempt = attempt;
      const outcome = await dialAttempt(attempt);
      if (outcome.settled) return;
      socket = null;
      // Chain walking: a dial-level failure REACHING a system-plane
      // proxy falls through to the next chain entry (Chromium's own
      // fallback semantics). Everything else — CONNECT rejections,
      // target-leg failures — surfaces.
      const nextExists = i < attempts.length - 1;
      if (
        attempt.environmentChain === true &&
        nextExists &&
        !walk.signal.aborted &&
        isSessionProxyDialFailure(outcome.failure)
      ) {
        continue;
      }
      endWithError(outcome.failure);
      return;
    }
  };
  void runConnect();

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
  resolver: SystemProxyResolver | null,
  signal?: AbortSignal,
): MqttStreamWriter {
  const wsTransport = createNodeWsTransport({ systemProxy: resolver });
  const danglingCertificate = danglingClientCertificateError(request);
  if (danglingCertificate !== null) {
    queueMicrotask(() => callbacks.onEnd(new MqttTransportError(danglingCertificate)));
    return { write: () => {}, end: () => {} };
  }
  // The whole TLS + dial policy hands through to the WS dial — the
  // `mqtts:`-only ALPN offer is the one knob the WebSocket handshake
  // does not carry.
  const { url, alpnProtocol: _alpnProtocol, ...policy } = request;
  const writer = wsTransport.connect(
    {
      url,
      headers: [],
      // The MQTT-over-WebSocket contract: the client MUST offer the
      // `mqtt` subprotocol, and packets ride binary frames.
      subprotocols: ['mqtt'],
      ...policy,
    },
    {
      onOpen: (_protocol, _extensions, proxyRoute) => callbacks.onConnect(proxyRoute),
      onMessage: ({ data }) => callbacks.onData(data),
      // The Close accounting has no MQTT meaning — the byte stream's
      // end is the fact the executor consumes.
      onClose: () => {},
      onEnd: (error) =>
        callbacks.onEnd(error !== undefined ? new MqttTransportError(error.message, error.hint) : undefined),
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

export function createNodeMqttTransport(options: NodeMqttTransportOptions = {}): MqttByteTransport {
  const resolverFor = (): SystemProxyResolver | null =>
    options.systemProxy !== undefined ? options.systemProxy : systemProxyResolver();
  return {
    connect(request: MqttTransportRequest, callbacks: MqttStreamCallbacks, signal?: AbortSignal): MqttStreamWriter {
      if (/^wss?:\/\//i.test(request.url)) return connectWs(request, callbacks, resolverFor(), signal);
      return connectTcp(request, callbacks, /^mqtts:\/\//i.test(request.url), resolverFor(), signal);
    },
  };
}
