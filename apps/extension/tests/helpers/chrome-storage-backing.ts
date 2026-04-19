/**
 * In-memory `chrome.storage.local` backing for the SW-lifecycle harness.
 *
 * The default `tests/__mocks__/chrome.ts` stubs every storage read to
 * return `{}` — that's fine for unit tests that mock `extensionStorage`
 * directly, but kills any test that walks the real hydrate path (which
 * reads from storage to populate module caches).
 *
 * This helper replaces `chrome.storage.local.{get,set,remove,clear}`
 * with a Map-backed implementation that persists values across calls
 * within a single test. Combined with `vi.resetModules()`, it lets us
 * simulate MV3 service-worker termination + wake:
 *
 *   SW life 1: seed storage, import module, call hydrate, mutate in-memory.
 *   "SW killed":  vi.resetModules() — every module-level `let` resets to its
 *                 initial value. chrome.storage.local (the Map) is preserved,
 *                 matching MV3 semantics where Chrome keeps storage intact
 *                 across SW eviction.
 *   SW life 2: fresh import, fresh hydrate, assert state survived.
 *
 * Does not cover `sync` / `session` — no SW-lifecycle test exercises
 * those yet. Add when needed.
 */

import { vi } from 'vitest';
import { chrome } from '../__mocks__/chrome';

// Module-level Map — one per test file. `install()` clears it so each
// test starts from an empty backing store.
const backing = new Map<string, unknown>();

/** Change listeners registered via `chrome.storage.onChanged.addListener`. */
type ChangeListener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void;
const listeners = new Set<ChangeListener>();

/**
 * Install the backing store on the shared chrome mock. Call from a
 * top-level `beforeEach` — safe to call repeatedly; each call resets
 * the backing Map + listener set so tests don't leak into each other.
 */
export function installBackingStorage(): void {
  backing.clear();
  listeners.clear();

  const local = chrome.storage.local as unknown as {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };
  const onChanged = chrome.storage.onChanged as unknown as {
    addListener: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
  };

  local.get.mockImplementation(
    (keys: string | string[] | Record<string, unknown> | null, callback: (items: Record<string, unknown>) => void) => {
      const out: Record<string, unknown> = {};
      const keyList = normalizeKeys(keys);
      for (const key of keyList) {
        if (backing.has(key)) out[key] = backing.get(key);
      }
      callback(out);
    },
  );

  local.set.mockImplementation((items: Record<string, unknown>, callback?: () => void) => {
    const changes: Record<string, chrome.storage.StorageChange> = {};
    for (const [key, value] of Object.entries(items)) {
      changes[key] = { oldValue: backing.get(key), newValue: value };
      backing.set(key, value);
    }
    callback?.();
    notifyListeners(changes, 'local');
  });

  local.remove.mockImplementation((keys: string | string[], callback?: () => void) => {
    const keyList = Array.isArray(keys) ? keys : [keys];
    const changes: Record<string, chrome.storage.StorageChange> = {};
    for (const key of keyList) {
      if (backing.has(key)) {
        changes[key] = { oldValue: backing.get(key), newValue: undefined };
        backing.delete(key);
      }
    }
    callback?.();
    notifyListeners(changes, 'local');
  });

  local.clear.mockImplementation((callback?: () => void) => {
    const changes: Record<string, chrome.storage.StorageChange> = {};
    for (const [key, value] of backing) {
      changes[key] = { oldValue: value, newValue: undefined };
    }
    backing.clear();
    callback?.();
    notifyListeners(changes, 'local');
  });

  onChanged.addListener.mockImplementation((fn: ChangeListener) => listeners.add(fn));
  onChanged.removeListener.mockImplementation((fn: ChangeListener) => listeners.delete(fn));
}

/** Seed a key before hydration runs. */
export function seedStorage(key: string, value: unknown): void {
  backing.set(key, value);
}

/** Seed many keys in one call. */
export function seedStorageMany(entries: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(entries)) backing.set(key, value);
}

/** Read the backing store directly — used to assert writes from a test. */
export function readStorage<T = unknown>(key: string): T | undefined {
  return backing.get(key) as T | undefined;
}

/** Snapshot the full backing map. Survives `vi.resetModules()` intentionally
 *  — modules reset, storage persists, matching MV3 semantics. */
export function snapshotStorage(): Record<string, unknown> {
  return Object.fromEntries(backing.entries());
}

function normalizeKeys(keys: string | string[] | Record<string, unknown> | null): string[] {
  if (keys === null) return [...backing.keys()];
  if (typeof keys === 'string') return [keys];
  if (Array.isArray(keys)) return keys;
  return Object.keys(keys);
}

function notifyListeners(changes: Record<string, chrome.storage.StorageChange>, area: string): void {
  if (Object.keys(changes).length === 0) return;
  for (const fn of listeners) fn(changes, area);
}
