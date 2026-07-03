/**
 * Live-value cache (WS-C C6).
 *
 * Thin adapter over the shared `singleton-entity-cache.ts` core. The
 * synced subset of every workflow-run cache row — `stepCaptures` +
 * `extractedAt` + `expiresAt`, keyed by run-key.
 *
 * Unlike the other singleton caches this one has **no persisted key of
 * its own**: the host's existing `oh.ws.<id>.liveCache` blob is the
 * single at-rest store. `loadFromStorage` projects the value subset out
 * of that blob to seed the oracle on (re-)materialization, and the
 * live-layer bridge (`live-value-store.ts`) projects this entity's
 * materialized form back into the blob — merging the value subset with
 * each host's local runner bookkeeping. So `persist` is intentionally
 * omitted; double-writing the value to a second key would only
 * duplicate it at rest.
 *
 * Sensitive in full — a resolved capture set can hold an access token.
 */

import { LIVE_VALUE_ENTITY_TYPE } from '@openheaders/core/sync';
import { type LiveValueSnapshot, seedLiveValues } from '@openheaders/core/sync-builders/projections/live-value-projection';
import type { LiveValueRecord, WorkflowRunCache } from '@openheaders/core/types';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import type { InMemoryBroadcast } from './broadcast';
import { projectLiveValueSingleton } from './live-value-post-state';
import type { EntityOracle } from './oracle';
import { createSingletonEntityCache, type SingletonEntityCache } from './singleton-entity-cache';
import type { SwMutatorContextFactory } from './sw-context';

const EMPTY_SNAPSHOT: LiveValueSnapshot = { schemaVersion: 5, values: {} };

export type LiveValueCacheListener = () => void;

export interface LiveValueCache {
  readonly workspaceId: string;
  getSnapshot(): LiveValueSnapshot;
  seedFromPersistedLiveValues(snapshot: LiveValueSnapshot): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: LiveValueCacheListener): () => void;
  dispose(): void;
}

/** Project the synced value subset out of the host-local liveCache blob. */
function projectFromLiveCacheBlob(raw: unknown): LiveValueSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const runs = (raw as { runs?: unknown }).runs;
  if (!runs || typeof runs !== 'object') return null;
  const values: Record<string, LiveValueRecord> = {};
  for (const [runKey, row] of Object.entries(runs as Record<string, WorkflowRunCache>)) {
    if (!row || typeof row !== 'object') continue;
    // Never-extracted rows (failure-only, extractedAt === 0) carry no
    // value to propagate — skip so a peer doesn't receive an empty shell.
    if (typeof row.extractedAt !== 'number' || row.extractedAt === 0) continue;
    values[runKey] = {
      workflowUid: row.workflowUid,
      environmentId: row.environmentId,
      stepCaptures: row.stepCaptures ?? {},
      extractedAt: row.extractedAt,
      expiresAt: row.expiresAt ?? null,
      refreshHealth: row.refreshHealth,
    };
  }
  return { schemaVersion: 5, values };
}

export function createLiveValueCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): LiveValueCache {
  const core: SingletonEntityCache<LiveValueSnapshot, LiveValueSnapshot> = createSingletonEntityCache(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: LIVE_VALUE_ENTITY_TYPE,
      loggerTag: 'LiveValueCache',
      emptySnapshot: EMPTY_SNAPSHOT,
      project: (o, current) => {
        const projection = projectLiveValueSingleton(o);
        if (!projection) return null;
        return { schemaVersion: current.schemaVersion || 5, values: projection.values };
      },
      buildSeedBatch: (input, ctx) => seedLiveValues(input, ctx),
      // No `persist`: the live-layer bridge merges into the liveCache blob.
      loadFromStorage: async (scope) => {
        const raw = await hostStorage.get(wsKeys(scope).liveCache);
        return projectFromLiveCacheBlob(raw);
      },
    },
  );

  return {
    workspaceId: core.scope,
    getSnapshot: core.getSnapshot,
    seedFromPersistedLiveValues: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
