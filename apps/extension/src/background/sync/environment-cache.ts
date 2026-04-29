/**
 * Environment cache + persistence sink (Phase B).
 *
 * Mirrors `rule-cache.ts`:
 *
 *   - Subscribes to the oracle's broadcast bus. Every committed
 *     Environment envelope re-projects the oracle's full materialized
 *     state to a `V5.Environment[]` and updates this module's
 *     in-memory cache.
 *   - Persists the projected `V5.Environment[]` back to
 *     `chrome.storage.local` under the workspace's `environments` key
 *     so legacy readers (resolvers, exporter, settings UI) keep
 *     working without changes.
 *   - Notifies registered listeners after each cache update so the
 *     SW's environment-store can re-fan-out `environmentsUpdated` and
 *     drive the variable resolver invalidation pipeline.
 *
 * Hydration: `seedFromPersistedEnvironments(envs)` walks each
 * persisted environment, builds a `seedEnvironment` batch, and
 * applies it through the oracle. The broadcasts that fire during
 * hydration replay through this same sink — write-back is byte-
 * identical and idempotent. Cost is one extra `extensionStorage.set`
 * per cold wake, parity with rule-cache.
 *
 * Workspace switch contract: the sync service constructs one cache
 * per workspace and disposes the previous one. Callers reach the
 * active cache via {@link getActiveEnvironmentCache} — null between
 * `dispose()` and the next `createEnvironmentCache` so reads during
 * the transient window fall through to the legacy paths instead of
 * seeing stale data.
 */

import type { MaterializedEntity } from '@openheaders/core/sync';
import { ENVIRONMENT_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { extensionStorage, wsKeys } from '@/shared/storage';
import { projectEnvironment, seedEnvironment } from '@/shared/sync/env-projection';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export type EnvironmentCacheListener = () => void;

export interface EnvironmentCache {
  readonly workspaceId: string;
  /** Snapshot of the cached environments in stable (uid) order. */
  getEnvironments(): V5.Environment[];
  /** Replace the cache from a list of environment snapshots and seed
   *  the oracle. Drives boot-time hydration and the workspace-switch
   *  path. */
  seedFromPersistedEnvironments(envs: V5.Environment[]): Promise<void>;
  /** Subscribe to cache changes — fires after every broadcast-driven
   *  re-projection. Returns an unsubscribe function. */
  onChange(listener: EnvironmentCacheListener): () => void;
  /** Drop the broadcast subscription. Idempotent. */
  dispose(): void;
}

export function createEnvironmentCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): EnvironmentCache {
  let envs: V5.Environment[] = [];
  const listeners = new Set<EnvironmentCacheListener>();

  const refreshFromOracle = (): void => {
    const next = projectAllEnvironments(oracle.materializeAll());
    envs = next;
    void persist(workspaceId, next);
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        logger.info('EnvironmentCache', 'listener threw:', (err as Error).message);
      }
    }
  };

  // Re-project on every committed broadcast event. Filtering by entity
  // type would save work for non-Environment envelopes, but we need the
  // sort + persist anyway when our state could have changed; the
  // broadcast bus is shared so most events are still other entities.
  // Cost is one materializeAll + one storage.set per envelope; a
  // workspace with < 100 environments stays in microseconds.
  const unsubscribe = broadcast.subscribe((event: BroadcastEvent) => {
    if (event.envelope.body.type !== ENVIRONMENT_ENTITY_TYPE) return;
    refreshFromOracle();
  });

  return {
    workspaceId,
    getEnvironments: () => envs,

    async seedFromPersistedEnvironments(persisted: V5.Environment[]): Promise<void> {
      for (const env of persisted) {
        const batch = seedEnvironment(env, contextFactory());
        const result = await oracle.apply(batch, []);
        if (!result.ok) {
          logger.info(
            'EnvironmentCache',
            `seedFromPersistedEnvironments: env ${env.uid} failed (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
          );
        }
      }
      // Guard the zero-environments edge case — same shape as rule-cache.
      refreshFromOracle();
      logger.info('EnvironmentCache', `Seeded ${persisted.length} environments for ws=${workspaceId}`);
    },

    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    dispose() {
      unsubscribe();
      listeners.clear();
    },
  };
}

// ── module-level singleton glue ───────────────────────────────────

let active: EnvironmentCache | null = null;

export function setActiveEnvironmentCache(cache: EnvironmentCache | null): void {
  active = cache;
}

export function getActiveEnvironmentCache(): EnvironmentCache | null {
  return active;
}

// ── helpers ───────────────────────────────────────────────────────

function projectAllEnvironments(materialized: MaterializedEntity[]): V5.Environment[] {
  const out: V5.Environment[] = [];
  for (const m of materialized) {
    if (m.type !== ENVIRONMENT_ENTITY_TYPE) continue;
    const env = projectEnvironment(m);
    if (env) out.push(env);
  }
  out.sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
  return out;
}

async function persist(workspaceId: string, envs: V5.Environment[]): Promise<void> {
  try {
    await extensionStorage.set(wsKeys(workspaceId).environments, envs);
  } catch (err) {
    logger.info('EnvironmentCache', `persist failed (ws=${workspaceId}):`, (err as Error).message);
  }
}
