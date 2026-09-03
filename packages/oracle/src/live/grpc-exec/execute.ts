/**
 * gRPC invoke executor — host-neutral orchestration of one call:
 * resolve `{{ref}}` templates through the SAME 4-scope pipeline HTTP
 * sends ride, build the protobuf registry from the linked spec's LIVE
 * files (ids-only specLink — nothing cached), encode the composed
 * message, hand the wire exchange to the injected {@link GrpcTransport},
 * and map what came back onto an {@link ExecutedGrpcSnapshot}. Unary
 * calls run the buffered exchange here; the three streaming shapes
 * pass the same pre-wire gates and delegate the wire to
 * `execute-stream.ts` (a host without the transport's `openStream`
 * twin answers streaming invokes with a structured capability gap —
 * unary keeps working, the additive law).
 *
 * Failure discipline: everything that can go wrong before the wire —
 * no spec linked, method unresolved against the spec, malformed
 * message JSON, an encode mismatch, unresolved variables — returns a
 * STRUCTURED error snapshot naming the gap, never a throw. On the
 * wire, a non-zero grpc-status is a normal response (the surface
 * renders it honestly); only a call that never produced a response
 * head maps onto `error`.
 *
 * The sendId spine is the HTTP executor's: the caller-minted id
 * registers a Stop hook in the shared active-send registry, so
 * `abortRequestSend` cancels a gRPC invoke exactly like an HTTP send.
 * No live frames are emitted for unary — the resolving RPC's snapshot
 * carries the whole reply; streaming shapes feed the `grpcStreamEvent`
 * emitter the message timeline consumes.
 *
 * Script hooks (`script-plane.ts`) mount where a host runs scripts AND
 * some level carries one: Before invoke runs once after template
 * resolution and BEFORE the session credential mints (it mints onto
 * the metadata the hook leaves — the WebSocket dial's law), rewriting
 * the metadata rows and the composed message text; On message runs
 * after every captured frame either direction, on both wire legs, with
 * the frame decoded through the registry; After response runs once at
 * settle for a call that produced a head. The snapshot carries the
 * record and the position-stamped marks; every exit past the mount
 * releases the call's runtime context.
 */

import type { GrpcStreamEventWire } from '@openheaders/core/bridge';
import {
  buildRegistry,
  encodeMessage,
  extractGrpcStatus,
  ProtoCodecError,
  type ProtoSourceFile,
  parseProto,
  readGrpcFrames,
} from '@openheaders/core/proto';
import type { GrpcScriptKind } from '@openheaders/core/scripts';
import type { ExecutedGrpcSnapshot, GrpcRequest, Spec } from '@openheaders/core/types';
import { encodeBase64Bytes, generateUid } from '@openheaders/core/utils';
import { resolveTemplate } from '@openheaders/core/variables';
import { peekActiveWorkspaceId } from '../../workspace/extension-workspace-store';
import { sessionDialPolicy } from '../dial-policy';
import { collectionUidForRequest, resolveSessionAuth } from '../request-exec/ancestor-chain';
import type { OAuthRefreshFn } from '../request-exec/oauth2-bundle';
import { buildResolver } from '../request-exec/resolver-scope';
import { collectSlotChain, composeSlotChain, type SlotChainCarrier } from '../request-exec/script-chain';
import type { SessionScriptHost } from '../request-exec/script-hooks';
import { registerActiveSend } from '../request-exec/send-stream';
import { hasSessionScriptChains } from '../request-exec/session-script-plane';
import { mintSessionCredential, resolveSessionCredential } from '../session-credential';
import { sessionTlsPolicy } from '../tls-policy';
import { getTrustAnchorsForSend } from '../trust-anchors';
import { executeGrpcStream } from './execute-stream';
import { createGrpcScriptPlane, type GrpcScriptChains, grpcFrameSnapshot } from './script-plane';
import {
  GRPC_CANONICAL_CANCELLED,
  type GrpcTransport,
  GrpcTransportError,
  type GrpcTransportHeader,
} from './transport';

/** Response-body cap default — the HTTP executor's, same memory law;
 *  the request's `maxResponseBytes` raises or lowers it. */
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
   *  active-send registry (`abortRequestSend`); for streaming shapes
   *  it also keys the upstream-rider registry. */
  sendId?: string;
  /** Live-frame sink for streaming shapes (`grpcStreamEvent`
   *  broadcasts); frames only flow when `sendId` is present too.
   *  Unary never emits — the resolving snapshot carries the reply. */
  emitStreamEvent?: (event: GrpcStreamEventWire) => void;
  /** Host hook renewing an expired OAuth 2.0 token before the invoke
   *  attaches it; absent = the stored bundle attaches as it is. */
  refreshOAuth?: OAuthRefreshFn;
  /** Host script capability — the call's hooks (Before invoke / On
   *  message / After response) run through it; absent = the call runs
   *  scriptless and records no script outcome. */
  scriptHost?: SessionScriptHost;
  /** Host-injected ancestor script carriers (outer → inner) — the
   *  session executors' seam for hosts whose oracle mirrors are empty;
   *  absent = the executor walks the tree index per slot kind. */
  scriptChain?: readonly SlotChainCarrier[];
}

/** The three hooks' chains for the request — the ancestor levels'
 *  slots (injected, or off the tree index) onto the request's own. */
function grpcScriptChains(request: GrpcRequest, options: ExecuteGrpcInvokeOptions): GrpcScriptChains {
  const compose = (kind: GrpcScriptKind) =>
    options.scriptChain !== undefined
      ? composeSlotChain(options.scriptChain, request, kind)
      : collectSlotChain(request, options.workspaceId, kind);
  return {
    'grpc-before-invoke': compose('grpc-before-invoke'),
    'grpc-on-message': compose('grpc-on-message'),
    'grpc-after-response': compose('grpc-after-response'),
  };
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
  if (rpc.streaming !== 'unary' && options.transport.openStream === undefined) {
    return errorGrpcSnapshot(
      `${method.rpc} is a ${rpc.streaming} method — this host cannot open gRPC streams. Invoke it from a host with a native HTTP/2 stack.`,
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
    collectionId: collectionUidForRequest(request, scope.workspaceId),
    environmentId: options.environmentId,
  };
  // The workspace trust list rides the session dial — the pin the
  // scope resolved against, else the runtime-Active one.
  const trustedRootsPem = getTrustAnchorsForSend(scope.workspaceId ?? peekActiveWorkspaceId())?.pems;
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
  // Session credential — the request's own subset config, or Inherit
  // resolved over the ancestor pool chain (THE core rule). A resolved
  // type outside the gRPC mask fails the invoke by NAME — never a
  // silent none; every settled snapshot carries the attribution.
  const sessionAuth = resolveSessionAuth(
    'grpc',
    { uid: request.uid, path: request.path, url, auth: request.auth },
    scope.workspaceId,
  );
  const authAttribution = sessionAuth.attribution;
  const withAuth = (snapshot: ExecutedGrpcSnapshot): ExecutedGrpcSnapshot =>
    authAttribution !== undefined ? { ...snapshot, auth: authAttribution } : snapshot;
  if (sessionAuth.refusal !== null) return withAuth(errorGrpcSnapshot(sessionAuth.refusal));
  const authorityOverride = request.authority !== undefined ? resolveStr(request.authority).trim() : '';
  const channelKnobs = {
    ...(authorityOverride !== '' ? { authorityOverride } : {}),
    ...(request.keepaliveIntervalMs !== undefined ? { keepaliveIntervalMs: request.keepaliveIntervalMs } : {}),
    ...(request.keepaliveTimeoutMs !== undefined ? { keepaliveTimeoutMs: request.keepaliveTimeoutMs } : {}),
  };
  const tlsPolicy = sessionTlsPolicy({ request, trustedRootsPem, vault: scope.vault, resolve: resolveStr });
  const dialPolicy = sessionDialPolicy(request, scope.vault);
  let metadata: GrpcTransportHeader[] = [];
  for (const row of request.metadata) {
    if (row.enabled === false || !row.key.trim()) continue;
    const key = resolveStr(row.key);
    if (key.startsWith(':') || RESERVED_METADATA_KEYS.has(key.toLowerCase())) continue;
    metadata.push({ key, value: resolveStr(row.value) });
  }
  // Auth injection — the resolved credential becomes an `authorization`
  // metadata pair (an api-key rides its own key) at the SAME resolve
  // pass user rows ride, so the injected value is host-neutral
  // (in-process and forwarded invokes inject identically); it MINTS
  // once per invoke below (an OAuth 2.0 token read from the store, a
  // JWT stamped with the invoke's clock). An explicit user row carrying
  // the same key wins: injecting beside it would send the field twice.
  const credential = resolveSessionCredential(sessionAuth.auth, resolveStr);
  let messageText = resolveStr(request.message);
  if (unresolved.size > 0) {
    return withAuth(
      errorGrpcSnapshot(
        `Request has unresolved variables (${[...unresolved].join(', ')}). Define them in vault, environment, collection, or workspace before invoking.`,
      ),
    );
  }

  const authority = stripAuthorityScheme(url.trim());
  if (!authority) return withAuth(errorGrpcSnapshot('URL is empty'));

  // ── Script hooks — mounted only where a host runs scripts AND some
  // level carries one; a scriptless call never touches the plane.
  const scriptChains = options.scriptHost !== undefined ? grpcScriptChains(request, options) : null;
  const scripts =
    options.scriptHost !== undefined && scriptChains !== null && hasSessionScriptChains(scriptChains)
      ? createGrpcScriptPlane({
          sessionId: options.sendId ?? `grpc-${generateUid()}`,
          host: options.scriptHost,
          chains: scriptChains,
        })
      : null;
  /** Every exit past the mount: the record and the marks onto the
   *  snapshot, the call's runtime context released. */
  const finishScripts = (snapshot: ExecutedGrpcSnapshot): ExecutedGrpcSnapshot => {
    if (scripts === null) return snapshot;
    const record = scripts.summary();
    scripts.end();
    return record === undefined ? snapshot : { ...snapshot, scripts: record, scriptMarks: [...scripts.marks] };
  };
  if (scripts !== null) {
    // Before invoke sees the call as composed — the user's rows and
    // the message text resolved, no credential yet — once, before the
    // wire. Lenient: a failed level leaves its input as it was. The
    // reserved keys stay the transport's whatever a level wrote.
    const invoke = await scripts.beforeInvoke({
      target: authority,
      service: method.service,
      method: method.rpc,
      shape: rpc.streaming,
      metadata: metadata.map((m) => ({ key: m.key, value: m.value })),
      messageText,
    });
    metadata = invoke.metadata
      .filter((m) => !m.key.startsWith(':') && !RESERVED_METADATA_KEYS.has(m.key.toLowerCase()))
      .map((m) => ({ key: m.key, value: m.value }));
    messageText = invoke.messageText;
  }
  if (credential !== null) {
    let minted: Awaited<ReturnType<typeof mintSessionCredential>>;
    try {
      minted = await mintSessionCredential(credential, {
        url: `${request.tls !== false ? 'https' : 'http'}://${authority}/${method.service}/${method.rpc}`,
        headers: metadata,
        ...(options.workspaceId !== null ? { workspaceId: options.workspaceId } : {}),
        ...(options.refreshOAuth !== undefined ? { refreshOAuth: options.refreshOAuth } : {}),
        now: new Date(),
      });
    } catch (err) {
      return withAuth(finishScripts(errorGrpcSnapshot(err instanceof Error ? err.message : String(err))));
    }
    // A query placement never reaches a gRPC call — the mask refused
    // it by name — so the minted header pairs are the whole credential,
    // lowercased the way gRPC metadata keys ride.
    for (const pair of minted.headers) {
      const key = pair.key.toLowerCase();
      if (!metadata.some((m) => m.key.toLowerCase() === key)) metadata.push({ key, value: pair.value });
    }
  }

  // ── Message encode against the resolved input type ──
  // Client/bidi streams skip it: the composed text is what the Send
  // control writes LATER through `sendGrpcStreamMessage` — the invoke
  // itself opens an empty request stream.
  const encodesAtInvoke = rpc.streaming === 'unary' || rpc.streaming === 'server-streaming';
  let encoded: Uint8Array | null = null;
  if (encodesAtInvoke) {
    let composed: unknown;
    try {
      composed = messageText.trim() === '' ? {} : JSON.parse(messageText);
    } catch (err) {
      return withAuth(finishScripts(errorGrpcSnapshot(`The message is not valid JSON: ${(err as Error).message}`)));
    }
    try {
      encoded = encodeMessage(registry, rpc.inputType, composed);
    } catch (err) {
      if (err instanceof ProtoCodecError) {
        return withAuth(
          finishScripts(errorGrpcSnapshot(`The message does not match ${rpc.inputType}: ${err.message}`)),
        );
      }
      throw err;
    }
  }

  const maxBodyBytes = request.maxResponseBytes ?? MAX_BODY_BYTES;

  // ── Streaming shapes: the stream executor owns the wire from here ──
  if (rpc.streaming !== 'unary') {
    const streamSnapshot = await executeGrpcStream({
      transport: options.transport,
      authority,
      tls: request.tls !== false,
      ...tlsPolicy,
      ...dialPolicy,
      ...channelKnobs,
      path: `/${method.service}/${method.rpc}`,
      ...(request.unixSocketPath !== undefined ? { unixSocketPath: request.unixSocketPath } : {}),
      metadata,
      ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
      registry,
      inputType: rpc.inputType,
      outputType: rpc.outputType,
      shape: rpc.streaming,
      initialMessage: rpc.streaming === 'server-streaming' ? encoded : null,
      ...(options.sendId !== undefined ? { sendId: options.sendId } : {}),
      ...(options.emitStreamEvent !== undefined ? { emitEvent: options.emitStreamEvent } : {}),
      maxBodyBytes,
      ...(scripts !== null ? { scripts } : {}),
    });
    return withAuth(finishScripts(streamSnapshot));
  }
  if (encoded === null) {
    return withAuth(finishScripts(errorGrpcSnapshot('The unary message failed to encode.')));
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
        ...tlsPolicy,
        ...dialPolicy,
        ...channelKnobs,
        path: `/${method.service}/${method.rpc}`,
        ...(request.unixSocketPath !== undefined ? { unixSocketPath: request.unixSocketPath } : {}),
        metadata,
        message: encoded,
        ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
        maxBodyBytes,
      },
      controller?.signal,
    );
    const durationMs = Math.round(performance.now() - startedAt);
    const { frames, incomplete } = readGrpcFrames(response.body);
    const status = extractGrpcStatus(response.headers, response.trailers);
    const headers = response.headers.map((h) => ({ key: h.key, value: h.value }));
    const trailers = response.trailers.map((h) => ({ key: h.key, value: h.value }));
    const messages = frames.map((f) => ({ dataBase64: encodeBase64Bytes(f.data), compressed: f.flag !== 0 }));
    if (scripts !== null) {
      // The buffered exchange captured every frame at once — On message
      // runs per frame after the capture (the marks land past them),
      // then After response settles the record before the snapshot.
      scripts.captured(messages.length);
      messages.forEach((frame, index) => {
        scripts.onMessage(grpcFrameSnapshot(registry, { direction: 'down', type: rpc.outputType, ...frame, index }));
      });
      await scripts.afterResponse({
        httpStatus: response.httpStatus,
        status: status.code,
        ...(status.message !== undefined ? { statusMessage: status.message } : {}),
        statusSource: status.source,
        headers,
        trailers,
        sent: 1,
        received: messages.length,
        stopped: false,
        durationMs,
      });
    }
    return finishScripts({
      httpStatus: response.httpStatus,
      headers,
      trailers,
      grpcStatus: status.code,
      ...(status.message !== undefined ? { grpcMessage: status.message } : {}),
      grpcStatusSource: status.source,
      messages,
      ...(incomplete ? { incompleteTail: true } : {}),
      bodyTruncated: response.bodyTruncated,
      ...(response.bodyTruncated ? { bodyCapBytes: maxBodyBytes } : {}),
      bodyBytes: response.body.byteLength,
      durationMs,
      // Route wire truth: the transport reports which plane decided
      // (the request's own proxy setting, or the host's system plane)
      // and what it decided — recorded verbatim.
      ...(response.proxyRoute !== undefined ? { proxyRoute: response.proxyRoute } : {}),
      ...(response.connectionError !== undefined ? { connectionError: response.connectionError } : {}),
      requestMetadata: metadata.map((m) => ({ key: m.key, value: m.value })),
      ...(authAttribution !== undefined ? { auth: authAttribution } : {}),
      error: null,
    });
  } catch (err) {
    const durationMs = Math.round(performance.now() - startedAt);
    const message = stopped
      ? 'Call stopped before a response arrived.'
      : err instanceof GrpcTransportError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    // The client-runtime canonical code for the failure — a user stop
    // is the local cancel semantic (1 CANCELLED).
    const localStatus = stopped
      ? GRPC_CANONICAL_CANCELLED
      : err instanceof GrpcTransportError
        ? err.canonicalStatus
        : undefined;
    const hint = !stopped && err instanceof GrpcTransportError ? err.hint : undefined;
    return finishScripts({
      ...errorGrpcSnapshot(message),
      ...(authAttribution !== undefined ? { auth: authAttribution } : {}),
      requestMetadata: metadata.map((m) => ({ key: m.key, value: m.value })),
      ...(localStatus !== undefined ? { localStatus } : {}),
      ...(hint !== undefined ? { hint } : {}),
      durationMs,
    });
  } finally {
    unregister?.();
  }
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
