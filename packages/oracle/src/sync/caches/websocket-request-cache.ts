/**
 * WebSocketRequest cache + persistence sink. Thin adapter over
 * `flat-entity-cache.ts` — parallel to `grpc-request-cache.ts`.
 */

import { WebSocketRequestSchema } from '@openheaders/core/schemas';
import { WEBSOCKET_REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import {
  projectWebSocketRequest,
  seedWebSocketRequest,
} from '@openheaders/core/sync-builders/projections/websocket-request-projection';
import type { WebSocketRequest } from '@openheaders/core/types';
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

export type WebSocketRequestCacheListener = () => void;

export interface WebSocketRequestCache {
  readonly workspaceId: string;
  getWebSocketRequests(): WebSocketRequest[];
  seedFromPersistedWebSocketRequests(requests: WebSocketRequest[]): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: WebSocketRequestCacheListener): () => void;
  dispose(): void;
}

export function createWebSocketRequestCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): WebSocketRequestCache {
  const core = createFlatEntityCache<WebSocketRequest, typeof WEBSOCKET_REQUEST_ENTITY_TYPE>(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: WEBSOCKET_REQUEST_ENTITY_TYPE,
      loggerTag: 'WebSocketRequestCache',
      storageKey: (ws) => wsKeys(ws).websocketRequests,
      filterBroadcastByType: true,
      project: (materialized, oracle) =>
        projectWebSocketRequest(materialized, resolveLeafParentPath(oracle, materialized.id, REQUEST_TREE)),
      arrange: (entities, oracle) => arrangeInTreeOrder(oracle, REQUEST_TREE, entities),
      // Own envelopes plus the containment envelopes a leaf's projected
      // path and sibling order depend on (a parent's `folders` / `items`
      // slots — folder moves cascade through here).
      affects: (event) =>
        event.envelope.body.type === WEBSOCKET_REQUEST_ENTITY_TYPE ||
        affectsTreeContainment(event.envelope.body, REQUEST_TREE),
      seed: seedWebSocketRequest,
      loadFromStorage: (ws) =>
        hostStorage.getValidatedArray(wsKeys(ws).websocketRequests, WebSocketRequestSchema, {
          onError: driftRecorder({
            subsystem: 'request-executor',
            storageKey: wsKeys(ws).websocketRequests.key,
            workspaceId: ws,
          }),
        }),
    },
  );
  return {
    workspaceId: core.workspaceId,
    getWebSocketRequests: core.getEntities,
    seedFromPersistedWebSocketRequests: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
