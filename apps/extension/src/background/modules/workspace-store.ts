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
 * Phase B (sync engine session 32 commit 3): every write routes through
 * the global-scope `extensionWorkspace` oracle (`global-service.ts`).
 * The legacy per-entity-id `withLock` is gone — the oracle's per-entity
 * lock + per-batch all-or-nothing (§11.2) cover the concurrency posture.
 * The legacy `persistWorkspaces` / `persistActiveId` direct-writes are
 * gone — the {@link ExtensionWorkspaceCache}'s broadcast-driven onChange
 * subscription writes back to `oh.workspaces` + `oh.activeWorkspaceId`
 * after every commit. The in-memory `workspaces` / `activeWorkspaceId`
 * mirrors stay (synchronous reads from `getActiveWorkspaceId()` etc.)
 * but are now fed by the cache, not by the writers.
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
import {
  buildMoveExtensionWorkspaceBeforeBatch,
  buildRemoveExtensionWorkspaceBatch,
  buildSetActiveExtensionWorkspaceBatch,
  buildSetExtensionWorkspaceBatch,
} from '@/shared/sync/extension-workspace-mutations';
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

// ── Writes ────────────────────────────────────────────────────────────

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  kind?: V5.ExtensionWorkspaceKind;
}

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
  // Post-commit: the cache has been updated by the broadcast subscription
  // installed in `bridgeExtensionWorkspaceSyncEngine`, so the local
  // mirror already reflects the new workspace.
  const created = getWorkspace(id);
  if (!created) {
    throw new Error(`WorkspaceStore.createWorkspace: post-commit lookup failed for ${id}`);
  }
  logger.info('WorkspaceStore', `Created workspace ${id} "${slot.name}"`);
  return created;
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
 * Outcome of a workspace metadata write. Cross-tab convergence is
 * per-(field) LWW by HLC at the global oracle (§7.2). The `not-found`
 * branch fires when the requested id isn't present in the cache at the
 * time of the call (e.g. concurrent delete on another tab).
 *
 * ExtensionWorkspace lives at the GLOBAL scope — the oracle persists
 * across workspace-switch dispose+init cycles (`global-service.ts`).
 */
export type WorkspaceUpdateResult =
  | { ok: true; workspace: V5.ExtensionWorkspace }
  | { ok: false; reason: 'not-found' };

/** Update an existing workspace's metadata. */
export async function updateWorkspace(
  id: string,
  updates: UpdateWorkspaceInput,
): Promise<WorkspaceUpdateResult> {
  const prev = workspaces.find((w) => w.id === id);
  if (!prev) return { ok: false, reason: 'not-found' };

  // Preserve position on rename: reuse the existing entry's order key
  // if the oracle holds one. The cache projection strips keys (the
  // public V5.ExtensionWorkspace shape doesn't carry them), so the
  // SW-internal `liveOrderedSetItems` is the single source.
  const oracle = getGlobalOracle();
  const existing = oracle
    ?.liveOrderedSetItems(EXTENSION_WORKSPACE_ENTITY_TYPE, EXTENSION_WORKSPACE_ID, EXTENSION_WORKSPACES_SET_PATH)
    .find((entry) => entry.itemId === id);
  const orderKey = existing?.key ?? seedKey();

  const next: ExtensionWorkspaceSlot = {
    id,
    kind: prev.kind,
    name: updates.name !== undefined ? updates.name.trim() || prev.name : prev.name,
    description: updates.description !== undefined ? updates.description : prev.description,
    color: updates.color !== undefined ? updates.color : prev.color,
    icon:
      updates.icon === null
        ? undefined
        : updates.icon !== undefined
          ? updates.icon
          : prev.icon,
    createdAt: prev.createdAt,
    updatedAt: new Date().toISOString(),
    source: prev.source,
  };

  await applyExtensionWorkspaceMutationOrThrow(
    (ctx) => buildSetExtensionWorkspaceBatch({ slot: next, orderKey }, ctx),
    'updateWorkspace',
  );
  const updated = getWorkspace(id);
  if (!updated) return { ok: false, reason: 'not-found' };
  return { ok: true, workspace: updated };
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
  if (workspaces.length <= 1) {
    logger.info('WorkspaceStore', `Refusing to delete last workspace ${id}`);
    return null;
  }
  const idx = workspaces.findIndex((w) => w.id === id);
  if (idx === -1) return activeWorkspaceId;

  const wasActive = activeWorkspaceId === id;
  let neighbourId: string | null = null;
  if (wasActive) {
    // Pick neighbour the same way the legacy code did: previous by sort
    // order, else first remaining (after the delete).
    const sortedAfter = workspaces.filter((w) => w.id !== id).sort(compareWorkspaces);
    neighbourId = sortedAfter[Math.max(0, idx - 1)]?.id ?? sortedAfter[0]?.id ?? null;
  }

  // Per-batch all-or-nothing: remove + re-point active in one batch.
  // Half-and-half (remove succeeds, active flip fails) would leave a
  // dangling active pointer — exactly what §11.2 says we don't do.
  const result = await applyExtensionWorkspaceMutationOrThrow(
    (ctx) => composeDeleteBatch(id, wasActive ? neighbourId : null, ctx),
    'deleteWorkspace',
  );
  void result;
  return activeWorkspaceId;
}

function composeDeleteBatch(
  id: string,
  newActiveId: string | null,
  ctx: MutatorContext,
): { batch: MutationBatch; sideEffects: SideEffectIntent[] } {
  const remove = buildRemoveExtensionWorkspaceBatch({ id }, ctx);
  if (!newActiveId) return remove;
  // Bundle the active-flip into the same batch by sharing batchId.
  const sharedCtx = { ...ctx, batchId: remove.batch.batchId };
  const setActive = buildSetActiveExtensionWorkspaceBatch({ id: newActiveId }, sharedCtx);
  return {
    batch: { batchId: remove.batch.batchId, mutations: [...remove.batch.mutations, ...setActive.batch.mutations] },
    sideEffects: [...remove.sideEffects, ...setActive.sideEffects],
  };
}

/**
 * Reorder workspaces to match the given id list. Ids not in the input
 * are preserved at the end in their existing order. Used by
 * drag-to-reorder in the switcher UI.
 */
export async function reorderWorkspaces(idOrder: readonly string[]): Promise<void> {
  const byId = new Map(workspaces.map((w) => [w.id, w] as const));
  const seen = new Set<string>();
  const finalOrder: string[] = [];
  for (const id of idOrder) {
    if (!byId.has(id) || seen.has(id)) continue;
    seen.add(id);
    finalOrder.push(id);
  }
  for (const ws of [...workspaces].sort(compareWorkspaces)) {
    if (seen.has(ws.id)) continue;
    finalOrder.push(ws.id);
  }
  // Mint strictly-increasing fractional keys for the final positions.
  const newKeys: string[] = [];
  let prev: string | null = null;
  for (let i = 0; i < finalOrder.length; i++) {
    const k: string = i === 0 ? seedKey() : keyBetween(prev, null);
    newKeys.push(k);
    prev = k;
  }
  await applyExtensionWorkspaceMutationOrThrow((ctx) => {
    let batchId: string | undefined;
    let combined: MutationBatch | null = null;
    const sideEffects: SideEffectIntent[] = [];
    for (let i = 0; i < finalOrder.length; i++) {
      const intent = buildMoveExtensionWorkspaceBeforeBatch(
        { id: finalOrder[i], orderKey: newKeys[i] },
        batchId === undefined ? ctx : { ...ctx, batchId },
      );
      if (combined === null) {
        combined = intent.batch;
        batchId = intent.batch.batchId;
      } else {
        combined.mutations.push(...intent.batch.mutations);
      }
      sideEffects.push(...intent.sideEffects);
    }
    return { batch: combined ?? { batchId: 'noop', mutations: [] }, sideEffects };
  }, 'reorderWorkspaces');
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
  await applyExtensionWorkspaceMutationOrThrow(
    (ctx) => buildSetActiveExtensionWorkspaceBatch({ id }, ctx),
    'setActiveWorkspaceId',
  );
  return true;
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
    workspaces = snap.workspaces;
    const prev = activeWorkspaceId;
    activeWorkspaceId = snap.activeWorkspaceId;
    // Persist to chrome.storage. Errors get logged but don't unwind
    // the in-memory update — readers prefer fresh-but-unpersisted
    // state to stale-and-persisted state, and the next commit will
    // re-trigger persistence anyway.
    void persistFromCache(snap).catch((err) => {
      logger.warn('WorkspaceStore', 'persistFromCache failed', err);
    });
    notifyChange();
    if (activeWorkspaceId && activeWorkspaceId !== prev) {
      notifyActiveChange(activeWorkspaceId, prev);
    }
  });
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
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    cacheUnsubscribe = null;
  }
}
