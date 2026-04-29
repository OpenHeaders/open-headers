/**
 * Environment side-effect runner (Phase B).
 *
 * Drains `invalidate-resolver` intents from `oh.sync.intents` whenever
 * an Environment envelope lands on the broadcast bus. The intents are
 * emitted by every variable-touching env mutator alongside the
 * mutation batch (§18.1); by the time a broadcast arrives here, the
 * oracle has persisted the canonical `(INVALIDATE_RESOLVER, envId) →
 * latest-HLC` entry to IDB and the env-cache has re-projected.
 *
 * The runner's responsibility is to push that "the resolver's view of
 * `envId` is stale" signal into the existing recompile pipeline.
 * Today the variable resolver re-reads its scope state (envs, vault,
 * collection vars) on every DNR compile via
 * `syncResolverFromStores()` in `variables-resolver.ts`, so flushing
 * is `scheduleUpdate('rules')` — same primitive the DNR runner uses.
 * Coalescing falls out of:
 *   - IdbPendingIntents — one entry per `(INVALIDATE_RESOLVER, envId)`
 *     at highest HLC.
 *   - `scheduleUpdate` — debounces + hash-guards so identical
 *     post-commit rule sets recompile once.
 *
 * Subscription ordering: wire AFTER the env cache. The cache's
 * broadcast subscription re-projects the oracle and (post-commit-4)
 * mirrors back into env-store; the runner then asks for a recompile
 * that re-reads `getEnvironments()`. Reversing the order would have
 * the runner racing the cache.
 */

import { ENVIRONMENT_ENTITY_TYPE, INVALIDATE_RESOLVER } from '@openheaders/core/sync';
import { logger } from '@utils/logger';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import type { PendingIntents } from './pending-intents';

export interface EnvInvalidateRunnerConfig {
  broadcast: InMemoryBroadcast;
  intents: PendingIntents;
  /**
   * Recompile primitive — wired to `rule-engine.scheduleUpdate` in
   * production. Swappable in tests so we can assert "this runner
   * asked for a recompile" without booting the DNR layer.
   */
  recompile: (reason: string) => void;
}

export interface EnvInvalidateRunner {
  /** Tear down the broadcast subscription. Idempotent. */
  dispose(): void;
}

export function createEnvInvalidateRunner(config: EnvInvalidateRunnerConfig): EnvInvalidateRunner {
  const { broadcast, intents, recompile } = config;

  const handle = async (event: BroadcastEvent): Promise<void> => {
    if (event.envelope.body.type !== ENVIRONMENT_ENTITY_TYPE) return;
    const envId = event.envelope.body.id;
    const drained = await intents.drain(INVALIDATE_RESOLVER, envId);
    if (!drained) return;
    // Recompile re-reads `getEnvironments()` through
    // `syncResolverFromStores()`. Once commit 4 bridges the env-cache
    // back into env-store, that read returns post-commit state.
    recompile('rules');
  };

  const unsubscribe = broadcast.subscribe((event) => {
    void handle(event).catch((err: Error) => {
      logger.info('EnvInvalidateRunner', `drain failed: ${err.message}`);
    });
  });

  return {
    dispose() {
      unsubscribe();
    },
  };
}
