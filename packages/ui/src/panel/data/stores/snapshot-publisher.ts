/**
 * `createSnapshotPublisher` — composition helper for the panel's
 * `useSyncExternalStore`-driven client stores.
 *
 * Owns the boilerplate shared across `LifecycleClientStore`,
 * `PageClientStore`, and `FireClientStore`: the listener set, the
 * `subscribe` / `getSnapshot` pair React subscribes through, and the
 * dirty-flag bookkeeping that lets `getSnapshot()` return the same
 * reference until something actually changes.
 *
 * Per-store concerns stay with the caller: the data fields, the
 * mutator API, the noop short-circuit predicates (e.g. "skip notify
 * when clear() is called on an empty store"), and the `compute`
 * callback that rebuilds the snapshot when the dirty flag is set.
 *
 * Mutators call `markDirty()` after a real state change — that flips the
 * cache flag and schedules a fan-out to listeners through the
 * notify-scheduler seam (rAF-coalesced in production), so a burst of
 * mutations in one frame collapses to a single notify. `getSnapshot()`
 * still rebuilds lazily on the dirty flag, so a synchronous read after
 * `markDirty` returns the latest state even before the deferred notify.
 */

import { getNotifyScheduler } from './notify-scheduler';

export interface SnapshotPublisher<T> {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => T;
  /** Invalidate the cached snapshot and notify subscribers. */
  markDirty(): void;
}

export function createSnapshotPublisher<T>(compute: () => T, initial: T): SnapshotPublisher<T> {
  const listeners = new Set<() => void>();
  let cache: T = initial;
  let dirty = false;

  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => {
      if (dirty) {
        cache = compute();
        dirty = false;
      }
      return cache;
    },
    markDirty(): void {
      dirty = true;
      getNotifyScheduler().schedule(notify);
    },
  };
}
