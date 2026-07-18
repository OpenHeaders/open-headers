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
      project: projectWebSocketRequest,
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
