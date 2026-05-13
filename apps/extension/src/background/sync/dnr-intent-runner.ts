/**
 * DNR side-effect runner (Phase A S2–S5; widened in Phase B for
 * pause-markers).
 *
 * Drains `recompile-dnr` intents from `oh.sync.intents` and triggers a
 * DNR recompile through the existing `scheduleUpdate('rules')` engine.
 * The intents are emitted by every Rule mutator (keyed by ruleUid) and
 * by every pause-markers mutator (keyed by the singleton id) alongside
 * their mutation batches (§18.1) and persisted via the oracle in the
 * same commit — by the time a broadcast lands here, the IDB store
 * already holds the canonical (kind, key) → latest-HLC entry.
 *
 * Coalescing falls out of the existing primitives:
 *   - IdbPendingIntents (R6) keeps one entry per `(kind, key)` at the
 *     highest HLC. Multiple writes to the same key collapse to one
 *     drain.
 *   - `scheduleUpdate('rules')` debounces rapid fires through its own
 *     timer + hash-guard; identical post-commit rule sets recompile
 *     once.
 *   - The runner reads the materialized snapshot at execution time
 *     (S4) by going through `scheduleUpdate`, which calls `getRules()`
 *     against the broadcast-driven rule mirror — never the per-envelope
 *     payload (which would freeze the snapshot at enqueue time and
 *     skip later batched changes).
 *
 * Subscription order matters. The runner is wired AFTER the rule
 * cache + the pause-markers cache so by the time the runner fires,
 * the relevant mirror has already re-projected and `getRules()` /
 * `getPauseMarkers()` reflect post-commit state. `service.ts`
 * enforces this ordering at init time.
 */

import { type EntityType, RECOMPILE_DNR } from '@openheaders/core/sync';
import { logger } from '@openheaders/core/utils';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import type { PendingIntents } from './pending-intents';

export interface DnrIntentRunnerConfig {
  broadcast: InMemoryBroadcast;
  intents: PendingIntents;
  /** Entity types whose envelopes should trigger a drain attempt. The
   *  oracle persists the canonical `(RECOMPILE_DNR, key)` entry across
   *  every emitter; this filter keeps cross-entity envelopes (vault,
   *  template, etc.) from spuriously walking the intents store. */
  entityTypes: ReadonlySet<EntityType>;
  /**
   * The recompile primitive — wired to `rule-engine.scheduleUpdate` in
   * production, swappable in tests so we can assert "this runner asked
   * for a recompile" without booting the DNR layer.
   */
  recompile: (reason: string) => void;
}

export interface DnrIntentRunner {
  /** Tear down the broadcast subscription. Idempotent. */
  dispose(): void;
}

/**
 * Wire the runner. Subscribes immediately so any broadcast that lands
 * after this point routes through the intent drain.
 */
export function createDnrIntentRunner(config: DnrIntentRunnerConfig): DnrIntentRunner {
  const { broadcast, intents, entityTypes, recompile } = config;

  const handle = async (event: BroadcastEvent): Promise<void> => {
    if (!entityTypes.has(event.envelope.body.type)) return;
    const key = event.envelope.body.id;
    const drained = await intents.drain(RECOMPILE_DNR, key);
    if (!drained) return;
    // Recompile reads `getRules()` + `getPauseMarkers()` at execution
    // time — the per-envelope payload would freeze the snapshot at
    // enqueue time and skip later batched changes.
    recompile('rules');
  };

  const unsubscribe = broadcast.subscribe((event) => {
    void handle(event).catch((err: Error) => {
      logger.info('DnrIntentRunner', `drain failed: ${err.message}`);
    });
  });

  return {
    dispose() {
      unsubscribe();
    },
  };
}
