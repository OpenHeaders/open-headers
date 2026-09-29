/**
 * The delegating gRPC transport — a {@link GrpcTransport} whose HTTP/2
 * session opens on ANOTHER host (the Execution Place plan's delegated
 * family, the last kind brought under its law). The context's
 * executor keeps everything: it resolves the call, builds the registry
 * from the spec it holds, encodes every message, runs the call's
 * scripts, unwraps the frames and builds the snapshot; this transport
 * only moves the wire. A unary call rides one `delegateGrpcInvoke`
 * frame and comes back whole (the `delegateRequest` twin, the Stop
 * forwarded as the place's `abortRequestSend`); a streaming call rides
 * the socket family — the resolved dial on `delegateGrpcOpen`, the
 * place's raw events (head, framed body chunks, trailers, end) feeding
 * the seam's callbacks, the writer's messages and half-close as riders
 * keyed by the socket id this transport mints, the executor's abort as
 * the place's `delegateSocketAbort`, which settles through `onEnd` like
 * an in-process teardown.
 *
 * Host-neutral: the wire is injected — the extension's page realm
 * rides its service worker (which rides the backend wire), the desktop
 * app's main process rides its backend client directly. One instance
 * serves one call; `executedOn()` names the host that answered, for
 * the snapshot's stamp.
 */

import {
  DELEGATE_GRPC_HALF_CLOSE_CHANNEL,
  DELEGATE_GRPC_INVOKE_CHANNEL,
  DELEGATE_GRPC_OPEN_CHANNEL,
  DELEGATE_GRPC_SEND_CHANNEL,
  DELEGATE_SOCKET_ABORT_CHANNEL,
  type DelegatedSocketEndError,
  type DelegatedSocketEvent,
} from '@openheaders/core/protocol';
import { decodeBase64Bytes } from '@openheaders/core/utils';
import { toBase64 } from '../request-exec/body-decode';
import {
  type DelegatedGrpcExecutedOn,
  type DelegatedGrpcWire,
  decodeDelegatedGrpcResponse,
  encodeDelegatedGrpcRequest,
  encodeDelegatedGrpcStreamRequest,
  isDelegatedGrpcInvokeResult,
} from './delegated-wire';
import {
  type GrpcStreamCallbacks,
  type GrpcStreamWriter,
  type GrpcTransport,
  GrpcTransportError,
  type GrpcTransportRequest,
  type GrpcTransportResponse,
  type GrpcTransportStreamRequest,
} from './transport';

export interface DelegatingGrpcTransportOptions {
  wire: DelegatedGrpcWire;
  /** The gate's subject on the place — the context's workspace. */
  workspaceId: string;
  /** Injectable for tests; defaults to a random UUID per call. */
  mintId?: () => string;
}

export interface DelegatingGrpcTransport extends GrpcTransport {
  /** The host that answered the last call; null before any answer. */
  executedOn(): DelegatedGrpcExecutedOn | null;
}

/** The place's classified end onto the seam's error. */
function endError(error: DelegatedSocketEndError): GrpcTransportError {
  return new GrpcTransportError(error.message, error.canonicalStatus, error.hint);
}

export function createDelegatingGrpcTransport(options: DelegatingGrpcTransportOptions): DelegatingGrpcTransport {
  const mintId = options.mintId ?? (() => crypto.randomUUID());
  let lastExecutedOn: DelegatedGrpcExecutedOn | null = null;

  return {
    executedOn: () => lastExecutedOn,

    async invoke(request: GrpcTransportRequest, signal?: AbortSignal): Promise<GrpcTransportResponse> {
      const sendId = mintId();
      const onAbort = (): void => options.wire.abort(sendId);
      signal?.addEventListener('abort', onAbort, { once: true });
      try {
        const answer = await options.wire.invoke({
          type: DELEGATE_GRPC_INVOKE_CHANNEL,
          sendId,
          workspaceId: options.workspaceId,
          request: encodeDelegatedGrpcRequest(request),
        });
        if (!isDelegatedGrpcInvokeResult(answer)) throw new GrpcTransportError('The place gave no answer to the call.');
        lastExecutedOn = answer.executedOn;
        if (!answer.success) throw new GrpcTransportError(answer.error, answer.canonicalStatus, answer.hint);
        const response = decodeDelegatedGrpcResponse(answer.response);
        if (response === null) throw new GrpcTransportError('The place answered a reply that does not decode.');
        return response;
      } catch (err) {
        if (err instanceof GrpcTransportError) throw err;
        // A dead wire or the place's refusal — already a user-facing
        // sentence (the protocol's opt-in strings, the capability denial).
        throw new GrpcTransportError(err instanceof Error ? err.message : String(err));
      } finally {
        signal?.removeEventListener('abort', onAbort);
      }
    },

    openStream(
      request: GrpcTransportStreamRequest,
      callbacks: GrpcStreamCallbacks,
      signal?: AbortSignal,
    ): GrpcStreamWriter {
      const socketId = mintId();
      let ended = false;
      let unsubscribe = (): void => {};
      const settle = (error?: GrpcTransportError): void => {
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
          case 'head':
            callbacks.onHead(event.httpStatus, event.headers, event.proxyRoute);
            return;
          case 'data': {
            const chunk = decodeBase64Bytes(event.dataBase64);
            if (chunk !== null) callbacks.onData(new Uint8Array(chunk));
            return;
          }
          case 'trailers':
            callbacks.onTrailers(event.trailers);
            return;
          case 'end':
            settle(event.error !== undefined ? endError(event.error) : undefined);
            return;
          default:
            // The WebSocket's and the MQTT stream's events never address a gRPC call.
            return;
        }
      });
      signal?.addEventListener('abort', onAbort, { once: true });
      void options.wire
        .call({
          type: DELEGATE_GRPC_OPEN_CHANNEL,
          socketId,
          workspaceId: options.workspaceId,
          request: encodeDelegatedGrpcStreamRequest(request),
        })
        .then((answer) => {
          if (!answer || typeof answer !== 'object') {
            settle(new GrpcTransportError('The place gave no answer to the open.'));
            return;
          }
          const { success, error, executedOn } = answer as {
            success?: unknown;
            error?: unknown;
            executedOn?: unknown;
          };
          if (executedOn && typeof executedOn === 'object') lastExecutedOn = executedOn as DelegatedGrpcExecutedOn;
          if (success === true) return;
          settle(new GrpcTransportError(typeof error === 'string' ? error : 'The place gave no answer to the open.'));
        })
        .catch((err: unknown) => {
          settle(new GrpcTransportError(err instanceof Error ? err.message : String(err)));
        });
      return {
        sendMessage(message: Uint8Array): void {
          if (ended) return;
          void options.wire
            .call({ type: DELEGATE_GRPC_SEND_CHANNEL, socketId, messageBase64: toBase64(message) })
            .catch(() => {});
        },
        halfClose(): void {
          if (ended) return;
          void options.wire.call({ type: DELEGATE_GRPC_HALF_CLOSE_CHANNEL, socketId }).catch(() => {});
        },
      };
    },
  };
}
