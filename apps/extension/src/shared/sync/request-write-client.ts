/**
 * Renderer-side imperative entry point for Request writes.
 *
 * Mirrors {@link rule-write-client}: write sites build a `MutationBatch`
 * against the active request mirror and fire `oh.sync.apply` directly —
 * no SW round-trip per write, no `updateLocalRequest` shim. The
 * synchronous-render discipline (§19.4) lives in the editors; this
 * helper is what they reach for once the user commits.
 *
 * `useRequestMutator` is the React-friendly wrapper. Surfaces that live
 * outside that hook (future drag-reorder or inline-popover gestures)
 * call the imperative functions directly with an explicit workspace id.
 */

import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import {
  ensureRendererContext,
  type RendererContextHandle,
} from '@/context/rule-mutator-context';
import {
  getActiveRequestSyncMirror,
  type RequestSyncMirror,
} from '@/context/request-sync-mirror';
import {
  buildAddBatch,
  buildDeleteBatch,
  buildUpdateBatch,
  type RequestMutationPayload,
} from '@/shared/sync/request-mutations';

export type RequestUpdates = Partial<Omit<V5.Request, 'uid' | 'path' | 'schemaVersion'>>;

export type RequestMutationResult =
  | { ok: true; request: V5.Request }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export type RequestSimpleResult =
  | { ok: true }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export interface RequestWriteOptions {
  workspaceId: string;
  surfaceId: string;
  /** Optional batchId so multi-mutation gestures share one all-or-nothing batch. */
  batchId?: string;
  /** Override the singleton mirror for tests. */
  mirror?: RequestSyncMirror;
  /** Override the renderer context handle for tests. */
  context?: RendererContextHandle;
}

function resolveMirror(opts: RequestWriteOptions): RequestSyncMirror {
  return opts.mirror ?? getActiveRequestSyncMirror();
}

function resolveContext(opts: RequestWriteOptions): RendererContextHandle {
  if (opts.context) return opts.context;
  return ensureRendererContext({ workspaceId: opts.workspaceId, surfaceId: opts.surfaceId });
}

async function applyPayload(payload: RequestMutationPayload): Promise<RequestSimpleResult> {
  if (payload.batch.mutations.length === 0) return { ok: true };
  try {
    const resp = await call('oh.sync.apply', { batch: payload.batch, sideEffects: payload.sideEffects });
    if (resp.ok) return { ok: true };
    return { ok: false, reason: 'other', message: resp.failure?.detail };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return { ok: false, reason: 'other', message };
  }
}

/**
 * Apply a partial Request patch through the local oracle. Returns
 * `{ ok: true, request }` with an optimistic merge of `updates` into
 * the mirror's pre-image so callers that need a post-commit snapshot
 * get one without waiting for the broadcast round-trip.
 */
export async function applyRequestUpdate(
  requestUid: string,
  updates: RequestUpdates,
  opts: RequestWriteOptions,
): Promise<RequestMutationResult> {
  const mirror = resolveMirror(opts);
  const entry = mirror.getRequestMirror(requestUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  // Renderer-side adapter: combine the mirror's order keys with the
  // canonical request snapshot to find each row's content via uid
  // lookup. The diff-detect needs `(itemId, orderKey, item)` triplets to
  // distinguish pure-reorder from content edits.
  const payload = buildUpdateBatch(requestUid, updates, ctx, (uid, path) => {
    const orderKeys = mirror.liveOrderedSetItems(uid, path);
    if (orderKeys.length === 0) return [];
    const snap = mirror.getRequestMirror(uid)?.request;
    const rows: ReadonlyArray<{ uid: string }> | undefined =
      snap && path === 'headers' ? snap.headers : snap && path === 'params' ? snap.params : undefined;
    if (!rows) return orderKeys.map((e) => ({ itemId: e.itemId, orderKey: e.orderKey, item: undefined }));
    const byUid = new Map<string, unknown>();
    for (const row of rows) byUid.set(row.uid, row);
    return orderKeys.map((e) => ({ itemId: e.itemId, orderKey: e.orderKey, item: byUid.get(e.itemId) }));
  });
  const ack = await applyPayload(payload);
  if (ack.ok) {
    return { ok: true, request: { ...entry.request, ...updates } as V5.Request };
  }
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

/** Seed a brand-new request through the oracle. Caller mints the full
 *  `V5.Request` shape; the helper handles the create + per-row addToSet
 *  envelopes via the projection layer. */
export async function applyRequestCreate(
  request: V5.Request,
  opts: RequestWriteOptions,
): Promise<RequestSimpleResult> {
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildAddBatch(request, ctx);
  return applyPayload(payload);
}

export async function applyRequestDelete(
  requestUid: string,
  opts: RequestWriteOptions,
): Promise<RequestSimpleResult> {
  const mirror = resolveMirror(opts);
  if (!mirror.getRequestMirror(requestUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildDeleteBatch(requestUid, ctx);
  return applyPayload(payload);
}
