/**
 * Pause Markers Store — SW-side read mirror for the active workspace.
 *
 * Pause markers are user-set flags on collection/folder paths:
 *   - 'paused'   — the subtree is paused (its rules don't fire).
 *   - 'unpaused' — explicit override that keeps the subtree active
 *                  even if an ancestor is paused.
 *
 * Renderer writes route through `pause-markers-write-client.ts` directly
 * (Phase B end-to-end). This module owns the SW-side read mirror that
 * DNR / rule-state-observer / test-runner consult synchronously, plus
 * the bridge that wires it to the oracle's broadcast.
 */

import type { PauseMarkerKind } from '@openheaders/core/sync';
import { logger } from '@openheaders/core/utils';
import { extensionStorage, wsKeys } from '@openheaders/oracle/storage';
import { PAUSE_MARKERS_REGISTRATION } from '@openheaders/oracle/sync/entity-registry';
import type { PauseMarkersCache } from '@openheaders/oracle/sync/pause-markers-cache';
import { getActiveCacheForRegistration } from '@openheaders/oracle/sync/service';
import { requireActiveWorkspaceId } from '@openheaders/oracle/sync';

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
  const workspaceId = requireActiveWorkspaceId();
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
