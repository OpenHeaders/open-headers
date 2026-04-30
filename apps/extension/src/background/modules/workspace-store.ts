/**
 * Workspace Store — authoritative list of extension workspaces and the
 * active workspace id.
 *
 * Single responsibility: CRUD over `ExtensionWorkspace[]` + the active
 * pointer. Does NOT touch per-workspace data (rules, templates, test
 * runs, etc.) — that's owned by the respective stores, which the
 * orchestrator in background.ts flushes and swaps when `setActive` is
 * called.
 *
 * Storage:
 *   - `oh.workspaces`         — ExtensionWorkspace[], sorted by sortIndex
 *   - `oh.activeWorkspaceId`  — string (always points at a live workspace)
 *
 * Invariants enforced at this boundary:
 *   - list is non-empty after bootstrap (default workspace seeded)
 *   - list cannot shrink below 1 entry (deleteWorkspace of the last one
 *     is rejected; UI should gate this with a disabled delete button)
 *   - activeWorkspaceId always matches some workspace in the list; on
 *     delete-of-active, the "next-best" workspace becomes active
 *     (previous in sort order, or first if deleted one was first)
 *
 * Per-workspace data for a duplicated or deleted workspace is NOT
 * managed here — orchestrator code in background.ts calls into each
 * store's own per-workspace entry points.
 */

import { ExtensionWorkspaceSchema } from '@openheaders/core/schemas';
import type { V5 } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { logger } from '@utils/logger';
import { entityLockName, withLock } from '@/shared/coordination/with-lock';
import { extensionStorage, OH } from '@/shared/storage';
import { getActiveExtensionWorkspaceCache } from '@/background/sync/extension-workspace-cache';
import { driftRecorder } from './storage-drift';

const DEFAULT_WORKSPACE_NAME = 'Workspace';
const DEFAULT_WORKSPACE_COLOR = 'neutral';

// ── In-memory state ───────────────────────────────────────────────────

let workspaces: V5.ExtensionWorkspace[] = [];
let activeWorkspaceId: string | null = null;

// ── Change listeners ──────────────────────────────────────────────────

type ChangeListener = () => void;
const listeners: Set<ChangeListener> = new Set();

export function onWorkspaceStoreChange(listener: ChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyChange(): void {
  for (const fn of listeners) fn();
}

/**
 * Active-workspace-pointer listeners. Distinct from the generic
 * `onWorkspaceStoreChange` because the latter fires on EVERY mutation
 * (workspace renames, list reorders, vault edits), and reactive
 * subscribers — the live-refresh scheduler's switch-warm pass in
 * particular — care only about the active-pointer flip. Subscribing
 * to the generic event would refresh on every keystroke that touches
 * a workspace name; this typed event fires once per real switch.
 *
 * Listener receives `(newId, prevId)` so a subscriber that needs to
 * unwind state for the outgoing workspace can do so with one
 * subscription (no shadowed prev-id state in user-land).
 */
type ActiveWorkspaceListener = (newId: string, prevId: string | null) => void;
const activeListeners: Set<ActiveWorkspaceListener> = new Set();

export function onActiveWorkspaceChange(listener: ActiveWorkspaceListener): () => void {
  activeListeners.add(listener);
  return () => activeListeners.delete(listener);
}

function notifyActiveChange(newId: string, prevId: string | null): void {
  for (const fn of activeListeners) {
    try {
      fn(newId, prevId);
    } catch {
      // Subscriber failures don't unwind the switch — the active
      // pointer is already flipped. Errors here would be in the
      // subscriber's own handler; let them surface there.
    }
  }
}

// ── Reads ─────────────────────────────────────────────────────────────

/** Current workspace list, sorted by sortIndex (ascending), then createdAt. */
export function listWorkspaces(): V5.ExtensionWorkspace[] {
  return [...workspaces].sort(compareWorkspaces);
}

export function getActiveWorkspaceId(): string {
  if (!activeWorkspaceId) {
    throw new Error('WorkspaceStore: read before bootstrap — activeWorkspaceId is null');
  }
  return activeWorkspaceId;
}

export function getActiveWorkspace(): V5.ExtensionWorkspace {
  const id = getActiveWorkspaceId();
  const ws = workspaces.find((w) => w.id === id);
  if (!ws) {
    throw new Error(`WorkspaceStore: active id "${id}" not found in list`);
  }
  return ws;
}

export function getWorkspace(id: string): V5.ExtensionWorkspace | null {
  return workspaces.find((w) => w.id === id) ?? null;
}

// ── Sort helpers ──────────────────────────────────────────────────────

function compareWorkspaces(a: V5.ExtensionWorkspace, b: V5.ExtensionWorkspace): number {
  if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex;
  return a.createdAt.localeCompare(b.createdAt);
}

function nextSortIndex(): number {
  if (workspaces.length === 0) return 0;
  return Math.max(...workspaces.map((w) => w.sortIndex)) + 1;
}

// ── Writes ────────────────────────────────────────────────────────────

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  kind?: V5.ExtensionWorkspaceKind;
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<V5.ExtensionWorkspace> {
  return withLock(
    entityLockName('global', 'workspace-meta', 'list'),
    async () => {
      const now = new Date().toISOString();
      const workspace: V5.ExtensionWorkspace = {
        schemaVersion: 5,
        id: generateUid(),
        kind: input.kind ?? 'personal',
        name: input.name.trim() || 'Untitled Workspace',
        description: input.description,
        color: input.color,
        icon: input.icon,
        sortIndex: nextSortIndex(),
        createdAt: now,
        updatedAt: now,
      };
      workspaces = [...workspaces, workspace];
      await persistWorkspaces();
      logger.info('WorkspaceStore', `Created workspace ${workspace.id} "${workspace.name}"`);
      return workspace;
    },
    { op: 'workspace-create' },
  );
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string;
  color?: string;
  /**
   * Icon patch semantics:
   *   - `undefined` → don't touch the existing icon
   *   - `null`      → clear the icon (workspace renders as a color square)
   *   - `string`    → set the icon to this TwoTone registry key
   */
  icon?: string | null;
}

/**
 * Outcome of a workspace metadata write. Sync engine §24 retired the
 * Phase 10 stale-draft contract; the per-entity-id `withLock` below
 * still serializes concurrent puts so storage-level interleaving stays
 * coherent, and convergence is per-(field) LWW by arrival order.
 *
 * ExtensionWorkspace is the cross-workspace ("global") metadata entity
 * — it doesn't fit the per-workspace oracle scope used by the eighteen
 * Phase-B-closed entities, so it remains on the legacy direct-write
 * path. Full sync-engine treatment is a separate slice (would need a
 * global-scope oracle).
 */
export type WorkspaceUpdateResult =
  | { ok: true; workspace: V5.ExtensionWorkspace }
  | { ok: false; reason: 'not-found' };

/** Update an existing workspace's metadata. */
export async function updateWorkspace(
  id: string,
  updates: UpdateWorkspaceInput,
): Promise<WorkspaceUpdateResult> {
  return withLock(
    entityLockName('global', 'workspace-meta', id),
    async () => {
      const idx = workspaces.findIndex((w) => w.id === id);
      if (idx === -1) return { ok: false, reason: 'not-found' } as WorkspaceUpdateResult;

      const prev = workspaces[idx];
      const next: V5.ExtensionWorkspace = {
        ...prev,
        ...(updates.name !== undefined && { name: updates.name.trim() || prev.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.color !== undefined && { color: updates.color }),
        updatedAt: new Date().toISOString(),
      };
      if (updates.icon === null) {
        delete next.icon;
      } else if (updates.icon !== undefined) {
        next.icon = updates.icon;
      }
      workspaces = [...workspaces.slice(0, idx), next, ...workspaces.slice(idx + 1)];
      await persistWorkspaces();
      return { ok: true, workspace: next } as WorkspaceUpdateResult;
    },
    { op: 'workspace-update' },
  );
}

/**
 * Delete a workspace. Rejects if it would empty the list.
 *
 * If the active workspace is deleted, the caller is responsible for
 * triggering a `switchActiveWorkspace` via the orchestrator — this
 * module only updates the active pointer, not the per-workspace data
 * stores (rule-store, template-store, etc.).
 *
 * Returns the new active workspace id (unchanged when a non-active
 * workspace was deleted), or `null` if the delete was rejected.
 */
export async function deleteWorkspace(id: string): Promise<string | null> {
  return withLock(
    entityLockName('global', 'workspace-meta', id),
    async () => {
      if (workspaces.length <= 1) {
        logger.info('WorkspaceStore', `Refusing to delete last workspace ${id}`);
        return null;
      }
      const idx = workspaces.findIndex((w) => w.id === id);
      if (idx === -1) return activeWorkspaceId;

      const wasActive = activeWorkspaceId === id;
      const prevActiveId = activeWorkspaceId;
      workspaces = [...workspaces.slice(0, idx), ...workspaces.slice(idx + 1)];

      if (wasActive) {
        // Pick neighbour: previous by sort order, else first remaining.
        const sorted = [...workspaces].sort(compareWorkspaces);
        const neighbour = sorted[Math.max(0, idx - 1)] ?? sorted[0];
        activeWorkspaceId = neighbour.id;
      }
      await persistWorkspaces();
      await persistActiveId();
      // Auto-promotion after deleting the active workspace IS a switch
      // — reactive subscribers (live-refresh scheduler's switch-warm
      // pass) must see it as one. Without this notify the scheduler
      // would keep firing alarms against the deleted workspace until
      // the next reconcile, and the new active workspace's stale LVs
      // wouldn't get a warm pass.
      if (wasActive && activeWorkspaceId && activeWorkspaceId !== prevActiveId) {
        notifyActiveChange(activeWorkspaceId, prevActiveId);
      }
      return activeWorkspaceId;
    },
    { op: 'workspace-delete' },
  );
}

/**
 * Reorder workspaces to match the given id list. Ids not in the input
 * are preserved at the end in their existing order. Used by
 * drag-to-reorder in the switcher UI.
 */
export async function reorderWorkspaces(idOrder: readonly string[]): Promise<void> {
  return withLock(
    entityLockName('global', 'workspace-meta', 'list'),
    async () => {
      const byId = new Map(workspaces.map((w) => [w.id, w] as const));
      const touched = new Set<string>();
      const reordered: V5.ExtensionWorkspace[] = [];

      let index = 0;
      for (const id of idOrder) {
        const ws = byId.get(id);
        if (!ws || touched.has(id)) continue;
        touched.add(id);
        reordered.push({ ...ws, sortIndex: index++ });
      }
      for (const ws of workspaces) {
        if (touched.has(ws.id)) continue;
        reordered.push({ ...ws, sortIndex: index++ });
      }
      const now = new Date().toISOString();
      workspaces = reordered.map((w) => ({ ...w, updatedAt: now }));
      await persistWorkspaces();
    },
    { op: 'workspace-reorder' },
  );
}

/**
 * Switch the active-workspace pointer. The orchestrator is responsible
 * for calling the per-workspace-data stores' `switchToWorkspace` methods
 * in response — this module does not own their in-memory state.
 */
export async function setActiveWorkspaceId(id: string): Promise<boolean> {
  const target = workspaces.find((w) => w.id === id);
  if (!target) return false;
  if (activeWorkspaceId === id) return true;
  const prevId = activeWorkspaceId;
  activeWorkspaceId = id;
  await persistActiveId();
  notifyActiveChange(id, prevId);
  return true;
}

// ── Persistence ───────────────────────────────────────────────────────

async function persistWorkspaces(): Promise<void> {
  await extensionStorage.set(OH.workspaces, workspaces);
  notifyChange();
}

async function persistActiveId(): Promise<void> {
  // Routed through the typed adapter even though `activeWorkspaceId` is
  // nullable in-memory — the registry declares it as `string`, so we
  // only call set once we have a real id.
  if (activeWorkspaceId) {
    await extensionStorage.set(OH.activeWorkspaceId, activeWorkspaceId);
  }
  notifyChange();
}

// ── Bootstrap ─────────────────────────────────────────────────────────

/**
 * Load the workspace list from storage. If absent, seed a default
 * workspace and set it active. Call exactly once at SW boot, before any
 * per-workspace store is hydrated — the stores key their reads off the
 * active workspace id.
 */
export async function bootstrap(): Promise<void> {
  const [storedList, storedActive] = await Promise.all([
    extensionStorage.getValidatedArray(OH.workspaces, ExtensionWorkspaceSchema, {
      onError: driftRecorder({ subsystem: 'workspace', storageKey: OH.workspaces.key }),
    }),
    extensionStorage.get(OH.activeWorkspaceId),
  ]);

  if (storedList.length > 0) {
    workspaces = storedList;
    const activeCandidate = typeof storedActive === 'string' ? storedActive : null;
    activeWorkspaceId =
      activeCandidate && workspaces.some((w) => w.id === activeCandidate)
        ? activeCandidate
        : [...workspaces].sort(compareWorkspaces)[0].id;
    if (activeWorkspaceId !== storedActive) await persistActiveId();
    logger.info('WorkspaceStore', `Loaded ${workspaces.length} workspace(s), active=${activeWorkspaceId}`);
    return;
  }

  // First boot — seed a default personal workspace.
  const now = new Date().toISOString();
  const defaultWorkspace: V5.ExtensionWorkspace = {
    schemaVersion: 5,
    id: generateUid(),
    kind: 'personal',
    name: DEFAULT_WORKSPACE_NAME,
    color: DEFAULT_WORKSPACE_COLOR,
    sortIndex: 0,
    createdAt: now,
    updatedAt: now,
  };
  workspaces = [defaultWorkspace];
  activeWorkspaceId = defaultWorkspace.id;
  await persistWorkspaces();
  await persistActiveId();
  logger.info('WorkspaceStore', `Seeded default workspace ${defaultWorkspace.id}`);
}

// ── Sync engine bridge ────────────────────────────────────────────────

/**
 * Seed the global-scope `extensionWorkspace` oracle from the in-memory
 * workspaces list + active id. Idempotent — re-running rebuilds the
 * singleton's set against the current authoritative state. Call after
 * `bootstrap()` resolves; commit 3 will additionally re-call this on
 * any cross-cutting state change (workspace add/remove/reorder/rename
 * via the SW path) so the cache stays in lockstep until the legacy
 * direct-write path is removed.
 *
 * The cache it talks to is `getActiveExtensionWorkspaceCache()`, owned
 * by `global-service.ts`. The global service must already be init'd
 * (caller is `background.ts` at boot or `__initGlobalSyncServiceForTests`
 * for test fixtures).
 */
export async function bridgeExtensionWorkspaceSyncEngine(): Promise<void> {
  const cache = getActiveExtensionWorkspaceCache();
  if (!cache) {
    logger.info('WorkspaceStore', 'bridgeExtensionWorkspaceSyncEngine: no global cache; skipping seed');
    return;
  }
  const currentActive = activeWorkspaceId;
  await cache.seedFromPersistedState({
    workspaces: listWorkspaces(),
    activeWorkspaceId: currentActive,
  });
}

// ── Test helpers ──────────────────────────────────────────────────────

/** Test-only: reset module state without touching storage. */
export function __resetForTests(): void {
  workspaces = [];
  activeWorkspaceId = null;
  listeners.clear();
}
