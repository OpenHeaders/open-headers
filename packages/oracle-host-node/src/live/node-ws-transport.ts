/**
 * Node WebSocket transport — the node hosts' implementation of the
 * engine's {@link WsTransport} seam, over undici's `WebSocket` (the
 * SAME stack Node 22's built-in client is — imported from the undici
 * package the HTTP transport already rides, so the platform-native
 * fork ratification holds with the node-only knobs guaranteed: custom
 * handshake `headers` and a per-connect `dispatcher`). No `ws` dep,
 * per the S1 fork ratification.
 *
 * Wire ceremony owned here:
 *   - The handshake: subprotocol offers and custom headers ride the
 *     constructor options; `wss:` verifies against the system roots
 *     unless the request's `sslVerification: false` opts out (a fresh
 *     `Agent` dispatcher with `rejectUnauthorized: false` — the
 *     self-signed dev-server knob, minted per connect and closed on
 *     settle).
 *   - The connect deadline: `timeoutMs` spans dial + upgrade with a
 *     local timer — an OPEN session has no ceiling (the seam law).
 *     One deadline spans EVERY dial attempt of a connect (the HTTP
 *     transport's one-deadline discipline).
 *   - Socket-path dial: `unixSocketPath` rides the per-connect agent's
 *     connector as undici's `socketPath` — the dial-winning `path`
 *     into net/tls.connect, so the URL's host stays cosmetic for
 *     dialing while the handshake `Host`, SNI, and certificate
 *     verification keep it.
 *   - Ambient proxy coverage (docs/REQUEST_ENGINE_PROXY_DESIGN.md,
 *     P6): a connect consults the host's environment plane per target
 *     — WS editors carry no request-plane proxy knobs (the H5
 *     ruling), so the plane's answer is the whole story. An HTTP(S)
 *     answer rides the shared hand-rolled CONNECT tunnel on the
 *     per-connect agent's connector (`wss://` tunnels; `ws://`
 *     through the same CONNECT tunnel — corporate proxies expect
 *     CONNECT for WS upgrades); a SOCKS5 answer seats undici's
 *     `Socks5ProxyAgent` as the per-connect dispatcher. The chain
 *     walks like HTTP sends (a dial failure REACHING one proxy falls
 *     through to the next entry); a socket-pinned connect makes the
 *     ambient proxy stand down (recorded); the winning route reports
 *     through `onOpen` as wire truth.
 *   - Frame types honest: `binaryType = 'arraybuffer'`; a text frame
 *     crosses the seam as its UTF-8 bytes with `binary: false`.
 *   - The Close event verbatim (`code`, `reason`, `wasClean`) — the
 *     executor maps the platform's 1006 no-Close-frame marker onto
 *     the honest `null` close; nothing is rewritten here.
 *   - Abort (the Stop hook): before the handshake it settles through
 *     `onEnd` with a classified error; after `onOpen` it closes the
 *     socket and settles `onEnd()` IMMEDIATELY with no error — Stop
 *     materializes what arrived and never waits on a close handshake
 *     a hung server may not answer.
 *
 * Error classification mirrors the HTTP transport's: pre-open
 * failures surface as a {@link WsTransportError} with a
 * user-actionable message, the meaningful `code` walked off undici's
 * `cause` chain; proxied dials classify against the PROXY leg (407
 * names the credentials, a refused dial names the proxy).
 */

import {
  type WsProxyRoute,
  type WsSessionCallbacks,
  type WsSessionWriter,
  type WsTransport,
  WsTransportError,
  type WsTransportRequest,
} from '@openheaders/oracle/live/ws-exec/transport';
import { Agent, buildConnector, type Dispatcher, WebSocket as UndiciWebSocket } from 'undici';
import { isSocks5ProxyUrl } from './environment-proxy/proxy-value';
import { environmentProxyResolver } from './environment-proxy/registry';
import {
  isSessionProxyDialFailure,
  resolveSessionProxyAttempts,
  type SessionProxyAttempt,
} from './environment-proxy/session-route';
import type { EnvironmentProxyResolver } from './environment-proxy/types';
import { createDialConnector } from './instrumented-connector';
import { proxyConnectRejectedStatus } from './request-transport/connect-tunnel';
import { buildSocks5Agent } from './request-transport/dispatcher';
import type { ConnectOptions } from './request-transport/seam';

export interface NodeWsTransportOptions {
  /** The environment-plane resolver — injectable so unit rigs drive
   *  ambient-proxy connects with fake resolvers. `null` turns the
   *  plane off for this transport; omitted = the host's registered
   *  resolver (see `environment-proxy/registry`). */
  environmentProxy?: EnvironmentProxyResolver | null;
}

/** The failure's meaningful code, walking the `cause` chain (undici
 *  wraps dial errors in handshake-level events). */
function wsFailureCode(err: unknown): string | undefined {
  let current: unknown = err;
  for (let depth = 0; depth < 6 && current !== null && typeof current === 'object'; depth++) {
    const record = current as { code?: unknown; cause?: unknown };
    if (typeof record.code === 'string') return record.code;
    current = record.cause;
  }
  return undefined;
}

/** Classify a pre-open failure into a user-actionable message. */
function classifyWsFailure(url: string, err: unknown, socketPath?: string, proxyUrl?: string): string {
  const host = hostLabelOf(url);
  const code = wsFailureCode(err);
  // A socket-pinned session never dials TCP, so every dial-level
  // failure is about the socket itself — name the setting and the path
  // (the HTTP classifier's socket prose). Codes outside this set (TLS
  // handshake, upgrade refusal) fall through to the shared
  // classification below.
  if (socketPath !== undefined) {
    switch (code) {
      case 'ENOENT': {
        // An overlong path fails as ENOENT too — the OS truncates or
        // rejects anything past its sun_path limit.
        const lengthHint =
          socketPath.length > 100
            ? ' Paths longer than the OS limit on socket paths (~104 characters) also fail this way.'
            : '';
        return `No socket at ${socketPath} — the request's Unix-socket setting dials it. Is the service running and the path right?${lengthHint}`;
      }
      case 'ENOTSOCK':
        return `The path ${socketPath} exists but is not a socket — the request's Unix-socket setting dials it.`;
      case 'EACCES':
        return `Permission denied opening the socket at ${socketPath} — the request's Unix-socket setting dials it.`;
      case 'ECONNREFUSED':
        return `Connection refused on the socket at ${socketPath} — the request's Unix-socket setting dials it. Is the service still listening on that socket?`;
      case 'ETIMEDOUT':
        return `Connection on the socket at ${socketPath} timed out — the request's Unix-socket setting dials it.`;
    }
  }
  // An ambient-proxied dial classifies against the PROXY leg: a
  // rejected CONNECT is the proxy's own answer, and a dial-level
  // failure can only be the proxy itself (target dialing happens at
  // the proxy). Target-leg failures past the tunnel fall through to
  // the shared classification — by then the proxy is a transparent
  // pipe.
  if (proxyUrl !== undefined) {
    const proxyHost = hostLabelOf(proxyUrl);
    const rejected = proxyConnectRejectedStatus(err);
    if (rejected === 407) {
      return `The proxy at ${proxyHost} requires authentication (407) — this machine's proxy configuration routes this session through it. Check the environment plane's proxy credentials in the app settings.`;
    }
    if (rejected !== undefined) {
      return `The proxy at ${proxyHost} could not open a tunnel to ${host} (HTTP ${rejected}). The proxy is reachable — the failure is between the proxy and the target.`;
    }
    switch (code) {
      case 'ENOTFOUND':
      case 'EAI_AGAIN':
        return `Could not resolve the proxy host ${proxyHost} (DNS lookup failed) — this machine's proxy configuration routes this session through it.`;
      case 'ECONNREFUSED':
        return `Connection refused by the proxy at ${proxyHost} — this machine's proxy configuration routes this session through it. Is the proxy running?`;
      case 'EHOSTUNREACH':
      case 'ENETUNREACH':
        return `No route to the proxy at ${proxyHost} (${code}) — this machine's proxy configuration routes this session through it.`;
      case 'ETIMEDOUT':
      case 'UND_ERR_CONNECT_TIMEOUT':
        return `Connection to the proxy at ${proxyHost} timed out — this machine's proxy configuration routes this session through it.`;
    }
  }
  switch (code) {
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return `Could not resolve host ${host} (DNS lookup failed). Check the target and your network.`;
    case 'ECONNREFUSED':
      return `Connection refused by ${host}. Is the WebSocket server running on that host/port?`;
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
      return `No route to ${host} (${code}).`;
    case 'ETIMEDOUT':
      return `Connection to ${host} timed out.`;
    case 'ECONNRESET':
      return `Connection to ${host} was reset during the handshake.`;
    case 'CERT_HAS_EXPIRED':
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
    case 'SELF_SIGNED_CERT_IN_CHAIN':
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
      return `TLS certificate error reaching ${host} (${code}).`;
    default: {
      if (code !== undefined && (code.startsWith('ERR_SSL_') || code === 'EPROTO')) {
        return `TLS handshake with ${host} failed (${code}). If the server is plaintext, use ws:// instead of wss://.`;
      }
      const message = err instanceof Error ? err.message : String(err);
      if (message.trim() === '' || message === 'WebSocket error') {
        // Undici reports a rejected upgrade (non-101 answer) as a bare
        // error — with the dial itself captured separately, this is
        // the handshake refusal it is.
        return `${host} did not accept the WebSocket handshake. Is it a WebSocket endpoint?`;
      }
      return `Could not open a WebSocket session to ${host}: ${message}`;
    }
  }
}

/** `host[:port]` for messages — the full URL may carry params. */
function hostLabelOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** One dial attempt's outcome: the session opened (or the connect
 *  already settled some other way), or a pre-open failure the walker
 *  may fall through from. */
type WsAttemptOutcome = { settled: true } | { settled: false; failure: unknown };

export function createNodeWsTransport(options: NodeWsTransportOptions = {}): WsTransport {
  return {
    connect(request: WsTransportRequest, callbacks: WsSessionCallbacks, signal?: AbortSignal): WsSessionWriter {
      let active: UndiciWebSocket | null = null;
      let dispatcher: Dispatcher | null = null;
      let ended = false;
      let opened = false;
      let deadlineExpired = false;
      let attemptProxyUrl: string | undefined;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = (): void => {
        if (timer !== null) clearTimeout(timer);
        timer = null;
        signal?.removeEventListener('abort', onAbort);
        // Closing the per-connect dispatcher releases its sockets; the
        // default global dispatcher is never ours to close.
        void dispatcher?.close();
        dispatcher = null;
      };
      const settleError = (message: string): void => {
        if (ended) return;
        ended = true;
        cleanup();
        callbacks.onEnd(new WsTransportError(message));
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
        settleError(classifyWsFailure(request.url, err, request.unixSocketPath, attemptProxyUrl));
      };
      const endComplete = (): void => {
        if (ended) return;
        ended = true;
        cleanup();
        callbacks.onEnd();
      };
      const onAbort = (): void => {
        // Stop-abort: tear down and settle NOW — after the handshake
        // the arrived capture materializes without waiting on a Close
        // answer; before it, the classified stop error tells the story.
        try {
          active?.close();
        } catch {
          // A socket already closing throws nowhere we care about.
        }
        if (opened) endComplete();
        else endWithError(new Error('aborted'));
      };

      if (signal?.aborted) {
        queueMicrotask(() => endWithError(new Error('aborted')));
        return { send: () => {}, close: () => {} };
      }

      // ONE deadline spans resolution and every dial attempt — the
      // HTTP transport's one-deadline discipline.
      if (request.timeoutMs !== undefined) {
        timer = setTimeout(() => {
          if (opened) return;
          deadlineExpired = true;
          try {
            active?.close();
          } catch {
            // Ignore — the deadline settle below is the story.
          }
          endWithError(new Error('connect deadline elapsed'));
        }, request.timeoutMs);
      }
      signal?.addEventListener('abort', onAbort);

      // The per-connect dispatcher for one attempt. Direct attempts
      // keep undici's own connector (TLS policy + socket path); an
      // HTTP(S) proxy attempt rides the hand-rolled CONNECT tunnel
      // dial (CONNECT for ws:// and wss:// alike — the corporate-proxy
      // expectation); a SOCKS5 attempt seats undici's agent. The
      // connector wrap captures the REAL dial error (undici's
      // WebSocket layer swallows it into a bare event — probed live).
      const mintDispatcher = (attempt: SessionProxyAttempt, onDialError: (err: unknown) => void): Dispatcher => {
        const connectBag: ConnectOptions = {
          ...(request.sslVerification === false ? { rejectUnauthorized: false } : {}),
        };
        if (attempt.proxy !== undefined && isSocks5ProxyUrl(attempt.proxy.url)) {
          return buildSocks5Agent(attempt.proxy, connectBag);
        }
        const inner =
          attempt.proxy !== undefined
            ? createDialConnector(connectBag, { alpnProtocols: ['http/1.1'], pinH2: false }, () => {}, undefined, {
                url: attempt.proxy.url,
                ...(attempt.proxy.credential !== undefined ? { credential: attempt.proxy.credential } : {}),
              })
            : buildConnector({
                ...connectBag,
                ...(request.unixSocketPath !== undefined ? { socketPath: request.unixSocketPath } : {}),
              });
        return new Agent({
          connect: (opts, cb) => {
            inner(opts, (err, sock) => {
              if (err !== null) {
                onDialError(err);
                cb(err, null);
                return;
              }
              if (sock === null) {
                const noSocket = new Error('the connector produced no socket');
                onDialError(noSocket);
                cb(noSocket, null);
                return;
              }
              cb(null, sock);
            });
          },
        });
      };

      // One dial attempt: mint the socket on its own dispatcher, wire
      // the session events. A pre-open close resolves the attempt as a
      // failure (the walker decides fall-through); everything after
      // `open` settles through the shared paths.
      const dialAttempt = (attempt: SessionProxyAttempt): Promise<WsAttemptOutcome> =>
        new Promise<WsAttemptOutcome>((resolveAttempt) => {
          let dialError: unknown = null;
          let lastError: unknown = null;
          let ws: UndiciWebSocket;
          try {
            dispatcher = mintDispatcher(attempt, (err) => {
              dialError = err;
            });
            ws = new UndiciWebSocket(request.url, {
              protocols: [...request.subprotocols],
              dispatcher,
              ...(request.headers.length > 0
                ? { headers: request.headers.map(({ key, value }) => [key, value] as [string, string]) }
                : {}),
            });
          } catch (err) {
            resolveAttempt({ settled: false, failure: err });
            return;
          }
          active = ws;
          ws.binaryType = 'arraybuffer';

          ws.addEventListener('open', () => {
            if (ended) return;
            opened = true;
            if (timer !== null) clearTimeout(timer);
            timer = null;
            const route: WsProxyRoute | undefined = attempt.route;
            callbacks.onOpen(ws.protocol, ws.extensions, route);
            resolveAttempt({ settled: true });
          });
          ws.addEventListener('message', (event) => {
            if (ended) return;
            const data = event.data;
            if (typeof data === 'string') {
              callbacks.onMessage({ data: new TextEncoder().encode(data), binary: false });
            } else if (data instanceof ArrayBuffer) {
              callbacks.onMessage({ data: new Uint8Array(data), binary: true });
            }
          });
          ws.addEventListener('error', (event) => {
            // The close event follows and settles; keep the real cause
            // for its classification (undici surfaces the dial error
            // here).
            const detail = event as { error?: unknown; message?: string };
            lastError = detail.error ?? new Error(detail.message ?? 'WebSocket error');
          });
          ws.addEventListener('close', (event) => {
            if (ended) {
              resolveAttempt({ settled: true });
              return;
            }
            if (!opened) {
              resolveAttempt({
                settled: false,
                failure: dialError ?? lastError ?? new Error(`the handshake failed (close code ${event.code})`),
              });
              return;
            }
            callbacks.onClose({ code: event.code, reason: event.reason, wasClean: event.wasClean });
            endComplete();
            resolveAttempt({ settled: true });
          });
        });

      const runConnect = async (): Promise<void> => {
        const resolver = options.environmentProxy !== undefined ? options.environmentProxy : environmentProxyResolver();
        const resolved = await resolveSessionProxyAttempts(
          {
            url: request.url,
            ...(request.unixSocketPath !== undefined ? { unixSocketPath: request.unixSocketPath } : {}),
            capability: 'socks5-dialable',
          },
          resolver,
        );
        if (ended) return;
        if ('errorMessage' in resolved) {
          // The honest pre-wire gate — the chain resolved only to
          // proxies this dial cannot traverse.
          settleError(resolved.errorMessage);
          return;
        }
        const attempts = resolved.attempts;
        for (let i = 0; i < attempts.length; i += 1) {
          if (ended) return;
          const attempt = attempts[i];
          attemptProxyUrl = attempt.proxy?.url;
          const outcome = await dialAttempt(attempt);
          if (outcome.settled) return;
          active = null;
          // Chain walking: a dial-level failure REACHING an
          // environment-plane proxy falls through to the next chain
          // entry (Chromium's own fallback semantics). Everything else
          // — CONNECT rejections, target-leg failures — surfaces.
          const nextExists = i < attempts.length - 1;
          if (attempt.environmentChain === true && nextExists && isSessionProxyDialFailure(outcome.failure)) {
            void dispatcher?.close();
            dispatcher = null;
            continue;
          }
          endWithError(outcome.failure);
          return;
        }
      };
      void runConnect();

      return {
        send(text: string): void {
          if (ended || active === null || active.readyState !== UndiciWebSocket.OPEN) return;
          active.send(text);
        },
        close(code: number, reason: string): void {
          if (
            ended ||
            active === null ||
            active.readyState === UndiciWebSocket.CLOSED ||
            active.readyState === UndiciWebSocket.CLOSING
          ) {
            return;
          }
          try {
            active.close(code, reason);
          } catch {
            // An invalid close code from a rider is a quiet no-op.
          }
        },
      };
    },
  };
}
