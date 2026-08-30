/**
 * gRPC streaming call executor — the wire leg `executeGrpcInvoke`
 * delegates to for the three streaming shapes once every pre-wire gate
 * has passed. One promise per call, resolving with the SAME
 * `ExecutedGrpcSnapshot` contract as unary: the capture records what
 * the call did — direction-tagged message frames in call order,
 * metadata and trailers verbatim, the status the reply actually
 * carried — and only a call that never produced a response head maps
 * onto `error`.
 *
 * Ceremony per shape: server-streaming writes the composed message and
 * half-closes immediately (the request stream is one message);
 * client/bidi open the call and register an upstream handle on the
 * active-stream registry — `sendGrpcStreamMessage` encodes and writes
 * through it, `endGrpcClientStream` half-closes ("End Streaming").
 *
 * Wire policy stays here, never in the transport: frames unwrap
 * through the core incremental reader, and the response byte cap is
 * counted off `onData` — past it the call aborts and the capture keeps
 * the truncated truth (the memory-bound law). Live frames ride the
 * flush-batched `grpcStreamEvent` emitter; timestamps on them are
 * session-only display data (the ratified Phase E law) — the snapshot
 * carries none.
 */

import type { GrpcStreamEventWire } from '@openheaders/core/bridge';
import {
  createGrpcFrameReader,
  encodeMessage,
  extractGrpcStatus,
  ProtoCodecError,
  type ProtoRegistry,
} from '@openheaders/core/proto';
import type {
  ExecutedGrpcMessageFrame,
  ExecutedGrpcSnapshot,
  ExecutedProxyRoute,
  ProxyMode,
  TlsVersion,
} from '@openheaders/core/types';
import { encodeBase64Bytes } from '@openheaders/core/utils';
import { pickSessionDialPolicy } from '../dial-policy';
import { registerActiveSend } from '../request-exec/send-stream';
import { pickSessionTlsPolicy } from '../tls-policy';
import { createGrpcStreamEmitter, registerActiveGrpcStream } from './stream-plane';
import {
  GRPC_CANONICAL_CANCELLED,
  type GrpcStreamWriter,
  type GrpcTransport,
  GrpcTransportError,
  type GrpcTransportHeader,
} from './transport';

export interface GrpcStreamExecuteParams {
  /** Host transport whose `openStream` presence the caller already gated. */
  transport: GrpcTransport;
  authority: string;
  tls: boolean;
  /** See {@link GrpcTransportRequest.sslVerification}. */
  sslVerification?: boolean;
  /** See {@link GrpcTransportRequest.trustedRootsPem}. */
  trustedRootsPem?: string[];
  /** See {@link GrpcTransportRequest.clientCertificateRef}. */
  clientCertificateRef?: string;
  clientCertificatePem?: string;
  clientCertificateKeyPem?: string;
  clientCertificatePassphrase?: string;
  /** See {@link GrpcTransportRequest.tlsMinVersion}. */
  tlsMinVersion?: TlsVersion;
  tlsMaxVersion?: TlsVersion;
  tlsCipherSuites?: string;
  /** See {@link GrpcTransportRequest.sniServerName}. */
  sniServerName?: string;
  /** See {@link GrpcTransportRequest.authorityOverride}. */
  authorityOverride?: string;
  path: string;
  /** See {@link GrpcTransportRequest.unixSocketPath}. */
  unixSocketPath?: string;
  /** See {@link GrpcTransportRequest.resolveToAddress}. */
  resolveToAddress?: string;
  /** See {@link GrpcTransportRequest.proxyMode}. */
  proxyMode?: ProxyMode;
  proxyUrl?: string;
  proxyCredentialRef?: string;
  proxyCredential?: string;
  metadata: ReadonlyArray<GrpcTransportHeader>;
  timeoutMs?: number;
  /** See {@link GrpcTransportRequest.keepaliveIntervalMs}. */
  keepaliveIntervalMs?: number;
  keepaliveTimeoutMs?: number;
  registry: ProtoRegistry;
  /** The rpc's resolved input type — upstream encodes ride it. */
  inputType: string;
  shape: 'server-streaming' | 'client-streaming' | 'bidi-streaming';
  /** The composed message, encoded — written + half-closed at open for
   *  server-streaming; null for client/bidi (upstream rides the RPC
   *  riders). */
  initialMessage: Uint8Array | null;
  /** Caller-minted id — Stop hook + upstream-rider registry key. */
  sendId?: string;
  /** Live-frame sink; frames only flow when both this and `sendId`
   *  are present. */
  emitEvent?: (event: GrpcStreamEventWire) => void;
  /** Response-body byte cap (framed wire bytes, the unary law). */
  maxBodyBytes: number;
}

export function executeGrpcStream(params: GrpcStreamExecuteParams): Promise<ExecutedGrpcSnapshot> {
  const openStream = params.transport.openStream;
  if (openStream === undefined) {
    return Promise.reject(new Error('executeGrpcStream requires a stream-capable transport'));
  }
  return new Promise<ExecutedGrpcSnapshot>((resolve) => {
    const emitter =
      params.sendId !== undefined && params.emitEvent !== undefined
        ? createGrpcStreamEmitter(params.sendId, params.emitEvent)
        : null;
    // The dispatched metadata truth, live — the sent row's expansion
    // needs no settle to be honest.
    emitter?.sent(params.metadata);
    const reader = createGrpcFrameReader();
    const controller = new AbortController();
    let stopped = false;
    let headArrived = false;
    let headAtMessage = 0;
    let settledResolve = false;
    let httpStatus = 0;
    let headers: Array<{ key: string; value: string }> = [];
    let trailers: Array<{ key: string; value: string }> = [];
    let proxyRoute: ExecutedProxyRoute | undefined;
    const messages: ExecutedGrpcMessageFrame[] = [];
    let bodyBytes = 0;
    let truncated = false;
    let halfClosed = false;
    const startedAt = performance.now();

    const unregisterSend =
      params.sendId !== undefined
        ? registerActiveSend(params.sendId, () => {
            stopped = true;
            controller.abort();
          })
        : null;
    let unregisterStream: (() => void) | null = null;

    const recordUpstream = (encoded: Uint8Array): void => {
      const dataBase64 = encodeBase64Bytes(encoded);
      messages.push({ dataBase64, compressed: false, direction: 'up' });
      emitter?.message({ direction: 'up', dataBase64, compressed: false, atMs: Date.now() });
    };

    const settle = (error?: Error): void => {
      if (settledResolve) return;
      settledResolve = true;
      unregisterSend?.();
      unregisterStream?.();
      emitter?.end();
      const durationMs = Math.round(performance.now() - startedAt);
      if (!headArrived) {
        const message = stopped
          ? 'Call stopped before a response arrived.'
          : (error?.message ?? 'The call ended before a response arrived.');
        // The client-runtime canonical code for the failure — a user
        // stop is the local cancel semantic (1 CANCELLED).
        const localStatus = stopped
          ? GRPC_CANONICAL_CANCELLED
          : error instanceof GrpcTransportError
            ? error.canonicalStatus
            : undefined;
        const hint = !stopped && error instanceof GrpcTransportError ? error.hint : undefined;
        resolve({
          httpStatus: 0,
          headers: [],
          trailers: [],
          grpcStatus: null,
          grpcStatusSource: null,
          messages: [],
          bodyTruncated: false,
          bodyBytes: 0,
          durationMs,
          requestMetadata: params.metadata.map((m) => ({ key: m.key, value: m.value })),
          error: message,
          ...(localStatus !== undefined ? { localStatus } : {}),
          ...(hint !== undefined ? { hint } : {}),
        });
        return;
      }
      const status = extractGrpcStatus(headers, trailers);
      resolve({
        httpStatus,
        headers,
        trailers,
        grpcStatus: status.code,
        ...(status.message !== undefined ? { grpcMessage: status.message } : {}),
        grpcStatusSource: status.source,
        messages,
        headAtMessage,
        ...(reader.pendingBytes() > 0 ? { incompleteTail: true } : {}),
        bodyTruncated: truncated,
        ...(truncated ? { bodyCapBytes: params.maxBodyBytes } : {}),
        bodyBytes,
        durationMs,
        ...(stopped ? { stopped: true } : {}),
        // A post-head transport error is the connection dying mid-call
        // — what arrived stands, the reason is named; the user's own
        // stop is not a loss.
        ...(!stopped && error !== undefined ? { connectionError: error.message } : {}),
        ...(proxyRoute !== undefined ? { proxyRoute } : {}),
        requestMetadata: params.metadata.map((m) => ({ key: m.key, value: m.value })),
        error: null,
      });
    };

    let writer: GrpcStreamWriter;
    try {
      writer = openStream.call(
        params.transport,
        {
          authority: params.authority,
          tls: params.tls,
          ...pickSessionTlsPolicy(params),
          ...pickSessionDialPolicy(params),
          ...(params.authorityOverride !== undefined ? { authorityOverride: params.authorityOverride } : {}),
          path: params.path,
          ...(params.unixSocketPath !== undefined ? { unixSocketPath: params.unixSocketPath } : {}),
          metadata: params.metadata,
          ...(params.timeoutMs !== undefined ? { timeoutMs: params.timeoutMs } : {}),
          ...(params.keepaliveIntervalMs !== undefined ? { keepaliveIntervalMs: params.keepaliveIntervalMs } : {}),
          ...(params.keepaliveTimeoutMs !== undefined ? { keepaliveTimeoutMs: params.keepaliveTimeoutMs } : {}),
        },
        {
          onHead: (status, incoming, route) => {
            headArrived = true;
            headAtMessage = messages.length;
            httpStatus = status;
            headers = incoming.map((h) => ({ key: h.key, value: h.value }));
            // Route wire truth: which plane decided and what — recorded
            // verbatim.
            if (route !== undefined) proxyRoute = route;
            emitter?.head(httpStatus, headers, headAtMessage, proxyRoute);
          },
          onData: (chunk) => {
            if (truncated) return;
            bodyBytes += chunk.byteLength;
            for (const frame of reader.push(chunk)) {
              const dataBase64 = encodeBase64Bytes(frame.data);
              const compressed = frame.flag !== 0;
              messages.push({ dataBase64, compressed, direction: 'down' });
              emitter?.message({ direction: 'down', dataBase64, compressed, atMs: Date.now() });
            }
            if (bodyBytes > params.maxBodyBytes) {
              truncated = true;
              controller.abort();
            }
          },
          onTrailers: (incoming) => {
            trailers = incoming.map((h) => ({ key: h.key, value: h.value }));
          },
          onEnd: (error) => settle(error),
        },
        controller.signal,
      );
    } catch (err) {
      settle(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    if (params.shape === 'server-streaming') {
      // The request stream is exactly the composed message.
      if (params.initialMessage !== null) {
        writer.sendMessage(params.initialMessage);
        recordUpstream(params.initialMessage);
      }
      writer.halfClose();
      return;
    }

    // Client/bidi: upstream rides the RPC riders until half-close.
    if (params.sendId !== undefined) {
      unregisterStream = registerActiveGrpcStream(params.sendId, {
        send: (messageText) => {
          if (settledResolve || halfClosed) return { success: false, error: 'The stream is no longer writable.' };
          let composed: unknown;
          try {
            composed = messageText.trim() === '' ? {} : JSON.parse(messageText);
          } catch (err) {
            return { success: false, error: `The message is not valid JSON: ${(err as Error).message}` };
          }
          let encoded: Uint8Array;
          try {
            encoded = encodeMessage(params.registry, params.inputType, composed);
          } catch (err) {
            if (err instanceof ProtoCodecError) {
              return { success: false, error: `The message does not match ${params.inputType}: ${err.message}` };
            }
            throw err;
          }
          writer.sendMessage(encoded);
          recordUpstream(encoded);
          return { success: true };
        },
        end: () => {
          if (settledResolve || halfClosed) return;
          halfClosed = true;
          writer.halfClose();
        },
      });
    }
  });
}
