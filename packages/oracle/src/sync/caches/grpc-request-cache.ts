/**
 * GrpcRequest cache + persistence sink. Thin adapter over
 * `flat-entity-cache.ts` — parallel to `request-cache.ts`.
 */

import { GrpcRequestSchema } from '@openheaders/core/schemas';
import { GRPC_REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import {
  projectGrpcRequest,
  seedGrpcRequest,
} from '@openheaders/core/sync-builders/projections/grpc-request-projection';
import type { GrpcRequest } from '@openheaders/core/types';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import type { InMemoryBroadcast } from '../broadcast';
import type { EntityOracle } from '../oracle';
import { driftRecorder } from '../storage-drift';
import type { SwMutatorContextFactory } from '../sw-context';
import { createFlatEntityCache } from './flat-entity-cache';

export type GrpcRequestCacheListener = () => void;

export interface GrpcRequestCache {
  readonly workspaceId: string;
  getGrpcRequests(): GrpcRequest[];
  seedFromPersistedGrpcRequests(requests: GrpcRequest[]): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: GrpcRequestCacheListener): () => void;
  dispose(): void;
}

export function createGrpcRequestCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): GrpcRequestCache {
  const core = createFlatEntityCache<GrpcRequest, typeof GRPC_REQUEST_ENTITY_TYPE>(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: GRPC_REQUEST_ENTITY_TYPE,
      loggerTag: 'GrpcRequestCache',
      storageKey: (ws) => wsKeys(ws).grpcRequests,
      filterBroadcastByType: true,
      project: projectGrpcRequest,
      seed: seedGrpcRequest,
      loadFromStorage: (ws) =>
        hostStorage.getValidatedArray(wsKeys(ws).grpcRequests, GrpcRequestSchema, {
          onError: driftRecorder({
            subsystem: 'request-executor',
            storageKey: wsKeys(ws).grpcRequests.key,
            workspaceId: ws,
          }),
        }),
    },
  );
  return {
    workspaceId: core.workspaceId,
    getGrpcRequests: core.getEntities,
    seedFromPersistedGrpcRequests: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
