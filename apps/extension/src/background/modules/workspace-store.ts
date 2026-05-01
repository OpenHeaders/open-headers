/**
 * Workspace Store — authoritative list of extension workspaces and the
 * active workspace id.
 *
 * Single responsibility: read access to `ExtensionWorkspace[]` + the
 * active pointer, plus cache-driven coordination of cross-store work
 * (per-workspace store swaps on active flip, per-workspace data purge
 * on removal). Per-workspace data (rules, templates, test runs, etc.)
 * stays owned by the respective stores.
 *
 * Sync engine session 52: every renderer-driven workspace mutation now
 * goes directly to the global oracle via `extension-workspace-write-client`.
 * The legacy bridge-RPC writers (`createWorkspace` / `updateWorkspace` /
 * `renameWorkspace` / `deleteWorkspace` / `setActiveWorkspace` /
 * `reorderWorkspaces`) and their SW counterparts have been deleted —
 * only `createWorkspace` survives here as an SW-internal helper because
 * `workspace-orchestrator.duplicateWorkspace` and the import orchestrator
 * still mint workspaces from inside the SW.
 *
 * Cross-store side effects that used to live in the orchestrator (per-
 * workspace store swap on switch, per-workspace data purge on delete)
 * are wired through coordinator hooks the active cache subscription
 * invokes whenever it observes the relevant transition. Callers
 * (background.ts) register the coordinators at boot.
 *
 * Storage:
 *   - `oh.workspaces`         — ExtensionWorkspace[], sorted by sortIndex
 *   - `oh.activeWorkspaceId`  — string (always points at a live workspace)
 *
 * Invariants enforced at this boundary:
 *   - list is non-empty after bootstrap (default workspace seeded)
 *   - list cannot shrink below 1 entry (the renderer write client's
 *     `applyDeleteWorkspace` rejects last-workspace deletes; UI gates
 *     the delete button when the mirror reports a single workspace)
 *   - activeWorkspaceId always matches some workspace in the list; on
 *     delete-of-active, the renderer composes the batch with the
 *     neighbour-pointing setActive in the same all-or-nothing batch
 */

import { ExtensionWorkspaceSchema } from '@openheaders/core/schemas';
import {
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  EXTENSION_WORKSPACE_ID,
  EXTENSION_WORKSPACES_SET_PATH,
  type ExtensionWorkspaceSlot,
  keyBetween,
  type MutationBatch,
  type MutatorContext,
  type SideEffectIntent,
  seedKey,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { logger } from '@utils/logger';
import { extensionStorage, OH } from '@/shared/storage';
import { buildSetExtensionWorkspaceBatch } from '@/shared/sync/extension-workspace-mutations';
import {
  type ExtensionWorkspaceCache,
  getActiveExtensionWorkspaceCache,
} from '@/background/sync/extension-workspace-cache';
import { getGlobalOracle, nextGlobalSwContext } from '@/background/sync/global-service';
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

// ── Cross-store coordinators ──────────────────────────────────────────

/**
 * Coordinator hooks the cache subscription invokes when it observes a
 * transition that requires cross-store work the renderer can't drive
 * itself (per-workspace data lives in stores the renderer doesn't see).
 *
 *  - `ActiveSwitchCoordinator` runs when the active id flips. It MUST
 *    swap the per-workspace stores (rule / template / env / request /
 *    live-workflow / live-variable / request-scripts-review) BEFORE
 *    the generic `notifyChange` fires, since the
 *    `onWorkspaceStoreChange` listener in `background.ts` re-seeds the
 *    workspace-scoped sync engines from `getRules()` etc. and would
 *    otherwise observe the previous workspace's data.
 *  - `WorkspaceRemovedCoordinator` runs when one or more workspace ids
 *    leave the list. It owns the per-workspace storage key removal +
 *    encapsulated purges (env, vault, test runs, files, OAuth tokens,
 *    live cache, cooldowns) for each removed id.
 */
export type ActiveSwitchCoordinator = (newId: string, prevId: string | null) => Promise<void>;
export type WorkspaceRemovedCoordinator = (removedIds: readonly string[]) => Promise<void>;

let activeSwitchCoordinator: ActiveSwitchCoordinator | null = null;
let workspaceRemovedCoordinator: WorkspaceRemovedCoordinator | null = null;

export function setActiveSwitchCoordinator(fn: ActiveSwitchCoordinator | null): void {
  activeSwitchCoordinator = fn;
}

export function setWorkspaceRemovedCoordinator(fn: WorkspaceRemovedCoordinator | null): void {
  workspaceRemovedCoordinator = fn;
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

// ── SW-internal create ────────────────────────────────────────────────

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  kind?: V5.ExtensionWorkspaceKind;
}

/**
 * SW-internal workspace creation. Used by `workspace-orchestrator`
 * (`duplicateWorkspace`) and `workspace-import-orchestrator` to mint a
 * fresh workspace before populating its per-workspace data — both flows
 * stay SW-side because they touch stores the renderer can't reach.
 *
 * Renderer-driven creates go through `applyCreateWorkspace` in
 * `extension-workspace-write-client.ts`; this helper is intentionally
 * not bridge-exposed.
 */
export async function createWorkspace(input: CreateWorkspaceInput): Promise<V5.ExtensionWorkspace> {
  const now = new Date().toISOString();
  const id = generateUid();
  const slot: ExtensionWorkspaceSlot = {
    id,
    kind: input.kind ?? 'personal',
    name: input.name.trim() || 'Untitled Workspace',
    description: input.description,
    color: input.color,
    icon: input.icon,
    createdAt: now,
    updatedAt: now,
  };
  const orderKey = nextOrderKey();
  await applyExtensionWorkspaceMutationOrThrow(
    (ctx) => buildSetExtensionWorkspaceBatch({ slot, orderKey }, ctx),
    'createWorkspace',
  );
  const created = getWorkspace(id);
  if (!created) {
    throw new Error(`WorkspaceStore.createWorkspace: post-commit lookup failed for ${id}`);
  }
  logger.info('WorkspaceStore', `Created workspace ${id} "${slot.name}"`);
  return created;
}

// ── Sync engine plumbing ──────────────────────────────────────────────

async function applyExtensionWorkspaceMutationOrThrow(
  factory: (ctx: MutatorContext) => { batch: MutationBatch; sideEffects: SideEffectIntent[] },
  op: string,
): Promise<void> {
  const oracle = getGlobalOracle();
  if (!oracle) {
    throw new Error(`WorkspaceStore.${op}: global sync service not initialized`);
  }
  const ctx = nextGlobalSwContext({ surfaceId: 'sw' });
  const { batch, sideEffects } = factory(ctx);
  if (batch.mutations.length === 0) return;
  const result = await oracle.apply(batch, sideEffects);
  if (!result.ok) {
    throw new Error(
      `WorkspaceStore.${op}: oracle rejected batch (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
    );
  }
}

function nextOrderKey(): string {
  const oracle = getGlobalOracle();
  if (!oracle) return seedKey();
  const entries = oracle.liveOrderedSetItems(
    EXTENSION_WORKSPACE_ENTITY_TYPE,
    EXTENSION_WORKSPACE_ID,
    EXTENSION_WORKSPACES_SET_PATH,
  );
  if (entries.length === 0) return seedKey();
  const max = entries[entries.length - 1].key;
  return keyBetween(max, null);
}

// ── Bootstrap ─────────────────────────────────────────────────────────

/**
 * Load the workspace list from storage. If absent, seed a default
 * workspace and set it active. Call exactly once at SW boot, before any
 * per-workspace store is hydrated — the stores key their reads off the
 * active workspace id.
 *
 * Storage writes are deferred to {@link bridgeExtensionWorkspaceSyncEngine}
 * — the cache subscription it installs is the single writer of
 * `oh.workspaces` + `oh.activeWorkspaceId`. Bootstrap stages the
 * authoritative state in memory; bridge replays it through the global
 * oracle, and the cache.onChange listener writes back.
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
    logger.info('WorkspaceStore', `Loaded ${workspaces.length} workspace(s), active=${activeWorkspaceId}`);
    return;
  }

  // First boot — seed a default personal workspace IN MEMORY ONLY.
  // The bridge's cache.seedFromPersistedState fires the broadcast that
  // ultimately writes both storage keys via the cache.onChange sink.
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
  logger.info('WorkspaceStore', `Seeded default workspace ${defaultWorkspace.id}`);
}

// ── Sync engine bridge ────────────────────────────────────────────────

let cacheUnsubscribe: (() => void) | null = null;

/**
 * Wire the local mirror to the global {@link ExtensionWorkspaceCache}.
 * Idempotent — the prior subscription is dropped first. Two-step:
 *
 *   1. Install the cache.onChange subscription that mirrors the
 *      cache's snapshot back into the local `workspaces` /
 *      `activeWorkspaceId` arrays AND writes both chrome.storage keys
 *      (taking over from the legacy `persistWorkspaces` /
 *      `persistActiveId` direct-writes that were deleted in the same
 *      change).
 *   2. Seed the global oracle from the in-memory state populated by
 *      `bootstrap()`. The seed fires a broadcast which fires the
 *      onChange listener, which writes back to chrome.storage —
 *      first-boot defaults persist via this path.
 *
 * The global service must already be init'd (caller is `background.ts`
 * at boot or `__initGlobalSyncServiceForTests` for test fixtures).
 */
export async function bridgeExtensionWorkspaceSyncEngine(): Promise<void> {
  const cache = getActiveExtensionWorkspaceCache();
  if (!cache) {
    logger.info('WorkspaceStore', 'bridgeExtensionWorkspaceSyncEngine: no global cache; skipping');
    return;
  }
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    cacheUnsubscribe = null;
  }
  cacheUnsubscribe = installCacheSink(cache);
  await cache.seedFromPersistedState({
    workspaces: listWorkspaces(),
    activeWorkspaceId,
  });
}

function installCacheSink(cache: ExtensionWorkspaceCache): () => void {
  return cache.onChange(() => {
    const snap = cache.getSnapshot();
    const prevWorkspaces = workspaces;
    const prevActive = activeWorkspaceId;
    workspaces = snap.workspaces;
    activeWorkspaceId = snap.activeWorkspaceId;
    // Persist to chrome.storage. Errors get logged but don't unwind
    // the in-memory update — readers prefer fresh-but-unpersisted
    // state to stale-and-persisted state, and the next commit will
    // re-trigger persistence anyway.
    void persistFromCache(snap).catch((err) => {
      logger.warn('WorkspaceStore', 'persistFromCache failed', err);
    });

    const removed = computeRemovedIds(prevWorkspaces, snap.workspaces);
    const activeFlipped = activeWorkspaceId !== null && activeWorkspaceId !== prevActive;

    if (removed.length === 0 && !activeFlipped) {
      notifyChange();
      return;
    }

    // Defer the broadcast until cross-store coordinators have run, so
    // `bridgeXSyncEngine` re-seeds (kicked off by the
    // `onWorkspaceStoreChange` listener in `background.ts`) observe
    // already-swapped per-workspace stores. Plain metadata mutations
    // (rename, color) take the synchronous fast path above and don't
    // pay the IIFE cost.
    const flipNewId = activeFlipped ? activeWorkspaceId : null;
    void runCoordinators(removed, flipNewId, prevActive);
  });
}

async function runCoordinators(
  removed: readonly string[],
  flipNewId: string | null,
  prevActive: string | null,
): Promise<void> {
  if (removed.length > 0 && workspaceRemovedCoordinator) {
    try {
      await workspaceRemovedCoordinator(removed);
    } catch (err) {
      logger.warn('WorkspaceStore', 'workspaceRemovedCoordinator failed', err);
    }
  }
  if (flipNewId !== null && activeSwitchCoordinator) {
    try {
      await activeSwitchCoordinator(flipNewId, prevActive);
    } catch (err) {
      logger.warn('WorkspaceStore', 'activeSwitchCoordinator failed', err);
    }
  }
  notifyChange();
  if (flipNewId !== null) {
    notifyActiveChange(flipNewId, prevActive);
  }
}

function computeRemovedIds(
  prev: readonly V5.ExtensionWorkspace[],
  next: readonly V5.ExtensionWorkspace[],
): string[] {
  if (prev.length === 0) return [];
  const liveIds = new Set(next.map((w) => w.id));
  const removed: string[] = [];
  for (const w of prev) {
    if (!liveIds.has(w.id)) removed.push(w.id);
  }
  return removed;
}

async function persistFromCache(snap: {
  workspaces: V5.ExtensionWorkspace[];
  activeWorkspaceId: string | null;
}): Promise<void> {
  const tasks: Array<Promise<void>> = [extensionStorage.set(OH.workspaces, snap.workspaces)];
  if (snap.activeWorkspaceId) {
    tasks.push(extensionStorage.set(OH.activeWorkspaceId, snap.activeWorkspaceId));
  }
  await Promise.all(tasks);
}

// ── Test helpers ──────────────────────────────────────────────────────

/** Test-only: reset module state without touching storage. */
export function __resetForTests(): void {
  workspaces = [];
  activeWorkspaceId = null;
  listeners.clear();
  activeListeners.clear();
  activeSwitchCoordinator = null;
  workspaceRemovedCoordinator = null;
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    cacheUnsubscribe = null;
  }
}
