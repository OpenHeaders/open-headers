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
 *   - Socket-path dial: `unixSocketPath` rides the per-connect agent's
 *     connector as undici's `socketPath` — the dial-winning `path`
 *     into net/tls.connect, so the URL's host stays cosmetic for
 *     dialing while the handshake `Host`, SNI, and certificate
 *     verification keep it.
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
 * `cause` chain.
 */

import {
  type WsSessionCallbacks,
  type WsSessionWriter,
  type WsTransport,
  WsTransportError,
  type WsTransportRequest,
} from '@openheaders/oracle/live/ws-exec/transport';
import { Agent, buildConnector, WebSocket as UndiciWebSocket } from 'undici';

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
function classifyWsFailure(url: string, err: unknown, socketPath?: string): string {
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

export function createNodeWsTransport(): WsTransport {
  return {
    connect(request: WsTransportRequest, callbacks: WsSessionCallbacks, signal?: AbortSignal): WsSessionWriter {
      let socket: UndiciWebSocket | null = null;
      let dispatcher: Agent | null = null;
      let ended = false;
      let opened = false;
      let lastError: unknown = null;
      let dialError: unknown = null;
      let deadlineExpired = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = (): void => {
        if (timer !== null) clearTimeout(timer);
        timer = null;
        signal?.removeEventListener('abort', onAbort);
        // Closing the per-connect agent releases its sockets; the
        // default global dispatcher is never ours to close.
        void dispatcher?.close();
        dispatcher = null;
      };
      const endWithError = (err: unknown): void => {
        if (ended) return;
        ended = true;
        cleanup();
        if (deadlineExpired) {
          callbacks.onEnd(
            new WsTransportError(`Connect deadline of ${request.timeoutMs} ms elapsed before the session opened.`),
          );
          return;
        }
        if (signal?.aborted) {
          callbacks.onEnd(new WsTransportError('Session stopped before it connected.'));
          return;
        }
        callbacks.onEnd(new WsTransportError(classifyWsFailure(request.url, err, request.unixSocketPath)));
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
          socket?.close();
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

      try {
        // A per-connect agent with a wrapped connector: undici's
        // WebSocket layer swallows dial failures into a bare event
        // (probed live — no `code`, no `cause`), so the connector is
        // the only place the real ECONNREFUSED/DNS/TLS error exists.
        // Captured here, classified on settle. `socketPath` pins the
        // dial to the local socket / named pipe — undici passes it as
        // the dial-winning `path` into net/tls.connect, so the URL's
        // host stays cosmetic for dialing while the handshake `Host`,
        // SNI, and certificate verification keep it.
        const connector = buildConnector({
          ...(request.sslVerification === false ? { rejectUnauthorized: false } : {}),
          ...(request.unixSocketPath !== undefined ? { socketPath: request.unixSocketPath } : {}),
        });
        dispatcher = new Agent({
          connect: (opts, cb) => {
            connector(opts, (err, sock) => {
              if (err !== null) {
                dialError = err;
                cb(err, null);
                return;
              }
              if (sock === null) {
                const noSocket = new Error('the connector produced no socket');
                dialError = noSocket;
                cb(noSocket, null);
                return;
              }
              cb(null, sock);
            });
          },
        });
        socket = new UndiciWebSocket(request.url, {
          protocols: [...request.subprotocols],
          dispatcher,
          ...(request.headers.length > 0
            ? { headers: request.headers.map(({ key, value }) => [key, value] as [string, string]) }
            : {}),
        });
      } catch (err) {
        queueMicrotask(() => endWithError(err));
        return { send: () => {}, close: () => {} };
      }
      const ws = socket;
      ws.binaryType = 'arraybuffer';

      if (request.timeoutMs !== undefined) {
        timer = setTimeout(() => {
          if (opened) return;
          deadlineExpired = true;
          try {
            ws.close();
          } catch {
            // Ignore — the deadline settle below is the story.
          }
          endWithError(new Error('connect deadline elapsed'));
        }, request.timeoutMs);
      }
      signal?.addEventListener('abort', onAbort);

      ws.addEventListener('open', () => {
        if (ended) return;
        opened = true;
        if (timer !== null) clearTimeout(timer);
        timer = null;
        callbacks.onOpen(ws.protocol, ws.extensions);
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
        // The close event follows and settles; keep the real cause for
        // its classification (undici surfaces the dial error here).
        const detail = event as { error?: unknown; message?: string };
        lastError = detail.error ?? new Error(detail.message ?? 'WebSocket error');
      });
      ws.addEventListener('close', (event) => {
        if (ended) return;
        if (!opened) {
          endWithError(dialError ?? lastError ?? new Error(`the handshake failed (close code ${event.code})`));
          return;
        }
        callbacks.onClose({ code: event.code, reason: event.reason, wasClean: event.wasClean });
        endComplete();
      });

      return {
        send(text: string): void {
          if (ended || ws.readyState !== UndiciWebSocket.OPEN) return;
          ws.send(text);
        },
        close(code: number, reason: string): void {
          if (ended || ws.readyState === UndiciWebSocket.CLOSED || ws.readyState === UndiciWebSocket.CLOSING) return;
          try {
            ws.close(code, reason);
          } catch {
            // An invalid close code from a rider is a quiet no-op.
          }
        },
      };
    },
  };
}
