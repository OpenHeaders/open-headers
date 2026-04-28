/**
 * DNR side-effect runner (Phase A S2–S5).
 *
 * Drains `recompile-dnr` intents from `oh.sync.intents` and triggers a
 * DNR recompile through the existing `scheduleUpdate('rules')` engine.
 * The intents are emitted by every Rule mutator alongside the mutation
 * batch (§18.1) and persisted via the oracle in the same commit — by
 * the time a broadcast lands here, the IDB store already holds the
 * canonical (kind, key) → latest-HLC entry.
 *
 * Coalescing falls out of the existing primitives:
 *   - IdbPendingIntents (R6) keeps one entry per `(kind, ruleUid)` at
 *     the highest HLC. Multiple writes to the same rule collapse to
 *     one drain.
 *   - `scheduleUpdate('rules')` debounces rapid fires through its own
 *     timer + hash-guard; identical post-commit rule sets recompile
 *     once.
 *   - The runner reads the materialized snapshot at execution time
 *     (S4) by going through `scheduleUpdate`, which calls `getRules()`
 *     against the broadcast-driven rule mirror — never the per-envelope
 *     payload (which would freeze the snapshot at enqueue time and
 *     skip later batched changes).
 *
 * Subscription order matters. The runner is wired AFTER the rule cache
 * so by the time the runner fires, the cache has already re-projected
 * the oracle and `rule-store.rules` (the in-memory mirror
 * `scheduleUpdate` reads through `getRules()`) reflects the post-commit
 * state. `service.ts` enforces this ordering at init time.
 */

import { RECOMPILE_DNR, RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import { logger } from '@utils/logger';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import type { PendingIntents } from './pending-intents';

export interface DnrIntentRunnerConfig {
  broadcast: InMemoryBroadcast;
  intents: PendingIntents;
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
  const { broadcast, intents, recompile } = config;

  const handle = async (event: BroadcastEvent): Promise<void> => {
    // Only Rule envelopes trigger DNR recompile. Phase A only emits
    // Rule mutations, but Phase B will widen the broadcast to other
    // entity types — guard now so cross-entity envelopes don't drain
    // unrelated intents.
    if (event.envelope.body.type !== RULE_ENTITY_TYPE) return;
    const ruleUid = event.envelope.body.id;
    const drained = await intents.drain(RECOMPILE_DNR, ruleUid);
    if (!drained) return;
    // Recompile reads `getRules()` at execution time (the rule cache
    // has already re-projected by the time we get here), so the latest
    // post-commit state lands in DNR — even if multiple envelopes for
    // the same rule were committed in this batch.
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
