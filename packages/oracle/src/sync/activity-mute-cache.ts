/**
 * Activity Feed mute cache — Phase C F6.b.
 *
 * Host-neutral, process-singleton, synchronously-readable cache of
 * which `(entityType, entityId)` pairs are muted per workspace. The
 * installer ({@link sync-activity-installer}) consults it inside
 * `observeForActivityFeed` to decide whether to suppress a classified
 * entry; the RPC dispatcher ({@link sync-rpc}) mutates it in response
 * to renderer-issued mute / unmute gestures.
 *
 * The persisted {@link ActivityMuteStore} is the durability layer; the
 * cache is the runtime source of truth. Every mutation goes through
 * both, in this order: cache update (synchronous, observers fire) →
 * store write (async, fire-and-forget for `mute`, awaited for `unmute`
 * to match RPC semantics). The cache loads itself lazily, once per
 * workspace, on the first `ensureLoaded` or `isMuted` call.
 *
 * Why sync reads matter: the installer's `observeForActivityFeed` is
 * called from the oracle's broadcast hook, which is on the hot apply
 * path. Awaiting an IDB/SQLite read per envelope would couple the apply
 * path to disk latency. Sync `isMuted` keeps the gate at memory speed;
 * the lazy-load only blocks the first classified entry per workspace
 * per process boot, and the worst case (cache cold, mute persisted) is
 * a single missed suppression that the panel control can dismiss.
 *
 * Subscriptions: hosts (extension SW, desktop main) subscribe to mute
 * changes and broadcast `'activityMuteChanged'` to renderers. The
 * subscription contract mirrors {@link subscribeActivityEntries}.
 */

import { activityMuteKey, type ActivityMuteEntry } from '@openheaders/core/sync';

import type { ActivityMuteStore } from './activity-mute-store';

export interface ActivityMuteChange {
  workspaceId: string;
  entityType: string;
  entityId: string;
  /** True for mute, false for unmute. */
  muted: boolean;
  /** Wall-clock millis the change happened. */
  at: number;
}

let store: ActivityMuteStore | null = null;
/** Per-workspace muted-key set. Populated by `ensureLoaded`. */
const cache = new Map<string, Set<string>>();
/** Per-workspace full entries, for fast list responses. */
const entriesCache = new Map<string, Map<string, ActivityMuteEntry>>();
/** In-flight or completed hydration promises per workspace — idempotent. */
const loadPromises = new Map<string, Promise<void>>();
const subscribers = new Set<(change: ActivityMuteChange) => void>();
let clock: () => number = () => Date.now();

function ensureBuckets(workspaceId: string): { keys: Set<string>; entries: Map<string, ActivityMuteEntry> } {
  let keys = cache.get(workspaceId);
  if (!keys) {
    keys = new Set();
    cache.set(workspaceId, keys);
  }
  let entries = entriesCache.get(workspaceId);
  if (!entries) {
    entries = new Map();
    entriesCache.set(workspaceId, entries);
  }
  return { keys, entries };
}

/**
 * Install the persistence store. Called once during boot wiring after
 * the persistence provider has resolved. `null` clears the install
 * seam (used by tests).
 */
export function setActivityMuteStore(s: ActivityMuteStore | null): void {
  store = s;
}

/** Test seam — swap the wall-clock source. */
export function setActivityMuteClockForTests(now: () => number): void {
  clock = now;
}

/**
 * Hydrate the cache for `workspaceId` from the installed store.
 * Idempotent — subsequent calls return the same in-flight promise.
 * Safe to call before {@link setActivityMuteStore}: the cache stays
 * empty and `isMuted` returns false.
 */
export function ensureMutesLoaded(workspaceId: string): Promise<void> {
  const cached = loadPromises.get(workspaceId);
  if (cached) return cached;
  if (!store) {
    // No store → instant-resolve, but don't memoize so a subsequent
    // `setActivityMuteStore` install retriggers the hydration.
    return Promise.resolve();
  }
  const s = store;
  const promise = s
    .list(workspaceId)
    .then((rows) => {
      const { keys, entries } = ensureBuckets(workspaceId);
      for (const row of rows) {
        const k = activityMuteKey(row.entityType, row.entityId);
        keys.add(k);
        entries.set(k, row);
      }
    })
    .catch((err) => {
      // Failed load is recoverable: drop the memoized promise so the
      // next call retries instead of permanently degrading to "not
      // muted". The caller (installer) already treats `isMuted=false`
      // as the safe default.
      loadPromises.delete(workspaceId);
      throw err;
    });
  loadPromises.set(workspaceId, promise);
  return promise;
}

/**
 * Synchronous mute check. Returns `false` for workspaces whose cache
 * hasn't been hydrated yet — caller is responsible for kicking off
 * `ensureMutesLoaded` at appropriate boot/observe points.
 */
export function isMutedForActivityFeed(
  workspaceId: string,
  entityType: string,
  entityId: string,
): boolean {
  const keys = cache.get(workspaceId);
  if (!keys) return false;
  return keys.has(activityMuteKey(entityType, entityId));
}

/**
 * Mute `(entityType, entityId)` in `workspaceId`. Updates cache
 * synchronously + notifies subscribers, then writes to the persisted
 * store. Returns the entry the cache now holds. Idempotent — re-muting
 * an already-muted pair refreshes `mutedAt` and re-notifies.
 */
export async function muteActivityEntity(
  workspaceId: string,
  entityType: string,
  entityId: string,
): Promise<ActivityMuteEntry> {
  await ensureMutesLoaded(workspaceId);
  const entry: ActivityMuteEntry = {
    workspaceId,
    entityType,
    entityId,
    mutedAt: clock(),
  };
  const { keys, entries } = ensureBuckets(workspaceId);
  const k = activityMuteKey(entityType, entityId);
  keys.add(k);
  entries.set(k, entry);
  notify({ workspaceId, entityType, entityId, muted: true, at: entry.mutedAt });
  if (store) await store.put(entry);
  return entry;
}

/**
 * Unmute `(entityType, entityId)` in `workspaceId`. Updates cache
 * synchronously + notifies subscribers, then deletes from the persisted
 * store. Idempotent — unmuting an absent pair is a notify-and-no-op.
 */
export async function unmuteActivityEntity(
  workspaceId: string,
  entityType: string,
  entityId: string,
): Promise<void> {
  await ensureMutesLoaded(workspaceId);
  const { keys, entries } = ensureBuckets(workspaceId);
  const k = activityMuteKey(entityType, entityId);
  const wasPresent = keys.delete(k);
  entries.delete(k);
  // Always notify so the broadcast reaches surfaces in a race where
  // unmute fires before they hydrated; the change is idempotent at
  // the receiver.
  notify({ workspaceId, entityType, entityId, muted: false, at: clock() });
  if (store && wasPresent) await store.remove(workspaceId, entityType, entityId);
}

/**
 * Snapshot the muted entries for `workspaceId`. Async because the
 * cache may not have been hydrated yet — callers awaiting a fresh
 * list (RPC handler) get the same answer the synchronous gate uses.
 */
export async function listMutedActivityEntities(workspaceId: string): Promise<ActivityMuteEntry[]> {
  await ensureMutesLoaded(workspaceId);
  const bucket = entriesCache.get(workspaceId);
  if (!bucket) return [];
  return [...bucket.values()].sort((a, b) => a.mutedAt - b.mutedAt);
}

/**
 * Subscribe to mute changes. Used by host wiring to fan out
 * `activityMuteChanged` broadcasts to every open renderer surface.
 * Listeners fire inside the mutation call (after the cache update,
 * before the store write resolves); thrown listeners are caught so
 * they cannot poison siblings.
 */
export function subscribeActivityMuteChanges(listener: (change: ActivityMuteChange) => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

function notify(change: ActivityMuteChange): void {
  for (const listener of subscribers) {
    try {
      listener(change);
    } catch {
      // Subscriber failures cannot break the cache mutation pipeline.
    }
  }
}

/** Test-only — reset the singleton between cases. */
export function __resetActivityMuteCacheForTests(): void {
  store = null;
  cache.clear();
  entriesCache.clear();
  loadPromises.clear();
  subscribers.clear();
  clock = () => Date.now();
}
