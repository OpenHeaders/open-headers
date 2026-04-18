/**
 * Pause Markers Store — per-workspace map of path → pause marker.
 *
 * Pause markers are user-set flags on collection/folder paths:
 *   - 'paused'   — the subtree is paused (its rules don't fire).
 *   - 'unpaused' — explicit override that keeps the subtree active
 *                  even if an ancestor is paused.
 *
 * A path without a marker inherits its effective state from its closest
 * marked ancestor (default is unpaused at the root).
 *
 * Storage: `oh.ws.<id>.pauseMarkers` — Record<path, PauseMarker>.
 *
 * The store mirrors the map in memory. The DNR manager reads from
 * `getPauseMarkers()` on every compile; the RuleContext in the UI
 * reads via bridge RPC and subscribes to `oh.ws.<id>.pauseMarkers`
 * storage changes (through the storage.onChanged listener in
 * RuleContext).
 */

import type { PauseMarker } from '@openheaders/core/utils';
import { logger } from '@utils/logger';
import { extensionStorage, wsKeys } from '@/shared/storage';
import { getActiveWorkspaceId } from './workspace-store';

// ── In-memory state ────────────────────────────────────────────────

let markers: Map<string, PauseMarker> = new Map();
let loadedWorkspaceId: string | null = null;

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

function assertLoaded(): string {
  if (!loadedWorkspaceId) {
    throw new Error('PauseMarkersStore: mutation before hydration');
  }
  return loadedWorkspaceId;
}

export function setMarker(path: string, marker: PauseMarker): void {
  markers.set(path, marker);
  void persist();
}

export function clearMarker(path: string): void {
  if (markers.delete(path)) void persist();
}

export function replaceMarkers(record: Record<string, PauseMarker>): void {
  markers = new Map(Object.entries(record));
  void persist();
}

async function persist(): Promise<void> {
  const workspaceId = assertLoaded();
  const payload = Object.fromEntries(markers);
  await extensionStorage.set(wsKeys(workspaceId).pauseMarkers, payload);
  logger.debug('PauseMarkersStore', `Persisted ${markers.size} markers (ws=${workspaceId})`);
  notifyChange();
}

// ── Hydration / workspace switch ──────────────────────────────────

async function readMarkersFor(workspaceId: string): Promise<Map<string, PauseMarker>> {
  const raw = await extensionStorage.get(wsKeys(workspaceId).pauseMarkers);
  if (raw && typeof raw === 'object') {
    return new Map(Object.entries(raw));
  }
  return new Map();
}

export async function hydratePauseMarkersFromStorage(): Promise<void> {
  const workspaceId = getActiveWorkspaceId();
  markers = await readMarkersFor(workspaceId);
  loadedWorkspaceId = workspaceId;
  logger.info('PauseMarkersStore', `Hydrated ws=${workspaceId}: ${markers.size} markers`);
}

export async function switchToWorkspace(workspaceId: string): Promise<void> {
  if (loadedWorkspaceId === workspaceId) return;
  markers = await readMarkersFor(workspaceId);
  loadedWorkspaceId = workspaceId;
  logger.info('PauseMarkersStore', `Switched to ws=${workspaceId}: ${markers.size} markers`);
  notifyChange();
}

/**
 * External mutator: called when the UI writes to
 * `oh.ws.<id>.pauseMarkers` directly via storage.onChanged. The UI
 * (RuleContext) still owns the pause-toggle logic today; the store
 * just mirrors the persisted state so the DNR layer can read it.
 */
export function applyExternalSnapshot(record: Record<string, PauseMarker>): void {
  markers = new Map(Object.entries(record));
  notifyChange();
}

export function __resetForTests(): void {
  markers = new Map();
  loadedWorkspaceId = null;
  listeners.clear();
}
