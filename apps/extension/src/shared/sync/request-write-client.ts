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

import type { Request } from '@openheaders/core/types';
import {
  getRequestSyncMirrorForWorkspace,
  type RequestSyncMirror,
} from '@/context/request-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from '@/shared/sync/apply-payload';
import {
  buildAddBatch,
  buildDeleteBatch,
  buildUpdateBatch,
} from '@/shared/sync/request-mutations';

export type RequestUpdates = Partial<Omit<Request, 'uid' | 'path' | 'schemaVersion'>>;

export type RequestMutationResult =
  | { ok: true; request: Request }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export type RequestSimpleResult = SyncSimpleResult;

export interface RequestWriteOptions extends BaseSyncWriteOptions {
  /** Override the singleton mirror for tests. */
  mirror?: RequestSyncMirror;
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
  const mirror = resolveMirror(opts, getRequestSyncMirrorForWorkspace);
  const entry = mirror.getRequestMirror(requestUid);
  await mirror.hydrated;
  if (!entry) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
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
  const ack = await applySyncPayload(payload);
  if (ack.ok) {
    return { ok: true, request: { ...entry.request, ...updates } as Request };
  }
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

/** Seed a brand-new request through the oracle. Caller mints the full
 *  `Request` shape; the helper handles the create + per-row addToSet
 *  envelopes via the projection layer. */
export async function applyRequestCreate(
  request: Request,
  opts: RequestWriteOptions,
): Promise<RequestSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildAddBatch(request, ctx);
  return applySyncPayload(payload);
}

export async function applyRequestDelete(
  requestUid: string,
  opts: RequestWriteOptions,
): Promise<RequestSimpleResult> {
  const mirror = resolveMirror(opts, getRequestSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (!mirror.getRequestMirror(requestUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildDeleteBatch(requestUid, ctx);
  return applySyncPayload(payload);
}
