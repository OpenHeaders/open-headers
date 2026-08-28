/**
 * Response-example cache + persistence sink. Thin adapter over
 * `flat-entity-cache.ts`.
 */

import { ResponseExampleSchema } from '@openheaders/core/schemas';
import { RESPONSE_EXAMPLE_ENTITY_TYPE } from '@openheaders/core/sync';
import {
  projectResponseExample,
  seedResponseExample,
} from '@openheaders/core/sync-builders/projections/response-example-projection';
import type { ResponseExample } from '@openheaders/core/types';
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

export type ResponseExampleCacheListener = () => void;

export interface ResponseExampleCache {
  readonly workspaceId: string;
  getResponseExamples(): ResponseExample[];
  seedFromPersistedResponseExamples(items: ResponseExample[]): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: ResponseExampleCacheListener): () => void;
  dispose(): void;
}

export function createResponseExampleCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): ResponseExampleCache {
  const core = createFlatEntityCache<ResponseExample, typeof RESPONSE_EXAMPLE_ENTITY_TYPE>(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: RESPONSE_EXAMPLE_ENTITY_TYPE,
      loggerTag: 'ResponseExampleCache',
      storageKey: (ws) => wsKeys(ws).responseExamples,
      project: (materialized, oracle) =>
        projectResponseExample(materialized, resolveExampleParent(oracle, materialized.id)),
      arrange: (entities, oracle) => arrangeInExampleOrder(oracle, (e) => e.requestUid, entities),
      // Own envelopes plus the containment envelopes the projected path
      // and parent depend on: the request's `examples` slots and the
      // request tree's own slots (a folder move cascades through here).
      affects: (event) =>
        event.envelope.body.type === RESPONSE_EXAMPLE_ENTITY_TYPE ||
        affectsExampleContainment(event.envelope.body) ||
        affectsTreeContainment(event.envelope.body, REQUEST_TREE),
      seed: seedResponseExample,
      loadFromStorage: (ws) =>
        hostStorage.getValidatedArray(wsKeys(ws).responseExamples, ResponseExampleSchema, {
          onError: driftRecorder({
            subsystem: 'request-executor',
            storageKey: wsKeys(ws).responseExamples.key,
            workspaceId: ws,
          }),
        }),
    },
  );
  return {
    workspaceId: core.workspaceId,
    getResponseExamples: core.getEntities,
    seedFromPersistedResponseExamples: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
