/**
 * Pause Markers Store — per-workspace map of path → pause marker.
 *
 * Pause markers are user-set flags on collection/folder paths:
 *   - 'paused'   — the subtree is paused (its rules don't fire).
 *   - 'unpaused' — explicit override that keeps the subtree active
 *                  even if an ancestor is paused.
 *
 * Phase B — every write routes through the sync oracle (catalog factory
 * → MutationBatch → `oracle.apply`); the {@link PauseMarkersCache} owns
 * `chrome.storage.local` persistence + drives the local mirror via
 * broadcast-driven re-projection. Reads stay synchronous off the local
 * mirror so the DNR engine + rule-state-observer don't have to await.
 */

import type { MutationBatch, MutatorContext, PauseMarkerKind, SideEffectIntent } from '@openheaders/core/sync';
import { logger } from '@utils/logger';
import { extensionStorage, wsKeys } from '@/shared/storage';
import {
  buildClearPauseMarkerBatch,
  buildReplacePauseMarkersBatch,
  buildSetPauseMarkerBatch,
} from '@/shared/sync/pause-markers-mutations';
import { PAUSE_MARKERS_REGISTRATION } from '../sync/entity-registry';
import type { PauseMarkersCache } from '../sync/pause-markers-cache';
import { getActiveCacheForRegistration, getOracleForCurrentWorkspace, nextSwMutatorContext } from '../sync/service';
import { getActiveWorkspaceId } from './workspace-store';

// ── Type re-export (legacy callers use the local name) ────────────

export type PauseMarker = PauseMarkerKind;

// ── In-memory mirror (active workspace) ───────────────────────────

let markers: Map<string, PauseMarker> = new Map();

type ChangeListener = () => void;
const listeners: Set<ChangeListener> = new Set();

export function onPauseMarkersChange(listener: ChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyChange(): void {
  for (const fn of listeners) fn();
}

// ── Reads ──────────────────────────────────────────────────────────

export function getPauseMarkers(): ReadonlyMap<string, PauseMarker> {
  return markers;
}

// ── Writes ─────────────────────────────────────────────────────────

export async function setMarker(path: string, marker: PauseMarker): Promise<void> {
  await applyPauseMarkersMutationOrThrow((ctx) => buildSetPauseMarkerBatch({ path, marker }, ctx), 'setMarker');
}

export async function clearMarker(path: string): Promise<void> {
  await applyPauseMarkersMutationOrThrow((ctx) => buildClearPauseMarkerBatch({ path }, ctx), 'clearMarker');
}

/**
 * Replace the entire marker map. Used by the import / bulk-clear path
 * + the renderer-side `setPauseMarkers` legacy bridge entry (kept for
 * `RuleContext` until commit 3 swings it over to the renderer-direct
 * write client). Diff is computed inside the catalog factory against
 * the current mirror so removals fire only for paths the new map drops.
 */
export async function replaceMarkers(record: Record<string, PauseMarker>): Promise<void> {
  await applyPauseMarkersMutationOrThrow(
    (ctx) =>
      buildReplacePauseMarkersBatch(
        {
          existing: markers,
          next: record,
        },
        ctx,
      ),
    'replaceMarkers',
  );
}

// ── Sync engine plumbing ──────────────────────────────────────────

async function applyPauseMarkersMutationOrThrow(
  factory: (ctx: MutatorContext) => { batch: MutationBatch; sideEffects: SideEffectIntent[] },
  op: string,
): Promise<void> {
  const oracle = getOracleForCurrentWorkspace();
  const ctx = nextSwMutatorContext({ surfaceId: 'sw' });
  if (!oracle || !ctx) {
    throw new Error(`PauseMarkersStore.${op}: sync service not initialized`);
  }
  const { batch, sideEffects } = factory(ctx);
  if (batch.mutations.length === 0) return;
  const result = await oracle.apply(batch, sideEffects);
  if (!result.ok) {
    throw new Error(
      `PauseMarkersStore.${op}: oracle rejected batch (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
    );
  }
}

// ── Hydration / bridge ────────────────────────────────────────────

let cacheUnsubscribe: (() => void) | null = null;

async function readMarkersFor(workspaceId: string): Promise<Record<string, PauseMarker>> {
  const raw = await extensionStorage.get(wsKeys(workspaceId).pauseMarkers);
  if (raw && typeof raw === 'object') return raw as Record<string, PauseMarker>;
  return {};
}

/**
 * Wire the local mirror to the active workspace's
 * {@link PauseMarkersCache}. Idempotent — the prior subscription is
 * dropped first. Seeds the oracle from the current persisted record.
 */
export async function bridgePauseMarkersSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<PauseMarkersCache>(PAUSE_MARKERS_REGISTRATION);
  if (!cache) return;
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    cacheUnsubscribe = null;
  }
  cacheUnsubscribe = cache.onChange(() => {
    markers = new Map(Object.entries(cache.getSnapshot().markers));
    notifyChange();
  });
  const workspaceId = getActiveWorkspaceId();
  const persisted = await readMarkersFor(workspaceId);
  await cache.seedFromPersistedPauseMarkers(persisted);
  markers = new Map(Object.entries(cache.getSnapshot().markers));
  logger.info('PauseMarkersStore', `Bridged ws=${workspaceId}: ${markers.size} markers`);
}

// ── Test helpers ──────────────────────────────────────────────────

export function __resetForTests(): void {
  markers = new Map();
  listeners.clear();
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    cacheUnsubscribe = null;
  }
}

/**
 * Test-only mirror seed. Production callers must go through the
 * cache + bridge path (`bridgePauseMarkersSyncEngine`); this helper
 * lets DNR / rule-engine tests inject a marker map without booting
 * the sync service.
 */
export function __setMarkersForTests(record: Record<string, PauseMarker>): void {
  markers = new Map(Object.entries(record));
  notifyChange();
}
