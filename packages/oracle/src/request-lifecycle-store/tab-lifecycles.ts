/**
 * Per-tab bounded LRU container for `RequestLifecycle` entries.
 *
 * Map iteration order = insertion order in JavaScript, so we use
 * `delete-then-set` on every refinement to keep the most-recently-touched
 * entry at the tail. On overflow, the head (oldest) entry evicts.
 *
 * This is the per-tab partition of the store's identity space (invariant
 * 1: `(tabId, requestId)`); the store dispatches to one container per
 * `tabId`. `forgetTab` (invariant 2) drops the entire container.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';

/** Returned by `set` so the store can notify subscribers about eviction. */
export interface SetResult {
  readonly evicted: RequestLifecycle | undefined;
}

export class TabLifecycles {
  private readonly entries = new Map<string, RequestLifecycle>();

  constructor(private readonly maxEntries: number) {
    if (maxEntries <= 0) {
      throw new Error(`TabLifecycles maxEntries must be positive, got ${maxEntries}`);
    }
  }

  get size(): number {
    return this.entries.size;
  }

  get(requestId: string): RequestLifecycle | undefined {
    return this.entries.get(requestId);
  }

  has(requestId: string): boolean {
    return this.entries.has(requestId);
  }

  set(requestId: string, lifecycle: RequestLifecycle): SetResult {
    // Re-insert to bump LRU position to the tail.
    this.entries.delete(requestId);
    this.entries.set(requestId, lifecycle);

    if (this.entries.size <= this.maxEntries) return { evicted: undefined };

    // Evict head (oldest insertion).
    const oldestKey = this.entries.keys().next().value;
    if (oldestKey === undefined) return { evicted: undefined };
    const evicted = this.entries.get(oldestKey);
    this.entries.delete(oldestKey);
    return { evicted };
  }

  delete(requestId: string): boolean {
    return this.entries.delete(requestId);
  }

  values(): IterableIterator<RequestLifecycle> {
    return this.entries.values();
  }
}
