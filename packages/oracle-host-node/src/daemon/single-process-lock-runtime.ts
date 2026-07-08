/**
 * Single-process FIFO lock runtime for Node hosts — Stage 2.
 *
 * The oracle's `withLock` wrapper expects a `navigator.locks`-shaped
 * `LockRuntime`; in a browser context that's the Web Locks API. A Node
 * host has no `navigator.locks`, so we install a Map-of-promise-chains
 * keyed by lock name. Single-process scope is enough: the oracle lives
 * only in the host process, and local surfaces reach it over a transport
 * that is already serialized per call.
 *
 * Matches the test-runtime semantics in `service.ts`'s
 * `__initSyncServiceForTests` deps (`(_ws, _type, _id, fn) => fn()`),
 * tightened to actually serialize concurrent acquisitions of the same
 * lock name — important once two renderer windows (or extension WS
 * clients in Stage 2 commit 10) hammer the oracle concurrently.
 */

import type { LockRuntime } from '@openheaders/oracle/coordination';

interface Slot {
  /** Promise that resolves once the currently-held holder releases. */
  tail: Promise<void>;
}

const slots = new Map<string, Slot>();

export const singleProcessLockRuntime: LockRuntime = {
  async request<T>(name: string, options: { signal?: AbortSignal }, callback: () => Promise<T> | T): Promise<T> {
    if (options.signal?.aborted) {
      // Caller already gave up before we started — surface the abort
      // immediately rather than waiting for the lock.
      throw new DOMException('Aborted before lock acquired', 'AbortError');
    }

    const slot = slots.get(name);
    const wait = slot?.tail ?? Promise.resolve();

    // Chain a new tail BEFORE awaiting so concurrent callers queue
    // behind us deterministically. The new tail resolves after the
    // callback settles (success OR throw — `.catch(() => undefined)`
    // prevents a thrown callback from poisoning the queue).
    let releaseHolder!: () => void;
    const release = new Promise<void>((resolve) => {
      releaseHolder = resolve;
    });
    slots.set(name, { tail: wait.then(() => release) });

    try {
      await wait;
      if (options.signal?.aborted) {
        throw new DOMException('Aborted while waiting for lock', 'AbortError');
      }
      return await callback();
    } finally {
      releaseHolder();
      // Slots are intentionally not GC'd: the set is bounded by the
      // (workspace, entity type, entity id) triple, finite by definition,
      // and the next acquisition reuses the entry. Cleaning up here would
      // need a careful identity check against the current tail to avoid
      // racing with a queued caller that has already replaced it.
    }
  },
};
