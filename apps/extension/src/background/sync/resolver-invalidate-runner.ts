/**
 * Resolver-invalidate runner (Phase B).
 *
 * Drains `INVALIDATE_RESOLVER` intents from `oh.sync.intents` whenever
 * a broadcast lands on a configured entity type. Every variable-scope
 * mutator (env vars, collection vars; workspace vars + vault join in
 * future sessions) emits the intent alongside its mutation batch
 * (§18.1); by the time the broadcast arrives here, the oracle has
 * persisted the canonical `(INVALIDATE_RESOLVER, key) → latest-HLC`
 * entry to IDB and the corresponding entity cache has re-projected.
 *
 * The runner's responsibility is to push the "resolver's view of `key`
 * is stale" signal into the existing recompile pipeline. The variable
 * resolver re-reads its scope state on every DNR compile via
 * `syncResolverFromStores()`, so flushing is `scheduleUpdate('rules')`
 * — same primitive the DNR runner uses. Coalescing falls out of:
 *   - IdbPendingIntents — one entry per `(INVALIDATE_RESOLVER, key)`
 *     at highest HLC.
 *   - `scheduleUpdate` — debounces + hash-guards so identical
 *     post-commit rule sets recompile once.
 *
 * Subscription ordering: wire AFTER the entity caches. The caches'
 * broadcast subscriptions re-project the oracle and bridge state back
 * into the legacy stores; the runner then asks for a recompile that
 * re-reads post-commit state. Reversing the order would race the
 * cache.
 */

import { INVALIDATE_RESOLVER, type EntityType } from '@openheaders/core/sync';
import { logger } from '@utils/logger';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import type { PendingIntents } from './pending-intents';

export interface ResolverInvalidateRunnerConfig {
  broadcast: InMemoryBroadcast;
  intents: PendingIntents;
  /** Entity types whose envelopes should trigger a drain attempt. */
  entityTypes: ReadonlySet<EntityType>;
  /**
   * Recompile primitive — wired to `rule-engine.scheduleUpdate` in
   * production. Swappable in tests so we can assert "this runner
   * asked for a recompile" without booting the DNR layer.
   */
  recompile: (reason: string) => void;
}

export interface ResolverInvalidateRunner {
  /** Tear down the broadcast subscription. Idempotent. */
  dispose(): void;
}

export function createResolverInvalidateRunner(
  config: ResolverInvalidateRunnerConfig,
): ResolverInvalidateRunner {
  const { broadcast, intents, entityTypes, recompile } = config;

  const handle = async (event: BroadcastEvent): Promise<void> => {
    if (!entityTypes.has(event.envelope.body.type)) return;
    const key = event.envelope.body.id;
    const drained = await intents.drain(INVALIDATE_RESOLVER, key);
    if (!drained) return;
    recompile('rules');
  };

  const unsubscribe = broadcast.subscribe((event) => {
    void handle(event).catch((err: Error) => {
      logger.info('ResolverInvalidateRunner', `drain failed: ${err.message}`);
    });
  });

  return {
    dispose() {
      unsubscribe();
    },
  };
}

