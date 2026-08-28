/**
 * Pause Markers Store — SW-side read mirror for the active workspace.
 *
 * Pause markers are user-set flags on collections / folders, keyed by
 * the container uid:
 *   - 'paused'   — the subtree is paused (its rules don't fire).
 *   - 'unpaused' — explicit override that keeps the subtree active
 *                  even if an ancestor is paused.
 *
 * Renderer writes route through `pause-markers-write-client.ts` directly
 * (Phase B end-to-end). This module owns the SW-side read mirror that
 * DNR / rule-state-observer consult synchronously — the raw uid-keyed
 * map and the resolved `getPausedUids()` (every collection, folder and
 * rule uid effectively paused, folded once over the rules tree and
 * memoized until the markers or the tree change) — plus the bridge
 * that wires it to the oracle's broadcast.
 */

import type { PauseMarkerKind } from '@openheaders/core/sync';
import type { PauseMarkersSeedSource } from '@openheaders/core/sync-builders/projections/pause-markers-projection';
import { computePausedUids, logger, type PausedUids } from '@openheaders/core/utils';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { requireActiveWorkspaceId } from '@openheaders/oracle/sync';
import type { PauseMarkersCache } from '@openheaders/oracle/sync/caches/pause-markers-cache';
import { PAUSE_MARKERS_REGISTRATION } from '@openheaders/oracle/sync/entity-registry';
import { getActiveCacheForRegistration } from '@openheaders/oracle/sync/service/accessors';
import { getCollectionTrees, onStoreChange } from './rule-store';

// ── Type re-export (legacy callers use the local name) ────────────

export type PauseMarker = PauseMarkerKind;

// ── In-memory mirror (active workspace) ───────────────────────────

let markers: Map<string, PauseMarker> = new Map();
let pausedUids: Set<string> | null = null;

type ChangeListener = () => void;
const listeners: Set<ChangeListener> = new Set();

export function onPauseMarkersChange(listener: ChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyChange(): void {
  pausedUids = null;
  for (const fn of listeners) fn();
}

// The rule tree is the parent chain the resolution walks; any rule /
// collection / folder change can reshape it.
onStoreChange(() => {
  pausedUids = null;
});

// ── Reads ──────────────────────────────────────────────────────────

/** Container uid → marker, exactly as projected. */
export function getPauseMarkers(): ReadonlyMap<string, PauseMarker> {
  return markers;
}

/** Every uid effectively paused after inheritance + overrides resolve over the rules tree. */
export function getPausedUids(): PausedUids {
  if (pausedUids === null) {
    pausedUids = markers.size === 0 ? new Set() : computePausedUids(getCollectionTrees(), markers);
  }
  return pausedUids;
}

// ── Hydration / bridge ────────────────────────────────────────────

let cacheUnsubscribe: (() => void) | null = null;

async function readMarkersFor(workspaceId: string): Promise<PauseMarkersSeedSource> {
  const raw = await hostStorage.get(wsKeys(workspaceId).pauseMarkers);
  if (raw && typeof raw === 'object') return raw;
  return { markers: {}, entries: [] };
}

function adopt(cache: PauseMarkersCache): void {
  markers = new Map(Object.entries(cache.getSnapshot().markers));
  notifyChange();
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
  cacheUnsubscribe = cache.onChange(() => adopt(cache));
  const workspaceId = requireActiveWorkspaceId();
  const persisted = await readMarkersFor(workspaceId);
  await cache.seedFromPersistedPauseMarkers(persisted);
  adopt(cache);
  logger.debug('PauseMarkersStore', `Bridged ws=${workspaceId}: ${markers.size} markers`);
}

// ── Test helpers ──────────────────────────────────────────────────

export function __resetForTests(): void {
  markers = new Map();
  pausedUids = null;
  listeners.clear();
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    cacheUnsubscribe = null;
  }
}

/**
 * Test-only mirror seed. Production callers must go through the
 * cache + bridge path (`bridgePauseMarkersSyncEngine`); this helper
 * lets DNR / rule-engine tests inject a uid-keyed marker map without
 * booting the sync service.
 */
export function __setMarkersForTests(record: Record<string, PauseMarker>): void {
  markers = new Map(Object.entries(record));
  notifyChange();
}
