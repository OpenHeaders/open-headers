/**
 * Pending side-effect intents store (Phase A R6).
 *
 * The DNR runner (S2 — not yet landed) coalesces intents by
 * `(kind, key)` with latest-HLC wins (§18.1) and reads the
 * materialized snapshot at execution time (S4). Persistence here
 * exists for SW-eviction survival: if the worker is evicted between
 * "intent enqueued" and "intent executed," we must replay on next
 * wake. `chrome.storage.local` would serialize the entire stored
 * value on every enqueue, so we mirror the mutation log's IDB choice.
 *
 * The store is conceptually a map keyed by `(kind, key)` — coalescing
 * is part of the contract, not the runner's job. Two enqueues for the
 * same `(kind, key)` collapse: latest HLC wins.
 */

import { compareHlc, type SideEffectIntent } from '@openheaders/core/sync';

export interface PendingIntents {
  /** Coalesce-by-(kind,key), keep highest-HLC. */
  enqueue(intent: SideEffectIntent): Promise<void>;
  /** Bulk variant — same coalescing rules apply. */
  enqueueAll(intents: SideEffectIntent[]): Promise<void>;
  /** Snapshot of all currently-pending intents in stable (kind, key) order. */
  list(): Promise<SideEffectIntent[]>;
  /** Pop a specific (kind, key) — the runner calls this once it has executed. */
  drain(kind: string, key: string): Promise<SideEffectIntent | null>;
  /** Wipe all entries — used by tests and full-resync flows. */
  clear(): Promise<void>;
}

const compositeKey = (kind: string, key: string): string => `${kind}\x1f${key}`;

/** Test/seed implementation. Production uses {@link openIdbPendingIntents}. */
export class InMemoryPendingIntents implements PendingIntents {
  private readonly map = new Map<string, SideEffectIntent>();

  async enqueue(intent: SideEffectIntent): Promise<void> {
    const k = compositeKey(intent.kind, intent.key);
    const existing = this.map.get(k);
    if (existing && compareHlc(intent.hlc, existing.hlc) <= 0) return;
    this.map.set(k, intent);
  }

  async enqueueAll(intents: SideEffectIntent[]): Promise<void> {
    for (const i of intents) await this.enqueue(i);
  }

  async list(): Promise<SideEffectIntent[]> {
    const keys = [...this.map.keys()].sort();
    return keys.map((k) => this.map.get(k) as SideEffectIntent);
  }

  async drain(kind: string, key: string): Promise<SideEffectIntent | null> {
    const k = compositeKey(kind, key);
    const existing = this.map.get(k);
    if (!existing) return null;
    this.map.delete(k);
    return existing;
  }

  async clear(): Promise<void> {
    this.map.clear();
  }
}
