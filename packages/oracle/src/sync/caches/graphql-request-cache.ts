/**
 * GraphqlRequest cache + persistence sink. Thin adapter over
 * `flat-entity-cache.ts` — parallel to `websocket-request-cache.ts`.
 */

import { GraphqlRequestSchema } from '@openheaders/core/schemas';
import { GRAPHQL_REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import {
  projectGraphqlRequest,
  seedGraphqlRequest,
} from '@openheaders/core/sync-builders/projections/graphql-request-projection';
import type { GraphqlRequest } from '@openheaders/core/types';
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

export type GraphqlRequestCacheListener = () => void;

export interface GraphqlRequestCache {
  readonly workspaceId: string;
  getGraphqlRequests(): GraphqlRequest[];
  seedFromPersistedGraphqlRequests(requests: GraphqlRequest[]): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: GraphqlRequestCacheListener): () => void;
  dispose(): void;
}

export function createGraphqlRequestCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): GraphqlRequestCache {
  const core = createFlatEntityCache<GraphqlRequest, typeof GRAPHQL_REQUEST_ENTITY_TYPE>(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: GRAPHQL_REQUEST_ENTITY_TYPE,
      loggerTag: 'GraphqlRequestCache',
      storageKey: (ws) => wsKeys(ws).graphqlRequests,
      filterBroadcastByType: true,
      project: (materialized, oracle) =>
        projectGraphqlRequest(materialized, resolveLeafParentPath(oracle, materialized.id, REQUEST_TREE)),
      arrange: (entities, oracle) => arrangeInTreeOrder(oracle, REQUEST_TREE, entities),
      // Own envelopes plus the containment envelopes a leaf's projected
      // path and sibling order depend on (a parent's `folders` / `items`
      // slots — folder moves cascade through here).
      affects: (event) =>
        event.envelope.body.type === GRAPHQL_REQUEST_ENTITY_TYPE ||
        affectsTreeContainment(event.envelope.body, REQUEST_TREE),
      seed: seedGraphqlRequest,
      loadFromStorage: (ws) =>
        hostStorage.getValidatedArray(wsKeys(ws).graphqlRequests, GraphqlRequestSchema, {
          onError: driftRecorder({
            subsystem: 'request-executor',
            storageKey: wsKeys(ws).graphqlRequests.key,
            workspaceId: ws,
          }),
        }),
    },
  );
  return {
    workspaceId: core.workspaceId,
    getGraphqlRequests: core.getEntities,
    seedFromPersistedGraphqlRequests: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
