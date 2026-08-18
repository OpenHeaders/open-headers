/**
 * Local oracle (Phase A R3) — entity-agnostic by implementation.
 *
 * Dispatches solely on `envelope.body.type`; Rule, Environment, and
 * future entity types share one apply path. The class was named
 * `RuleOracle` while Phase A only had Rule; renamed in Phase B once
 * Environment landed as a second consumer.
 *
 * Per the sync-engine design §11.1 the oracle:
 *
 *   1. Serializes concurrent mutations from multiple surfaces via
 *      `withLock(entityLockName(ws, type, id))` — the lock is
 *      correctness-load-bearing, not just materialization-consistency
 *      (§6.3 / §22.1).
 *   2. Runs the authoritative mutator, materializes the snapshot,
 *      broadcasts `(envelope, outcome)` to every surface (incl. the
 *      originator) for ack.
 *   3. Persists the envelope to the IDB mutation log and any emitted
 *      side-effect intents to the IDB pending-intents store.
 *
 * Per-batch all-or-nothing (§11.2): if any constituent fails the
 * mutator (status `schema-rejected` / `invalid-path` / surface-thrown),
 * the whole batch is rolled back — nothing broadcast, nothing
 * persisted, structured error returned.
 *
 * The class is test-friendly by construction: `lock`, `log`,
 * `intents`, and `broadcast` are injected. Production wires them to
 * real `withLock` + `IdbMutationLog` + `IdbPendingIntents` + the
 * chrome.runtime broadcast adapter; tests pass in-memory fakes.
 */

import {
  compareHlc,
  type EntitySchemaRegistry,
  type FieldOrigin,
  type HLC,
  InMemoryDocumentStore,
  type MutationBatch,
  type MutationEnvelope,
  type MutatorOutcome,
  type MutatorStatus,
  type SideEffectIntent,
} from '@openheaders/core/sync';
import type { MutationBroadcast } from './broadcast';
import type { MutationLog } from './mutation-log';
import type { PendingIntents } from './pending-intents';

/** Acquires `(workspaceId, type, entityId)` locks. */
export type LockAcquirer = <T>(workspaceId: string, type: string, entityId: string, fn: () => Promise<T>) => Promise<T>;

export interface OracleApplyResult {
  ok: boolean;
  outcomes: Array<{ envelope: MutationEnvelope; outcome: MutatorOutcome }>;
  /** Set when `ok === false` — names the constituent that broke the batch. */
  failure?: { mutationId: string; status: MutatorStatus; detail?: string };
}

const ROLLBACK_STATUSES: ReadonlySet<MutatorStatus> = new Set<MutatorStatus>([
  'invalid-path',
  'schema-rejected',
  'unknown-mutator-version',
]);

export interface OracleConfig {
  workspaceId: string;
  lock: LockAcquirer;
  log: MutationLog;
  intents: PendingIntents;
  broadcast: MutationBroadcast;
  /** Optional initial document store — defaults to a fresh in-memory one
   *  configured with `schemas` if supplied. */
  store?: InMemoryDocumentStore;
  /** Schema registry consulted by the materializer to canonicalize
   *  empty set-modeled paths to `[]`. Optional; absent registry keeps
   *  the legacy "untouched paths are absent" shape. */
  schemas?: EntitySchemaRegistry;
  /**
   * Fired with the batch's highest HLC after every successful commit.
   * Wired to the owning sequencer's `observe()` at construction so the
   * NEXT local mint strictly exceeds every envelope of a
   * multi-envelope batch — `mintBatch` ticks each envelope's logical
   * component past the context's base HLC, and without this fold a
   * same-millisecond follow-up mint could collide with a ticked
   * envelope and lose the LWW compare it should win.
   */
  onBatchApplied?: (maxHlc: HLC) => void;
}

export class EntityOracle {
  private readonly store: InMemoryDocumentStore;

  constructor(private readonly cfg: OracleConfig) {
    this.store = cfg.store ?? new InMemoryDocumentStore(cfg.schemas);
  }

  /**
   * Apply a batch all-or-nothing under the per-entity lock(s) it
   * touches. A batch that targets multiple entities acquires their
   * locks in deterministic order to avoid deadlock.
   */
  async apply(
    batch: MutationBatch,
    sideEffects: SideEffectIntent[] = [],
    applyOrigin: FieldOrigin = 'local',
  ): Promise<OracleApplyResult> {
    if (batch.mutations.length === 0) {
      return { ok: true, outcomes: [] };
    }
    const targets = collectEntityTargets(batch);
    return this.lockChain(targets, async () => this.applyUnderLock(batch, sideEffects, applyOrigin));
  }

  /** Direct snapshot read for surfaces that need the materialized view. */
  materializeAll() {
    return this.store.materializeAll();
  }

  /**
   * Materialize a single entity. Returns `null` for unknown or
   * tombstoned ids — broadcast projectors use this to attach
   * post-commit state without paying the full sort cost of
   * {@link materializeAll}.
   */
  materializeOne(type: string, id: string) {
    return this.store.materializeOne(type, id);
  }

  /**
   * Read live `(itemId, item)` pairs at a set path. Write-side helpers
   * (rule-store's partial-update path) consult this to enumerate the
   * itemIds they need to emit `removeFromSet` against — the materialized
   * view strips itemIds, so it can't answer this question.
   */
  liveSetItems(type: string, id: string, setPath: string): Array<{ itemId: string; item: unknown }> {
    return this.store.liveSetItems(type, id, setPath);
  }

  /**
   * Same as {@link liveSetItems} but exposes the per-entry order key.
   * Used by write-side helpers that need to PRESERVE an entry's
   * position on a replace (e.g. workspace rename) or compute a fresh
   * key via `keyBetween` against the neighbours.
   */
  liveOrderedSetItems(
    type: string,
    id: string,
    setPath: string,
  ): Array<{ itemId: string; item: unknown; key: string }> {
    return this.store.liveOrderedSetItems(type, id, setPath);
  }

  /**
   * Host-local eviction surgery (backend Discard): under the entity
   * lock, delete one set item's CRDT record without a tombstone and
   * forget the purged mutation ids so a re-joined peer's replay of
   * the SAME envelopes re-applies instead of deduping. No broadcast —
   * nothing was minted; the caller refreshes its cache explicitly.
   */
  async evictSetItem(type: string, id: string, setPath: string, itemId: string, forgetIds: string[]): Promise<void> {
    await this.cfg.lock(this.cfg.workspaceId, type, id, async () => {
      this.store.evictSetItem(type, id, setPath, itemId);
      this.store.forgetMutations(forgetIds);
    });
  }

  // ── internals ────────────────────────────────────────────────────

  private async applyUnderLock(
    batch: MutationBatch,
    sideEffects: SideEffectIntent[],
    applyOrigin: FieldOrigin,
  ): Promise<OracleApplyResult> {
    const snapshot = this.store.snapshot();
    const outcomes: Array<{ envelope: MutationEnvelope; outcome: MutatorOutcome }> = [];

    for (const env of batch.mutations) {
      const outcome = this.store.apply(env, applyOrigin);
      outcomes.push({ envelope: env, outcome });
      if (ROLLBACK_STATUSES.has(outcome.status)) {
        this.store.restore(snapshot);
        return {
          ok: false,
          outcomes,
          failure: { mutationId: env.mutationId, status: outcome.status, detail: outcome.detail },
        };
      }
    }

    // Commit: log envelopes (dedup-safe), enqueue side effects,
    // broadcast every (env, outcome).
    await this.cfg.log.appendAll(batch.mutations);
    if (sideEffects.length > 0) await this.cfg.intents.enqueueAll(sideEffects);

    for (const { envelope, outcome } of outcomes) {
      this.cfg.broadcast.publish({ envelope, outcome, batchId: batch.batchId, applyOrigin });
    }
    if (this.cfg.onBatchApplied) {
      let max: HLC | null = null;
      for (const env of batch.mutations) {
        if (!max || compareHlc(env.hlc, max) > 0) max = env.hlc;
      }
      if (max) this.cfg.onBatchApplied(max);
    }
    return { ok: true, outcomes };
  }

  private async lockChain<T>(targets: ReadonlyArray<{ type: string; id: string }>, fn: () => Promise<T>): Promise<T> {
    if (targets.length === 0) return fn();
    const [head, ...rest] = targets;
    return this.cfg.lock(this.cfg.workspaceId, head.type, head.id, () => this.lockChain(rest, fn));
  }
}

function collectEntityTargets(batch: MutationBatch): Array<{ type: string; id: string }> {
  const seen = new Set<string>();
  const out: Array<{ type: string; id: string }> = [];
  for (const env of batch.mutations) {
    const key = `${env.body.type}:${env.body.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ type: env.body.type, id: env.body.id });
  }
  // Deterministic acquisition order avoids deadlock if two batches
  // touch the same multi-entity set in different declaration order.
  out.sort((a, b) => (a.type === b.type ? (a.id < b.id ? -1 : 1) : a.type < b.type ? -1 : 1));
  return out;
}
