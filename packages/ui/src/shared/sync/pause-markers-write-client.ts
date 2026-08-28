/**
 * Renderer-side imperative entry point for pause-markers writes.
 *
 * Mirrors `vault-write-client.ts` for the singleton pause-markers
 * entity. Each helper builds a `MutationBatch` against the active
 * pause-markers mirror and fires `oh.sync.apply` directly — no SW
 * round-trip per primitive, no `setPauseMarkers` shim. Renderer
 * gestures (toggle, clear, clear-nested, prune) call into these
 * helpers; the optimistic local apply is folded into the renderer's
 * own state via the mirror's broadcast subscription.
 *
 * `applyPauseMarkersReplacement` is the prune / bulk-clear convenience:
 * caller passes the post-image entries and the helper diffs against the
 * mirror's existing uids (provided by the caller — the helper doesn't
 * reach for the singleton mirror, keeping it injectable for tests).
 */

import type { PauseMarkerEntry } from '@openheaders/core/sync';
import {
  buildClearPauseMarkerBatch,
  buildReplacePauseMarkersBatch,
  buildSetPauseMarkerBatch,
} from '@openheaders/core/sync-builders/mutations/pause-markers-mutations';
import {
  getPauseMarkersSyncMirrorForWorkspace,
  type PauseMarkersSyncMirror,
} from '../../context/mirrors/pause-markers-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';

// Re-exported so tests can construct a mirror without going through the singleton.
export { createPauseMarkersSyncMirror } from '../../context/mirrors/pause-markers-sync-mirror';

export type PauseMarkersResult = SyncSimpleResult;

export interface PauseMarkersWriteOptions extends BaseSyncWriteOptions {
  mirror?: PauseMarkersSyncMirror;
}

export type ApplyPauseMarkerSetInput = PauseMarkerEntry;

export async function applyPauseMarkerSet(
  input: ApplyPauseMarkerSetInput,
  opts: PauseMarkersWriteOptions,
): Promise<PauseMarkersResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildSetPauseMarkerBatch(input, ctx));
}

export interface ApplyPauseMarkerClearInput {
  uid: string;
}

export async function applyPauseMarkerClear(
  input: ApplyPauseMarkerClearInput,
  opts: PauseMarkersWriteOptions,
): Promise<PauseMarkersResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildClearPauseMarkerBatch(input, ctx));
}

/**
 * Replace the entire pause-markers set. The helper reads the existing
 * uid set off the active mirror so it can compute removals, then diffs
 * against the supplied `next` entries. Empty diff → empty batch (no
 * broadcast, no recompile).
 */
export async function applyPauseMarkersReplacement(
  next: readonly PauseMarkerEntry[],
  opts: PauseMarkersWriteOptions,
): Promise<PauseMarkersResult> {
  const mirror = resolveMirror(opts, getPauseMarkersSyncMirrorForWorkspace);
  const existing = mirror.liveUids();
  const ctx = resolveRendererContext(opts).next({ batchId: opts.batchId ?? `pause-markers-replace` });
  return applySyncPayload(buildReplacePauseMarkersBatch({ existing, next }, ctx));
}

export function activeMirror(workspaceId: string): PauseMarkersSyncMirror {
  return getPauseMarkersSyncMirrorForWorkspace(workspaceId);
}
