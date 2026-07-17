/**
 * gRPC response-example cache + persistence sink. Thin adapter over
 * `flat-entity-cache.ts` — parallel to `response-example-cache.ts`.
 */

import { GrpcResponseExampleSchema } from '@openheaders/core/schemas';
import { GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE } from '@openheaders/core/sync';
import {
  projectGrpcResponseExample,
  seedGrpcResponseExample,
} from '@openheaders/core/sync-builders/projections/grpc-response-example-projection';
import type { GrpcResponseExample } from '@openheaders/core/types';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import type { InMemoryBroadcast } from '../broadcast';
import type { EntityOracle } from '../oracle';
import { driftRecorder } from '../storage-drift';
import type { SwMutatorContextFactory } from '../sw-context';
import { createFlatEntityCache } from './flat-entity-cache';

export type GrpcResponseExampleCacheListener = () => void;

export interface GrpcResponseExampleCache {
  readonly workspaceId: string;
  getGrpcResponseExamples(): GrpcResponseExample[];
  seedFromPersistedGrpcResponseExamples(items: GrpcResponseExample[]): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: GrpcResponseExampleCacheListener): () => void;
  dispose(): void;
}

export function createGrpcResponseExampleCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): GrpcResponseExampleCache {
  const core = createFlatEntityCache<GrpcResponseExample, typeof GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE>(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
      loggerTag: 'GrpcResponseExampleCache',
      storageKey: (ws) => wsKeys(ws).grpcResponseExamples,
      project: projectGrpcResponseExample,
      seed: seedGrpcResponseExample,
      loadFromStorage: (ws) =>
        hostStorage.getValidatedArray(wsKeys(ws).grpcResponseExamples, GrpcResponseExampleSchema, {
          onError: driftRecorder({
            subsystem: 'request-executor',
            storageKey: wsKeys(ws).grpcResponseExamples.key,
            workspaceId: ws,
          }),
        }),
    },
  );
  return {
    workspaceId: core.workspaceId,
    getGrpcResponseExamples: core.getEntities,
    seedFromPersistedGrpcResponseExamples: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
