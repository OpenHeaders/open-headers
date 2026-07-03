/**
 * Request cache + persistence sink. Thin adapter over
 * `flat-entity-cache.ts`.
 */

import { RequestSchema } from '@openheaders/core/schemas';
import { REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import type { Request } from '@openheaders/core/types';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { projectRequest, seedRequest } from '@openheaders/core/sync-builders/projections/request-projection';
import { driftRecorder } from './storage-drift';
import type { InMemoryBroadcast } from './broadcast';
import { createFlatEntityCache } from './flat-entity-cache';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export type RequestCacheListener = () => void;

export interface RequestCache {
  readonly workspaceId: string;
  getRequests(): Request[];
  seedFromPersistedRequests(requests: Request[]): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: RequestCacheListener): () => void;
  dispose(): void;
}

export function createRequestCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): RequestCache {
  const core = createFlatEntityCache<Request, typeof REQUEST_ENTITY_TYPE>(
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
      loadFromStorage: (ws) =>
        hostStorage.getValidatedArray(wsKeys(ws).requests, RequestSchema, {
          onError: driftRecorder({
            subsystem: 'request-executor',
            storageKey: wsKeys(ws).requests.key,
            workspaceId: ws,
          }),
        }),
    },
  );
  return {
    workspaceId: core.workspaceId,
    getRequests: core.getEntities,
    seedFromPersistedRequests: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
