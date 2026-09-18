/**
 * The delegating WebSocket transport — a {@link WsTransport} whose
 * socket opens on ANOTHER host (the Execution Place plan's delegated
 * socket family). The context's session executor keeps everything: it
 * resolves the handshake, runs the session's scripts, keeps the
 * timeline and builds the snapshot; this transport only moves the
 * socket — the resolved handshake rides the `delegateWsOpen` frame to
 * the place, the place's raw events feed the executor's callbacks, and
 * the writer's sends and close ride riders keyed by the socket id
 * this transport mints. The executor's abort signal (Stop) forwards as
 * the place's `delegateSocketAbort`, which settles through `onEnd`
 * like an in-process teardown.
 *
 * Host-neutral: the wire is injected — the extension's page realm
 * rides its service worker (which rides the backend wire), the
 * desktop app's main process rides its backend client directly. One
 * instance serves one session; `executedOn()` names the host that
 * answered the open, for the snapshot's stamp.
 */

import {
  DELEGATE_SOCKET_ABORT_CHANNEL,
  DELEGATE_WS_CLOSE_CHANNEL,
  DELEGATE_WS_OPEN_CHANNEL,
  DELEGATE_WS_SEND_CHANNEL,
  type DelegatedSocketEvent,
} from '@openheaders/core/protocol';
import { decodeBase64Bytes } from '@openheaders/core/utils';
import { toBase64 } from '../request-exec/body-decode';
import type { WsSessionCallbacks, WsSessionWriter, WsTransport, WsTransportRequest } from '../ws-exec/transport';
import { WsTransportError } from '../ws-exec/transport';
import { type DelegatedSocketWire, isDelegatedSocketOpenResult } from './wire';

export interface DelegatingWsTransportOptions {
  wire: DelegatedSocketWire;
  /** The gate's subject on the place — the context's workspace. */
  workspaceId: string;
  /** Injectable for tests; defaults to a random UUID per socket. */
  mintSocketId?: () => string;
}

export interface DelegatingWsTransport extends WsTransport {
  /** The host that answered the last open; null before any answer. */
  executedOn(): { kind: 'backend'; name: string } | null;
}

export function createDelegatingWsTransport(options: DelegatingWsTransportOptions): DelegatingWsTransport {
  const mintSocketId = options.mintSocketId ?? (() => crypto.randomUUID());
  let lastExecutedOn: { kind: 'backend'; name: string } | null = null;

  return {
    executedOn: () => lastExecutedOn,
    connect(request: WsTransportRequest, callbacks: WsSessionCallbacks, signal?: AbortSignal): WsSessionWriter {
      const socketId = mintSocketId();
      let ended = false;
      let unsubscribe = (): void => {};
      const settle = (error?: WsTransportError): void => {
        if (ended) return;
        ended = true;
        unsubscribe();
        signal?.removeEventListener('abort', onAbort);
        callbacks.onEnd(error);
      };
      const onAbort = (): void => {
        if (ended) return;
        void options.wire.call({ type: DELEGATE_SOCKET_ABORT_CHANNEL, socketId }).catch(() => {});
      };
      unsubscribe = options.wire.subscribe(socketId, (event: DelegatedSocketEvent) => {
        if (ended) return;
        switch (event.kind) {
          case 'open':
            callbacks.onOpen(event.protocol, event.extensions, event.proxyRoute);
            return;
          case 'message': {
            const data = decodeBase64Bytes(event.dataBase64);
            if (data !== null) callbacks.onMessage({ data, binary: event.binary });
            return;
          }
          case 'close':
            callbacks.onClose({ code: event.code, reason: event.reason, wasClean: event.wasClean });
            return;
          case 'end':
            settle(event.error !== undefined ? new WsTransportError(event.error.message, event.error.hint) : undefined);
            return;
          default:
            // The MQTT stream's events never address a WebSocket socket.
            return;
        }
      });
      signal?.addEventListener('abort', onAbort, { once: true });
      void options.wire
        .call({
          type: DELEGATE_WS_OPEN_CHANNEL,
          socketId,
          workspaceId: options.workspaceId,
          request: { ...request, headers: [...request.headers], subprotocols: [...request.subprotocols] },
        })
        .then((answer) => {
          if (!isDelegatedSocketOpenResult(answer)) {
            settle(new WsTransportError('The place gave no answer to the open.'));
            return;
          }
          lastExecutedOn = answer.executedOn ?? null;
          if (!answer.success) settle(new WsTransportError(answer.error));
        })
        .catch((err: unknown) => {
          // A dead wire or the place's refusal — already a user-facing
          // sentence (the protocol's opt-in strings, the capability denial).
          settle(new WsTransportError(err instanceof Error ? err.message : String(err)));
        });
      return {
        send(text: string): void {
          if (ended) return;
          void options.wire.call({ type: DELEGATE_WS_SEND_CHANNEL, socketId, text }).catch(() => {});
        },
        sendBinary(data: Uint8Array): void {
          if (ended) return;
          void options.wire
            .call({ type: DELEGATE_WS_SEND_CHANNEL, socketId, binaryBase64: toBase64(data) })
            .catch(() => {});
        },
        close(code: number, reason: string): void {
          if (ended) return;
          void options.wire.call({ type: DELEGATE_WS_CLOSE_CHANNEL, socketId, code, reason }).catch(() => {});
        },
      };
    },
  };
}
