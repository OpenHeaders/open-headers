/**
 * The delegating MQTT byte-stream transport — a {@link MqttByteTransport}
 * whose stream opens on ANOTHER host (the Execution Place plan's
 * delegated socket family), the `delegating-ws-transport` sibling for
 * the byte-shaped seam. The context's session executor keeps the
 * whole protocol — it encodes CONNECT and every packet, decodes the
 * broker's, runs the session's scripts and builds the snapshot; this
 * transport only moves the stream: the resolved dial rides the
 * `delegateMqttOpen` frame, the place's raw chunks feed `onData`,
 * writes ride `delegateMqttWrite` as base64 bytes, the clean end rides
 * `delegateMqttEnd`, and the executor's abort forwards as the place's
 * `delegateSocketAbort`. This is the reporter's case: an mqtt(s)://
 * dial no browser page can open, dialed by the desktop app on this
 * device with the extension still the session's context.
 */

import {
  DELEGATE_MQTT_END_CHANNEL,
  DELEGATE_MQTT_OPEN_CHANNEL,
  DELEGATE_MQTT_WRITE_CHANNEL,
  DELEGATE_SOCKET_ABORT_CHANNEL,
  type DelegatedSocketEvent,
} from '@openheaders/core/protocol';
import { decodeBase64Bytes } from '@openheaders/core/utils';
import type {
  MqttByteTransport,
  MqttStreamCallbacks,
  MqttStreamWriter,
  MqttTransportRequest,
} from '../mqtt-exec/transport';
import { MqttTransportError } from '../mqtt-exec/transport';
import { toBase64 } from '../request-exec/body-decode';
import { type DelegatedSocketWire, isDelegatedSocketOpenResult } from './wire';

export interface DelegatingMqttTransportOptions {
  wire: DelegatedSocketWire;
  /** The gate's subject on the place — the context's workspace. */
  workspaceId: string;
  /** Injectable for tests; defaults to a random UUID per socket. */
  mintSocketId?: () => string;
}

export interface DelegatingMqttTransport extends MqttByteTransport {
  /** The host that answered the last open; null before any answer. */
  executedOn(): { kind: 'backend'; name: string } | null;
}

export function createDelegatingMqttTransport(options: DelegatingMqttTransportOptions): DelegatingMqttTransport {
  const mintSocketId = options.mintSocketId ?? (() => crypto.randomUUID());
  let lastExecutedOn: { kind: 'backend'; name: string } | null = null;

  return {
    executedOn: () => lastExecutedOn,
    connect(request: MqttTransportRequest, callbacks: MqttStreamCallbacks, signal?: AbortSignal): MqttStreamWriter {
      const socketId = mintSocketId();
      let ended = false;
      let unsubscribe = (): void => {};
      const settle = (error?: MqttTransportError): void => {
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
          case 'connect':
            callbacks.onConnect(event.proxyRoute);
            return;
          case 'data': {
            const chunk = decodeBase64Bytes(event.dataBase64);
            if (chunk !== null) callbacks.onData(chunk);
            return;
          }
          case 'end':
            settle(
              event.error !== undefined ? new MqttTransportError(event.error.message, event.error.hint) : undefined,
            );
            return;
          default:
            // A WebSocket's events never address an MQTT stream.
            return;
        }
      });
      signal?.addEventListener('abort', onAbort, { once: true });
      void options.wire
        .call({ type: DELEGATE_MQTT_OPEN_CHANNEL, socketId, workspaceId: options.workspaceId, request: { ...request } })
        .then((answer) => {
          if (!isDelegatedSocketOpenResult(answer)) {
            settle(new MqttTransportError('The place gave no answer to the open.'));
            return;
          }
          lastExecutedOn = answer.executedOn ?? null;
          if (!answer.success) settle(new MqttTransportError(answer.error));
        })
        .catch((err: unknown) => {
          settle(new MqttTransportError(err instanceof Error ? err.message : String(err)));
        });
      return {
        write(bytes: Uint8Array): void {
          if (ended) return;
          void options.wire
            .call({ type: DELEGATE_MQTT_WRITE_CHANNEL, socketId, bytesBase64: toBase64(bytes) })
            .catch(() => {});
        },
        end(): void {
          if (ended) return;
          void options.wire.call({ type: DELEGATE_MQTT_END_CHANNEL, socketId }).catch(() => {});
        },
      };
    },
  };
}
