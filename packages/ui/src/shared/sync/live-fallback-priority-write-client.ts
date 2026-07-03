/**
 * Renderer-side imperative entry point for live-fallback-priority writes
 * (WS-C C14 commit 3 — the offline-fallback reorder/prune management UI).
 *
 * Mirrors the other write-clients: build a `MutationBatch` via the shared
 * catalog factories and fire `oh.sync.apply` directly — no SW round-trip
 * per write. The auto-seed (enlist) path stays SW-side; only the two
 * user-driven management gestures live here:
 *
 *   - `applyFallbackPriorityReorder` — whole-list re-emit with fresh
 *     contiguous ranks (the factory re-stamps `order` from array index).
 *   - `applyFallbackPriorityPrune` — the append-only list's only removal
 *     path (one `removeFromSet` tombstone).
 */

import {
  buildPruneFallbackPriorityBatch,
  buildReorderFallbackPriorityBatch,
} from '@openheaders/core/sync-builders/mutations/live-fallback-priority-mutations';
import type { LiveFallbackPriorityMember } from '@openheaders/core/types';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';

export type FallbackPrioritySimpleResult = SyncSimpleResult;

export type FallbackPriorityWriteOptions = BaseSyncWriteOptions;

/**
 * Re-rank the whole list. `orderedMembers` is the full member set in the
 * desired display order; ranks are re-stamped from index by the factory.
 * An empty list is a no-op success.
 */
export async function applyFallbackPriorityReorder(
  orderedMembers: readonly LiveFallbackPriorityMember[],
  opts: FallbackPriorityWriteOptions,
): Promise<FallbackPrioritySimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildReorderFallbackPriorityBatch({ orderedMembers }, ctx));
}

/** Drop one host from the list. */
export async function applyFallbackPriorityPrune(
  principalId: string,
  opts: FallbackPriorityWriteOptions,
): Promise<FallbackPrioritySimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildPruneFallbackPriorityBatch({ principalId }, ctx));
}
