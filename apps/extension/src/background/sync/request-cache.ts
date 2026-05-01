/**
 * Request cache + persistence sink. Thin adapter over
 * `flat-entity-cache.ts`.
 */

import { REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { wsKeys } from '@/shared/storage';
import { projectRequest, seedRequest } from '@/shared/sync/request-projection';
import type { InMemoryBroadcast } from './broadcast';
import { createFlatEntityCache } from './flat-entity-cache';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export type RequestCacheListener = () => void;

export interface RequestCache {
  readonly workspaceId: string;
  getRequests(): V5.Request[];
  seedFromPersistedRequests(requests: V5.Request[]): Promise<void>;
  onChange(listener: RequestCacheListener): () => void;
  dispose(): void;
}

export function createRequestCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): RequestCache {
  const core = createFlatEntityCache<V5.Request, typeof REQUEST_ENTITY_TYPE>(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: REQUEST_ENTITY_TYPE,
      loggerTag: 'RequestCache',
      storageKey: (ws) => wsKeys(ws).requests,
      // Re-project only on request envelopes — same architectural
      // tightening applied to `rule-cache.ts`. The legacy
      // "fire on every broadcast" stance produced redundant persists
      // and widened the wipe surface to cross-entity broadcasts.
      filterBroadcastByType: true,
      project: projectRequest,
      seed: seedRequest,
    },
  );
  return {
    workspaceId: core.workspaceId,
    getRequests: core.getEntities,
    seedFromPersistedRequests: core.seedFromPersisted,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}

let active: RequestCache | null = null;

export function setActiveRequestCache(cache: RequestCache | null): void {
  active = cache;
}

export function getActiveRequestCache(): RequestCache | null {
  return active;
}
