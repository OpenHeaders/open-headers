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
 *   2. Decides novelty once, at this commit point, against the durable
 *      mutation log (§6.3 / §15): an envelope the log already holds is
 *      a duplicate — not applied, not appended, not broadcast, its HLC
 *      still observed — whatever the in-memory sets remember after a
 *      restart. Every replay path (wire echo, catch-up, snapshot plus
 *      delta overlap, a re-seed) is side-effect free by construction.
 *   3. Runs the authoritative mutator on the novel envelopes,
 *      materializes the snapshot, broadcasts `(envelope, outcome)` to
 *      every surface (incl. the originator) for ack.
 *   4. Persists the novel envelopes to the mutation log and the
 *      side-effect intents they derive (§18.1 — intents follow the
 *      commit, through the one `deriveSideEffectsForEnvelope` mapping)
 *      to the pending-intents store.
 *
 * Per-batch all-or-nothing (§11.2) over the novel subset: if any
 * constituent fails the mutator (status `schema-rejected` /
 * `invalid-path` / surface-thrown), the whole batch is rolled back —
 * nothing broadcast, nothing persisted, structured error returned.
 *
 * The class is test-friendly by construction: `lock`, `log`,
 * `intents`, and `broadcast` are injected. Production wires them to
 * real `withLock` + `IdbMutationLog` + `IdbPendingIntents` + the
 * chrome.runtime broadcast adapter; tests pass in-memory fakes.
 */

import {
  compareHlc,
  deriveSideEffectsForEnvelope,
  type EntitySchemaRegistry,
  type FieldOrigin,
  type HLC,
  InMemoryDocumentStore,
  type LiveOrderedItem,
  type MutationBatch,
  type MutationEnvelope,
  type MutatorOutcome,
  type MutatorStatus,
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

const DUPLICATE: MutatorOutcome = { status: 'duplicate' };

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
   * Local-write schema gate. When present, every batch applied with
   * `applyOrigin === 'local'` has each touched entity's materialized
   * post-state validated before commit; a non-null return (the
   * path-bearing detail) rolls the whole batch back with status
   * `schema-rejected`. Scoped to LOCAL writes only by design: inbound
   * peer envelopes, hydration seeds, and snapshot replay must apply
   * whatever the CRDT converged on — a replica-side validation veto
   * would fork convergence. Malformed persisted data is instead
   * absorbed by the tolerant read gates. Return `null` for entity
   * types the caller does not gate.
   */
  validateLocalWrite?: (type: string, data: unknown) => string | null;
  /**
   * Fired with the batch's highest HLC after every successful commit
   * and after a batch the log already held in full — a replay is still
   * an observation. Wired to the owning sequencer's `observe()` at construction so the
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
  private committed = 0;

  constructor(private readonly cfg: OracleConfig) {
    this.store = cfg.store ?? new InMemoryDocumentStore(cfg.schemas);
  }

  /**
   * Monotonic count of committed state changes (applied batches +
   * eviction surgery). Read-side memos key on it: a derived view built
   * at revision N is exact until the next commit bumps it. Bumped
   * BEFORE the batch broadcasts, so every projector run by that
   * broadcast sees the post-commit revision.
   */
  get revision(): number {
    return this.committed;
  }

  /**
   * Apply a batch all-or-nothing under the per-entity lock(s) it
   * touches. A batch that targets multiple entities acquires their
   * locks in deterministic order to avoid deadlock. Envelopes the
   * durable log already holds come back with outcome `duplicate` and
   * touch nothing; a batch with no novel envelope commits nothing and
   * still answers `ok`.
   */
  async apply(batch: MutationBatch, applyOrigin: FieldOrigin = 'local'): Promise<OracleApplyResult> {
    if (batch.mutations.length === 0) {
      return { ok: true, outcomes: [] };
    }
    const targets = collectEntityTargets(batch.mutations);
    return this.lockChain(targets, async () => this.applyUnderLock(batch, applyOrigin));
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

  /** Whether `(type, id)` is known deleted — see `InMemoryDocumentStore.isTombstoned`. */
  isTombstoned(type: string, id: string): boolean {
    return this.store.isTombstoned(type, id);
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
   * Same as {@link liveSetItems} but exposes the per-entry order key
   * and add-HLC. Used by write-side helpers that need to PRESERVE an
   * entry's position on a replace (e.g. workspace rename), compute a
   * fresh key via `keyBetween` against the neighbours, or rank a
   * child's competing parent slots (the tree index).
   */
  liveOrderedSetItems(type: string, id: string, setPath: string): LiveOrderedItem[] {
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
      this.committed += 1;
    });
  }

  // ── internals ────────────────────────────────────────────────────

  private async applyUnderLock(batch: MutationBatch, applyOrigin: FieldOrigin): Promise<OracleApplyResult> {
    // Novelty against the durable log, before any store write: the
    // in-memory sets start empty on every boot, the log does not.
    const known = await this.cfg.log.knownMutationIds(batch.mutations.map((env) => env.mutationId));
    const novel = batch.mutations.filter((env) => !known.has(env.mutationId));
    if (novel.length === 0) {
      this.observeBatch(batch);
      return { ok: true, outcomes: batch.mutations.map((envelope) => ({ envelope, outcome: DUPLICATE })) };
    }

    const snapshot = this.store.snapshot();
    const outcomes: Array<{ envelope: MutationEnvelope; outcome: MutatorOutcome }> = [];

    for (const env of batch.mutations) {
      if (known.has(env.mutationId)) {
        outcomes.push({ envelope: env, outcome: DUPLICATE });
        continue;
      }
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

    // Local-write schema gate (see OracleConfig.validateLocalWrite):
    // each touched entity's materialized post-state must satisfy its
    // registered schema before the batch commits. Tombstoned and
    // not-yet-created entities materialize to null and are skipped —
    // deletes always pass, and an update racing ahead of its create
    // is judged once the create lands.
    if (applyOrigin === 'local' && this.cfg.validateLocalWrite) {
      for (const { type, id } of collectEntityTargets(novel)) {
        const materialized = this.store.materializeOne(type, id);
        if (!materialized) continue;
        const detail = this.cfg.validateLocalWrite(type, materialized.data);
        if (detail === null) continue;
        this.store.restore(snapshot);
        const env = novel.find((m) => m.body.type === type && m.body.id === id);
        return {
          ok: false,
          outcomes,
          failure: {
            mutationId: env?.mutationId ?? novel[0].mutationId,
            status: 'schema-rejected',
            detail: `${type} ${id}: ${detail}`,
          },
        };
      }
    }

    // Commit: the novel envelopes reach the log, the intents they
    // derive reach the runners, and only they broadcast — a duplicate
    // is silent. The store already holds the post-batch state; bump
    // before the durable appends so a read that interleaves with them
    // keys its memo on the state it actually sees.
    this.committed += 1;
    await this.cfg.log.appendAll(novel);
    const intents = novel.flatMap(deriveSideEffectsForEnvelope);
    if (intents.length > 0) await this.cfg.intents.enqueueAll(intents);

    for (const { envelope, outcome } of outcomes) {
      if (outcome.status === 'duplicate') continue;
      this.cfg.broadcast.publish({ envelope, outcome, batchId: batch.batchId, applyOrigin });
    }
    this.observeBatch(batch);
    return { ok: true, outcomes };
  }

  private observeBatch(batch: MutationBatch): void {
    if (!this.cfg.onBatchApplied) return;
    let max: HLC | null = null;
    for (const env of batch.mutations) {
      if (!max || compareHlc(env.hlc, max) > 0) max = env.hlc;
    }
    if (max) this.cfg.onBatchApplied(max);
  }

  private async lockChain<T>(targets: ReadonlyArray<{ type: string; id: string }>, fn: () => Promise<T>): Promise<T> {
    if (targets.length === 0) return fn();
    const [head, ...rest] = targets;
    return this.cfg.lock(this.cfg.workspaceId, head.type, head.id, () => this.lockChain(rest, fn));
  }
}

function collectEntityTargets(envelopes: ReadonlyArray<MutationEnvelope>): Array<{ type: string; id: string }> {
  const seen = new Set<string>();
  const out: Array<{ type: string; id: string }> = [];
  for (const env of envelopes) {
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
