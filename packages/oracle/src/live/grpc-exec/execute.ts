/**
 * gRPC invoke executor — host-neutral orchestration of one unary call:
 * resolve `{{ref}}` templates through the SAME 4-scope pipeline HTTP
 * sends ride, build the protobuf registry from the linked spec's LIVE
 * files (ids-only specLink — nothing cached), encode the composed
 * message, hand the wire exchange to the injected {@link GrpcTransport},
 * and map what came back onto an {@link ExecutedGrpcSnapshot}.
 *
 * Failure discipline: everything that can go wrong before the wire —
 * no spec linked, method unresolved against the spec, a non-unary
 * shape, malformed message JSON, an encode mismatch, unresolved
 * variables — returns a STRUCTURED error snapshot naming the gap,
 * never a throw. On the wire, a non-zero grpc-status is a normal
 * response (the surface renders it honestly); only a call that never
 * produced a response head maps onto `error`.
 *
 * The sendId spine is the HTTP executor's: the caller-minted id
 * registers a Stop hook in the shared active-send registry, so
 * `abortRequestSend` cancels a gRPC invoke exactly like an HTTP send.
 * No live frames are emitted for unary — the resolving RPC's snapshot
 * carries the whole reply; the stream-frame emitter joins in Phase E
 * where a message timeline actually consumes it.
 */

import {
  buildRegistry,
  encodeMessage,
  extractGrpcStatus,
  ProtoCodecError,
  type ProtoSourceFile,
  parseProto,
  readGrpcFrames,
} from '@openheaders/core/proto';
import type { ExecutedGrpcSnapshot, GrpcRequest, Spec } from '@openheaders/core/types';
import { encodeBase64Bytes } from '@openheaders/core/utils';
import { resolveTemplate } from '@openheaders/core/variables';
import { getRequestCollections, getRequestCollectionsForWorkspace } from '../../entity/request-store';
import { buildResolver } from '../request-exec/resolver-scope';
import { registerActiveSend } from '../request-exec/send-stream';
import { type GrpcTransport, GrpcTransportError, type GrpcTransportHeader } from './transport';

/** Response-body cap — the HTTP executor's default, same memory law. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;

/** Metadata keys the transport owns — user rows carrying them are
 *  dropped rather than colliding with the wire ceremony. */
const RESERVED_METADATA_KEYS = new Set(['content-type', 'te', 'grpc-timeout']);

export interface ExecuteGrpcInvokeOptions {
  /** `null` = the runtime-Active workspace via the module mirrors;
   *  a string pins that workspace's scopes (forwarded sends). */
  workspaceId: string | null;
  /** Tri-state: string pins an env, explicit `null` resolves with no
   *  environment, absent defers to the scope's active pointer. */
  environmentId: string | null | undefined;
  /** Host wire capability. */
  transport: GrpcTransport;
  /** The linked Protobuf spec's LIVE entity, loaded by the host
   *  handler; `null` when the request has no link or the spec is gone. */
  spec: Spec | null;
  /** Caller-minted id — registers the Stop hook on the shared
   *  active-send registry (`abortRequestSend`). */
  sendId?: string;
}

export async function executeGrpcInvoke(
  request: GrpcRequest,
  options: ExecuteGrpcInvokeOptions,
): Promise<ExecutedGrpcSnapshot> {
  // ── Pre-wire gates, cheapest first ──
  if (request.method === undefined) {
    return errorGrpcSnapshot('No method selected. Pick a service method from the linked Protobuf spec.');
  }
  const method = request.method;
  if (options.spec === null) {
    return errorGrpcSnapshot(
      request.specLink === undefined
        ? 'No Protobuf spec linked. Link one on the Service definition tab to resolve the method.'
        : 'The linked Protobuf spec no longer exists. Re-link one on the Service definition tab.',
    );
  }

  // ── Registry from the spec's live files ──
  const files: ProtoSourceFile[] = [];
  for (const file of options.spec.files) {
    try {
      files.push({ path: file.fileName, census: parseProto(file.content) });
    } catch (err) {
      return errorGrpcSnapshot(`The spec file ${file.fileName} does not parse: ${(err as Error).message}`);
    }
  }
  const registry = buildRegistry(files);
  const service = registry.services.find((s) => s.fullName === method.service);
  const rpc = service?.rpcs.find((r) => r.name === method.rpc);
  if (service === undefined || rpc === undefined) {
    return errorGrpcSnapshot(
      `The spec "${options.spec.name}" does not declare ${method.service}/${method.rpc}. Re-pick the method.`,
    );
  }
  if (rpc.streaming !== 'unary') {
    return errorGrpcSnapshot(
      `${method.rpc} is a ${rpc.streaming} method — only unary methods can be invoked in this version.`,
    );
  }
  if (rpc.inputType === null || !registry.messages.has(rpc.inputType)) {
    return errorGrpcSnapshot(
      `The request type of ${method.service}/${method.rpc} does not resolve in the linked spec.`,
    );
  }

  // ── Variable resolution (the HTTP sends' exact pipeline) ──
  const { resolver, context: scope } = await buildResolver(options.workspaceId ?? undefined);
  const context = {
    collectionId: collectionIdForPath(request.path, scope.workspaceId),
    environmentId: options.environmentId,
  };
  const unresolved = new Set<string>();
  const resolveStr = (s: string): string => {
    const result = resolveTemplate(
      s,
      (name) => resolver.resolve(name, context),
      (name, ns) => resolver.resolveScopedWithDiagnostics(name, ns, context),
    );
    for (const v of result.variables) {
      if (!v.resolved) unresolved.add(v.name);
    }
    return result.result;
  };

  const url = resolveStr(request.url);
  const metadata: GrpcTransportHeader[] = [];
  for (const row of request.metadata) {
    if (row.enabled === false || !row.key.trim()) continue;
    const key = resolveStr(row.key);
    if (key.startsWith(':') || RESERVED_METADATA_KEYS.has(key.toLowerCase())) continue;
    metadata.push({ key, value: resolveStr(row.value) });
  }
  const messageText = resolveStr(request.message);
  if (unresolved.size > 0) {
    return errorGrpcSnapshot(
      `Request has unresolved variables (${[...unresolved].join(', ')}). Define them in vault, environment, collection, or workspace before invoking.`,
    );
  }

  const authority = stripAuthorityScheme(url.trim());
  if (!authority) return errorGrpcSnapshot('URL is empty');

  // ── Message encode against the resolved input type ──
  let composed: unknown;
  try {
    composed = messageText.trim() === '' ? {} : JSON.parse(messageText);
  } catch (err) {
    return errorGrpcSnapshot(`The message is not valid JSON: ${(err as Error).message}`);
  }
  let encoded: Uint8Array;
  try {
    encoded = encodeMessage(registry, rpc.inputType, composed);
  } catch (err) {
    if (err instanceof ProtoCodecError) {
      return errorGrpcSnapshot(`The message does not match ${rpc.inputType}: ${err.message}`);
    }
    throw err;
  }

  // ── Wire exchange on the sendId spine ──
  const controller = options.sendId !== undefined ? new AbortController() : null;
  let stopped = false;
  const unregister =
    options.sendId !== undefined && controller !== null
      ? registerActiveSend(options.sendId, () => {
          stopped = true;
          controller.abort();
        })
      : null;
  const startedAt = performance.now();
  try {
    const response = await options.transport.invoke(
      {
        authority,
        tls: request.tls !== false,
        path: `/${method.service}/${method.rpc}`,
        metadata,
        message: encoded,
        ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
        maxBodyBytes: MAX_BODY_BYTES,
      },
      controller?.signal,
    );
    const durationMs = Math.round(performance.now() - startedAt);
    const { frames, incomplete } = readGrpcFrames(response.body);
    const status = extractGrpcStatus(response.headers, response.trailers);
    return {
      httpStatus: response.httpStatus,
      headers: response.headers.map((h) => ({ key: h.key, value: h.value })),
      trailers: response.trailers.map((h) => ({ key: h.key, value: h.value })),
      grpcStatus: status.code,
      ...(status.message !== undefined ? { grpcMessage: status.message } : {}),
      grpcStatusSource: status.source,
      messages: frames.map((f) => ({ dataBase64: encodeBase64Bytes(f.data), compressed: f.flag !== 0 })),
      ...(incomplete ? { incompleteTail: true } : {}),
      bodyTruncated: response.bodyTruncated,
      ...(response.bodyTruncated ? { bodyCapBytes: MAX_BODY_BYTES } : {}),
      bodyBytes: response.body.byteLength,
      durationMs,
      error: null,
    };
  } catch (err) {
    const durationMs = Math.round(performance.now() - startedAt);
    const message = stopped
      ? 'Call stopped before a response arrived.'
      : err instanceof GrpcTransportError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    return { ...errorGrpcSnapshot(message), durationMs };
  } finally {
    unregister?.();
  }
}

/** The collection whose variables scope this request — same
 *  path-prefix membership the HTTP resolver uses. */
function collectionIdForPath(path: string, workspaceId: string | null): string | undefined {
  const collections = workspaceId ? getRequestCollectionsForWorkspace(workspaceId) : getRequestCollections();
  return collections.find((c) => path.startsWith(`${c.path}/`))?.uid;
}

/**
 * The schema's authority is scheme-free, but a pasted target often
 * carries one — strip the schemes users actually paste rather than
 * failing the connect on a malformed authority. The TLS question
 * stays with the editor's lock flag.
 */
export function stripAuthorityScheme(url: string): string {
  return url.replace(/^(?:grpcs?|https?):\/\//i, '').replace(/\/+$/, '');
}

export function errorGrpcSnapshot(message: string): ExecutedGrpcSnapshot {
  return {
    httpStatus: 0,
    headers: [],
    trailers: [],
    grpcStatus: null,
    grpcStatusSource: null,
    messages: [],
    bodyTruncated: false,
    bodyBytes: 0,
    durationMs: 0,
    error: message,
  };
}
