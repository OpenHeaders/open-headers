/**
 * Browser WebSocket transport — the browser host's implementation of
 * the engine's {@link WsTransport} seam over the platform-native
 * `WebSocket`, the `node-ws-transport.ts` twin for surfaces that
 * execute the session IN the page realm (the extension workbench).
 *
 * What the platform constructor supports is the whole knob surface:
 * the session URL and the subprotocol offer list. Custom handshake
 * headers and the TLS verification policy CANNOT apply here — the
 * executor still resolves and forwards them, and the calling surface
 * names the configured-but-inapplicable knobs in its Connect-side
 * honesty notice (never a silent drop, never a gate). The connect
 * deadline IS honored: `close()` during CONNECTING fails the handshake
 * with the same semantics as the node twin's timer.
 *
 * Wire ceremony owned here:
 *   - Frame types honest: `binaryType = 'arraybuffer'`; a text frame
 *     crosses the seam as its UTF-8 bytes with `binary: false`.
 *   - The Close event verbatim (`code`, `reason`, `wasClean`) — the
 *     executor maps the platform's 1006 no-Close-frame marker onto
 *     the honest `null` close; nothing is rewritten here.
 *   - Abort (the Stop hook): before the handshake it settles through
 *     `onEnd` with a classified error; after `onOpen` it closes the
 *     socket and settles `onEnd()` IMMEDIATELY with no error.
 *
 * Error classification is honest about the platform's limit: the
 * browser reports a failed dial as a bare error + close with no code
 * and no cause (deliberately — a page must not probe the network), so
 * the classified message names the host and says exactly that.
 */

import {
  type WsSessionCallbacks,
  type WsSessionWriter,
  type WsTransport,
  WsTransportError,
  type WsTransportRequest,
} from '@openheaders/oracle/live/ws-exec/transport';

/** `host[:port]` for messages — the full URL may carry params. */
function hostLabelOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Classify a pre-open failure. The platform exposes no reason, so the
 *  honest message says so instead of guessing a cause. */
function classifyBrowserWsFailure(url: string, err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  if (message !== '' && message !== 'aborted') {
    // A constructor throw (invalid URL, malformed subprotocol) carries
    // a real platform message — surface it verbatim.
    return message;
  }
  const host = hostLabelOf(url);
  return `Could not open a WebSocket session to ${host}. The browser reports no failure detail — check that a WebSocket server is listening there (and its certificate, for wss:).`;
}

export function createBrowserWsTransport(): WsTransport {
  return {
    connect(request: WsTransportRequest, callbacks: WsSessionCallbacks, signal?: AbortSignal): WsSessionWriter {
      let socket: WebSocket | null = null;
      let ended = false;
      let opened = false;
      let deadlineExpired = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = (): void => {
        if (timer !== null) clearTimeout(timer);
        timer = null;
        signal?.removeEventListener('abort', onAbort);
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
        callbacks.onEnd(new WsTransportError(classifyBrowserWsFailure(request.url, err)));
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
        socket = new WebSocket(request.url, [...request.subprotocols]);
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
            // close() during CONNECTING fails the handshake — the same
            // connect-deadline semantics as the node twin's timer.
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
        const data: unknown = event.data;
        if (typeof data === 'string') {
          callbacks.onMessage({ data: new TextEncoder().encode(data), binary: false });
        } else if (data instanceof ArrayBuffer) {
          callbacks.onMessage({ data: new Uint8Array(data), binary: true });
        }
      });
      ws.addEventListener('close', (event) => {
        if (ended) return;
        if (!opened) {
          // A pre-open close is the platform's whole story — no code,
          // no cause. `null` routes to the honest generic message.
          endWithError(null);
          return;
        }
        callbacks.onClose({ code: event.code, reason: event.reason, wasClean: event.wasClean });
        endComplete();
      });
      // A pre-open error IS the failed dial — settle on it directly:
      // browsers fire error-then-close (the close no-ops on `ended`),
      // but not every platform WebSocket delivers the close after a
      // failed dial (probed live: Node's built-in fires error only).
      // The event carries no failure detail on any of them.
      ws.addEventListener('error', () => {
        if (ended || opened) return;
        endWithError(null);
      });

      return {
        send(text: string): void {
          if (ended || ws.readyState !== WebSocket.OPEN) return;
          ws.send(text);
        },
        close(code: number, reason: string): void {
          if (ended || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) return;
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
