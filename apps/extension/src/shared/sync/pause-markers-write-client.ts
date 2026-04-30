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
 * `applyPauseMarkersReplacement` is the editor / prune convenience:
 * caller passes the post-image map and the helper diffs against the
 * mirror's existing keys (provided by the caller — the helper doesn't
 * reach for the singleton mirror, keeping it injectable for tests).
 */

import { applySyncPayload, resolveRendererContext, type SyncSimpleResult } from '@/shared/sync/apply-payload';
import {
  type MutatorIntent,
  type PauseMarkerKind,
} from '@openheaders/core/sync';
import type { RendererContextHandle } from '@/context/renderer-mutator-context';
import {
  createPauseMarkersSyncMirror,
  getActivePauseMarkersSyncMirror,
  type PauseMarkersSyncMirror,
} from '@/context/pause-markers-sync-mirror';
import {
  buildClearPauseMarkerBatch,
  buildReplacePauseMarkersBatch,
  buildSetPauseMarkerBatch,
} from '@/shared/sync/pause-markers-mutations';

// Re-exported so tests can construct a mirror without going through the singleton.
export { createPauseMarkersSyncMirror } from '@/context/pause-markers-sync-mirror';

export type PauseMarkersResult = SyncSimpleResult;

export interface PauseMarkersWriteOptions {
  workspaceId: string;
  surfaceId: string;
  batchId?: string;
  mirror?: PauseMarkersSyncMirror;
  context?: RendererContextHandle;
}

function resolveMirror(opts: PauseMarkersWriteOptions): PauseMarkersSyncMirror {
  return opts.mirror ?? getActivePauseMarkersSyncMirror();
}

export interface ApplyPauseMarkerSetInput {
  path: string;
  marker: PauseMarkerKind;
}

export async function applyPauseMarkerSet(
  input: ApplyPauseMarkerSetInput,
  opts: PauseMarkersWriteOptions,
): Promise<PauseMarkersResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildSetPauseMarkerBatch(input, ctx));
}

export interface ApplyPauseMarkerClearInput {
  path: string;
}

export async function applyPauseMarkerClear(
  input: ApplyPauseMarkerClearInput,
  opts: PauseMarkersWriteOptions,
): Promise<PauseMarkersResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildClearPauseMarkerBatch(input, ctx));
}

/**
 * Replace the entire pause-markers map. The helper reads the existing
 * key set off the active mirror so it can compute removals, then
 * diffs against the supplied `next` map. Empty diff → empty batch (no
 * broadcast, no recompile).
 */
export async function applyPauseMarkersReplacement(
  next: ReadonlyMap<string, PauseMarkerKind> | Readonly<Record<string, PauseMarkerKind>>,
  opts: PauseMarkersWriteOptions,
): Promise<PauseMarkersResult> {
  const mirror = resolveMirror(opts);
  const existing = mirror.liveMarkers();
  const ctx = resolveRendererContext(opts).next({ batchId: opts.batchId ?? `pause-markers-replace` });
  return applySyncPayload(buildReplacePauseMarkersBatch({ existing, next }, ctx));
}

export function activeMirror(): PauseMarkersSyncMirror {
  return getActivePauseMarkersSyncMirror();
}
