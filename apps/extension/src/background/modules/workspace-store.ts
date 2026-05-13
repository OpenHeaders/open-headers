/**
 * Workspace Store — authoritative list of extension workspaces and the
 * active workspace id.
 *
 * Single responsibility: read access to `ExtensionWorkspace[]` + the
 * active pointer, plus mirror upkeep against the global oracle's
 * `extensionWorkspace` cache. Per-workspace data (rules, templates,
 * test runs, etc.) stays owned by the respective stores.
 *
 * Sync engine session 53: cross-store coordination (per-workspace store
 * swap on active flip, per-workspace data purge on removal) is driven
 * by `SWAP_PER_WORKSPACE_STORES` + `PURGE_WORKSPACE_DATA` side-effect
 * intents emitted by the ExtensionWorkspace mutators. The
 * `workspace-coord-runner` drains them on every `extensionWorkspace`
 * broadcast and routes the work through the orchestrator. This module
 * stays out of the coordination loop entirely; cache.onChange is just
 * snapshot-mirroring + chrome.storage write + listener notify.
 *
 * Storage:
 *   - `oh.workspaces`              — ExtensionWorkspace[], sorted by sortIndex
 *   - `oh.runtimeActive.active`    — string (always points at a live workspace)
 *   - `oh.preferences.defaultWorkspace` — user preference for new-tab seed (independent)
 *
 * Invariants:
 *   - list is non-empty after bootstrap (default workspace seeded)
 *   - list cannot shrink below 1 entry (renderer's
 *     `applyDeleteWorkspace` rejects last-workspace deletes; UI gates
 *     the delete button when the mirror reports a single workspace)
 *   - activeWorkspaceId always matches a workspace in the list — when
 *     the active id is deleted, the renderer composes the batch with a
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
import type { ExtensionWorkspace, ExtensionWorkspaceKind } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { logger } from '@utils/logger';
import {
  type ExtensionWorkspaceCache,
  getActiveExtensionWorkspaceCache,
} from '@/background/sync/extension-workspace-cache';
import { getGlobalOracle, nextGlobalSwContext } from '@/background/sync/global-service';
import { extensionStorage, OH } from '@/shared/storage';
import { buildSetExtensionWorkspaceBatch } from '@/shared/sync/extension-workspace-mutations';
import { driftRecorder } from './storage-drift';

const DEFAULT_WORKSPACE_NAME = 'Workspace';
const DEFAULT_WORKSPACE_COLOR = 'neutral';

// ── In-memory state ───────────────────────────────────────────────────

let workspaces: ExtensionWorkspace[] = [];
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
 * particular — care only about the active-pointer flip. Subscribing to
 * the generic event would refresh on every keystroke that touches a
 * workspace name; this typed event fires once per real switch.
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
export function listWorkspaces(): ExtensionWorkspace[] {
  return [...workspaces].sort(compareWorkspaces);
}

export function getActiveWorkspaceId(): string {
  if (!activeWorkspaceId) {
    throw new Error('WorkspaceStore: read before bootstrap — activeWorkspaceId is null');
  }
  return activeWorkspaceId;
}

/**
 * Variant for callers (the workspace-coord runner) that need to read
 * the active id during cold-wake races where the cache hasn't pushed
 * its first snapshot yet — returns `null` instead of throwing so the
 * caller can short-circuit and wait for the next broadcast.
 */
export function peekActiveWorkspaceId(): string | null {
  return activeWorkspaceId;
}

export function getActiveWorkspace(): ExtensionWorkspace {
  const id = getActiveWorkspaceId();
  const ws = workspaces.find((w) => w.id === id);
  if (!ws) {
    throw new Error(`WorkspaceStore: active id "${id}" not found in list`);
  }
  return ws;
}

export function getWorkspace(id: string): ExtensionWorkspace | null {
  return workspaces.find((w) => w.id === id) ?? null;
}

// ── Sort helpers ──────────────────────────────────────────────────────

function compareWorkspaces(a: ExtensionWorkspace, b: ExtensionWorkspace): number {
  if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex;
  return a.createdAt.localeCompare(b.createdAt);
}

// ── SW-internal create ────────────────────────────────────────────────

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  kind?: ExtensionWorkspaceKind;
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
export async function createWorkspace(input: CreateWorkspaceInput): Promise<ExtensionWorkspace> {
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
 * `oh.workspaces` + `oh.runtimeActive.active`. Bootstrap stages the
 * authoritative state in memory; bridge replays it through the global
 * oracle, and the cache.onChange listener writes back.
 */
export async function bootstrap(): Promise<void> {
  const [storedList, storedActive, storedDefault] = await Promise.all([
    extensionStorage.getValidatedArray(OH.workspaces, ExtensionWorkspaceSchema, {
      onError: driftRecorder({ subsystem: 'workspace', storageKey: OH.workspaces.key }),
    }),
    extensionStorage.get(OH.runtimeActive),
    extensionStorage.get(OH.preferencesDefaultWorkspace),
  ]);

  if (storedList.length > 0) {
    workspaces = storedList;
    // Stale-Active boot fallback: walk Active → Default → first valid
    // workspace. `OH.runtimeActive` may point at a deleted workspace
    // after unclean SW shutdown; `OH.preferencesDefaultWorkspace` is
    // the user-preference fallback before falling through to the first
    // workspace in sort order.
    const validFor = (candidate: unknown): string | null =>
      typeof candidate === 'string' && workspaces.some((w) => w.id === candidate) ? candidate : null;
    activeWorkspaceId =
      validFor(storedActive) ?? validFor(storedDefault) ?? [...workspaces].sort(compareWorkspaces)[0].id;
    logger.info('WorkspaceStore', `Loaded ${workspaces.length} workspace(s), active=${activeWorkspaceId}`);
    return;
  }

  // First boot — seed a default personal workspace IN MEMORY ONLY.
  // The bridge's cache.seedFromPersistedState fires the broadcast that
  // ultimately writes both storage keys via the cache.onChange sink.
  const now = new Date().toISOString();
  const defaultWorkspace: ExtensionWorkspace = {
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
 *      `activeWorkspaceId` arrays AND writes both chrome.storage keys.
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
    const prev = activeWorkspaceId;
    workspaces = snap.workspaces;
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
  workspaces: ExtensionWorkspace[];
  activeWorkspaceId: string | null;
}): Promise<void> {
  const tasks: Array<Promise<void>> = [extensionStorage.set(OH.workspaces, snap.workspaces)];
  if (snap.activeWorkspaceId) {
    tasks.push(extensionStorage.set(OH.runtimeActive, snap.activeWorkspaceId));
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
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    cacheUnsubscribe = null;
  }
}
