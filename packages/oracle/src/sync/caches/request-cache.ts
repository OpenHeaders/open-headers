/**
 * Request cache + persistence sink. Thin adapter over
 * `flat-entity-cache.ts`.
 */

import { RequestSchema } from '@openheaders/core/schemas';
import { REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import { projectRequest, seedRequest } from '@openheaders/core/sync-builders/projections/request-projection';
import type { Request } from '@openheaders/core/types';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import type { InMemoryBroadcast } from '../broadcast';
import type { EntityOracle } from '../oracle';
import {
  affectsTreeContainment,
  arrangeInTreeOrder,
  resolveLeafParentPath,
} from '../post-state/folder-tree-post-state';
import { REQUEST_TREE } from '../post-state/request-folder-post-state';
import { driftRecorder } from '../storage-drift';
import type { SwMutatorContextFactory } from '../sw-context';
import { createFlatEntityCache } from './flat-entity-cache';

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
      project: (materialized, oracle) =>
        projectRequest(materialized, resolveLeafParentPath(oracle, materialized.id, REQUEST_TREE)),
      arrange: (entities, oracle) => arrangeInTreeOrder(oracle, REQUEST_TREE, entities),
      // Own envelopes plus the containment envelopes a leaf's projected
      // path and sibling order depend on (a parent's `folders` / `items`
      // slots — folder moves cascade through here).
      affects: (event) =>
        event.envelope.body.type === REQUEST_ENTITY_TYPE || affectsTreeContainment(event.envelope.body, REQUEST_TREE),
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
