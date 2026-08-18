/**
 * Append-only mutation log for the local oracle (Phase A R5).
 *
 * Per the sync-engine design §9.1, the log lives in IndexedDB,
 * not `chrome.storage.local` — `chrome.storage.local.set` serializes
 * the entire stored value on every write, terrible for an append-only
 * stream. The HLC string codec drives the IDB primary key so
 * "everything since HLC X" collapses to a single `IDBKeyRange.lowerBound`
 * lookup.
 *
 * The {@link MutationLog} interface is backend-agnostic so the oracle
 * can be tested with the {@link InMemoryMutationLog} in vitest while
 * production uses the IDB implementation. Both impls honor the same
 * contract: append-only, dedup by `mutationId`, totally-ordered by
 * HLC string codec.
 */

import { hlcToString, type MutationEnvelope } from '@openheaders/core/sync';

export interface MutationLog {
  /** Append one envelope. Idempotent — duplicate `mutationId` is a no-op. */
  append(env: MutationEnvelope): Promise<void>;

  /**
   * Atomic-ish multi-append. The store-level guarantee is "all or
   * nothing per call"; partial-write recovery is the oracle's
   * concern (it owns the per-batch lock).
   */
  appendAll(envs: MutationEnvelope[]): Promise<void>;

  /**
   * Read every envelope since `sinceHlcKey` (exclusive). When `null`,
   * reads the whole log oldest-first. The argument is the
   * {@link hlcToString} encoding so callers can persist a watermark
   * without deserializing it.
   */
  readSince(sinceHlcKey: string | null): AsyncIterable<MutationEnvelope>;

  /** Cheap dedup query — used by transport-level "did we already see this?" checks. */
  hasMutation(mutationId: string): Promise<boolean>;

  /**
   * Drop every envelope with HLC < `beforeHlcKey`. Driven by the
   * compaction watermark matrix (§9.3). Tombstones are the oracle's
   * problem; this layer is dumb storage.
   */
  truncateBefore(beforeHlcKey: string): Promise<void>;

  /**
   * Drop every envelope in this scope whose `orgId` matches — the
   * backend-eviction primitive (Discard on a consumed workspace). The
   * evicted org's rows must stop folding into the scope's state
   * vector so a later re-join is a genuine first join. Returns the
   * purged `mutationId`s so the caller can clear the document store's
   * dedup set — the re-joined peer streams the SAME envelopes again
   * and they must not read as duplicates.
   */
  purgeOrg(orgId: string): Promise<string[]>;
}

/** Test/seed implementation. Production callers use {@link openIdbMutationLog}. */
export class InMemoryMutationLog implements MutationLog {
  private readonly entries = new Map<string, MutationEnvelope>();
  private readonly seen = new Set<string>();

  async append(env: MutationEnvelope): Promise<void> {
    if (this.seen.has(env.mutationId)) return;
    this.seen.add(env.mutationId);
    this.entries.set(hlcToString(env.hlc), env);
  }

  async appendAll(envs: MutationEnvelope[]): Promise<void> {
    for (const env of envs) await this.append(env);
  }

  async *readSince(sinceHlcKey: string | null): AsyncIterable<MutationEnvelope> {
    const keys = [...this.entries.keys()].sort();
    for (const key of keys) {
      if (sinceHlcKey !== null && key <= sinceHlcKey) continue;
      const env = this.entries.get(key);
      if (env) yield env;
    }
  }

  async hasMutation(mutationId: string): Promise<boolean> {
    return this.seen.has(mutationId);
  }

  async truncateBefore(beforeHlcKey: string): Promise<void> {
    for (const key of [...this.entries.keys()]) {
      if (key < beforeHlcKey) {
        const env = this.entries.get(key);
        if (env) this.seen.delete(env.mutationId);
        this.entries.delete(key);
      }
    }
  }

  async purgeOrg(orgId: string): Promise<string[]> {
    const purged: string[] = [];
    for (const [key, env] of [...this.entries]) {
      if (env.orgId !== orgId) continue;
      purged.push(env.mutationId);
      this.seen.delete(env.mutationId);
      this.entries.delete(key);
    }
    return purged;
  }
}
