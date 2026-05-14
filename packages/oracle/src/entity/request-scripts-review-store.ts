/**
 * Request Scripts Review Pending Store — per-workspace set of imported
 * request uids that carry `preRequestScript` / `postResponseScript` and
 * haven't yet been opened in the inspector since import.
 *
 * The sidebar surfaces these as a "scripts" badge on the request row so
 * the recipient is reminded that an imported request will execute
 * JavaScript when run. Opening the request in the inspector clears the
 * uid from the set (single-action acknowledgement).
 *
 * Storage: `oh.ws.<id>.requestScriptsReviewPending` — flat `string[]`
 * of uids. Missing / empty value means nothing pending.
 *
 * Lifecycle parallels `pause-markers-store`: in-memory mirror for the
 * active workspace, hydrate-on-bootstrap, switch-on-workspace-change,
 * external-snapshot path for storage.onChanged, and a listeners set so
 * the SW can react if needed (today the renderer drives UI off
 * storage.onChanged directly).
 *
 * Non-active workspaces are mutated through the `*ForWorkspace`
 * variants (used by the importer when target ≠ active so the pending
 * set is recorded against the actual target without bouncing through
 * the active workspace).
 */

import { logger } from '@openheaders/core/utils';
import { entityLockName, withLock } from '@openheaders/oracle/coordination';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { requireActiveWorkspaceId } from '@openheaders/oracle/sync';

// ── In-memory mirror (active workspace) ────────────────────────────

let pending: Set<string> = new Set();
let loadedWorkspaceId: string | null = null;

type ChangeListener = () => void;
const listeners: Set<ChangeListener> = new Set();

export function onRequestScriptsReviewChange(listener: ChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyChange(): void {
  for (const fn of listeners) fn();
}

// ── Reads ──────────────────────────────────────────────────────────

export function getPendingScriptsReview(): ReadonlySet<string> {
  return pending;
}

export async function listPendingScriptsReviewForWorkspace(workspaceId: string): Promise<string[]> {
  const raw = await hostStorage.get(wsKeys(workspaceId).requestScriptsReviewPending);
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
}

// ── Writes (active workspace) ──────────────────────────────────────

function assertLoaded(): string {
  if (!loadedWorkspaceId) {
    throw new Error('RequestScriptsReviewStore: mutation before hydration');
  }
  return loadedWorkspaceId;
}

async function persistActive(): Promise<void> {
  const workspaceId = assertLoaded();
  const payload = Array.from(pending);
  await hostStorage.set(wsKeys(workspaceId).requestScriptsReviewPending, payload);
  notifyChange();
}

export async function markPendingScriptsReview(uids: readonly string[]): Promise<void> {
  if (uids.length === 0) return;
  const workspaceId = assertLoaded();
  await withLock(
    entityLockName(workspaceId, 'request-scripts-review', 'singleton'),
    async () => {
      let mutated = false;
      for (const uid of uids) {
        if (!pending.has(uid)) {
          pending.add(uid);
          mutated = true;
        }
      }
      if (mutated) await persistActive();
    },
    { op: 'request-scripts-review-mark' },
  );
}

export async function clearPendingScriptsReview(uid: string): Promise<void> {
  const workspaceId = assertLoaded();
  await withLock(
    entityLockName(workspaceId, 'request-scripts-review', 'singleton'),
    async () => {
      if (pending.delete(uid)) await persistActive();
    },
    { op: 'request-scripts-review-clear' },
  );
}

// ── Writes (non-active workspace) ──────────────────────────────────

/**
 * Mark uids pending in a workspace that isn't currently active. Used by
 * the import orchestrator when the target ≠ active workspace. Mirrors
 * the active path's lock + persist shape but reads + writes
 * chrome.storage directly (no in-memory mirror to keep coherent for
 * non-active workspaces).
 */
export async function markPendingScriptsReviewForWorkspace(
  workspaceId: string,
  uids: readonly string[],
): Promise<void> {
  if (uids.length === 0) return;
  await withLock(
    entityLockName(workspaceId, 'request-scripts-review', 'singleton'),
    async () => {
      const key = wsKeys(workspaceId).requestScriptsReviewPending;
      const current = await listPendingScriptsReviewForWorkspace(workspaceId);
      const set = new Set(current);
      let mutated = false;
      for (const uid of uids) {
        if (!set.has(uid)) {
          set.add(uid);
          mutated = true;
        }
      }
      if (mutated) await hostStorage.set(key, Array.from(set));
    },
    { op: 'request-scripts-review-mark-ws' },
  );
}

// ── Hydration / workspace switch ──────────────────────────────────

async function readPendingFor(workspaceId: string): Promise<Set<string>> {
  return new Set(await listPendingScriptsReviewForWorkspace(workspaceId));
}

export async function hydrateRequestScriptsReviewFromStorage(): Promise<void> {
  const workspaceId = requireActiveWorkspaceId();
  pending = await readPendingFor(workspaceId);
  loadedWorkspaceId = workspaceId;
  logger.info('RequestScriptsReviewStore', `Hydrated ws=${workspaceId}: ${pending.size} pending`);
}

export async function switchToWorkspace(workspaceId: string): Promise<void> {
  if (loadedWorkspaceId === workspaceId) return;
  pending = await readPendingFor(workspaceId);
  loadedWorkspaceId = workspaceId;
  notifyChange();
}

/**
 * External mutator: called by `background.ts`'s storage.onChanged
 * listener when something other than this store writes the active
 * workspace's key (e.g. a renderer-side mirror, or a cross-tab write).
 * Today the SW is the only writer, but the same pattern as
 * pause-markers keeps us coherent if that ever changes.
 */
export function applyExternalSnapshot(snapshot: readonly string[]): void {
  pending = new Set(snapshot);
  notifyChange();
}

export function __resetForTests(): void {
  pending = new Set();
  loadedWorkspaceId = null;
  listeners.clear();
}
