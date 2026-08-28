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
import {
  affectsExampleContainment,
  arrangeInExampleOrder,
  resolveExampleParent,
} from '../post-state/example-tree-post-state';
import { affectsTreeContainment } from '../post-state/folder-tree-post-state';
import { REQUEST_TREE } from '../post-state/request-folder-post-state';
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
      project: (materialized, oracle) =>
        projectGrpcResponseExample(materialized, resolveExampleParent(oracle, materialized.id)),
      arrange: (entities, oracle) => arrangeInExampleOrder(oracle, (e) => e.grpcRequestUid, entities),
      // Own envelopes plus the containment envelopes the projected path
      // and parent depend on: the request's `examples` slots and the
      // request tree's own slots (a folder move cascades through here).
      affects: (event) =>
        event.envelope.body.type === GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE ||
        affectsExampleContainment(event.envelope.body) ||
        affectsTreeContainment(event.envelope.body, REQUEST_TREE),
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
