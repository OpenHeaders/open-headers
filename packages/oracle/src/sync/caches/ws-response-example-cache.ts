/**
 * WebSocket response-example cache + persistence sink. Thin adapter
 * over `flat-entity-cache.ts` — parallel to
 * `grpc-response-example-cache.ts`.
 */

import { WsResponseExampleSchema } from '@openheaders/core/schemas';
import { WS_RESPONSE_EXAMPLE_ENTITY_TYPE } from '@openheaders/core/sync';
import {
  projectWsResponseExample,
  seedWsResponseExample,
} from '@openheaders/core/sync-builders/projections/ws-response-example-projection';
import type { WsResponseExample } from '@openheaders/core/types';
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

export type WsResponseExampleCacheListener = () => void;

export interface WsResponseExampleCache {
  readonly workspaceId: string;
  getWsResponseExamples(): WsResponseExample[];
  seedFromPersistedWsResponseExamples(items: WsResponseExample[]): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: WsResponseExampleCacheListener): () => void;
  dispose(): void;
}

export function createWsResponseExampleCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): WsResponseExampleCache {
  const core = createFlatEntityCache<WsResponseExample, typeof WS_RESPONSE_EXAMPLE_ENTITY_TYPE>(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: WS_RESPONSE_EXAMPLE_ENTITY_TYPE,
      loggerTag: 'WsResponseExampleCache',
      storageKey: (ws) => wsKeys(ws).wsResponseExamples,
      project: (materialized, oracle) =>
        projectWsResponseExample(materialized, resolveExampleParent(oracle, materialized.id)),
      arrange: (entities, oracle) => arrangeInExampleOrder(oracle, (e) => e.websocketRequestUid, entities),
      // Own envelopes plus the containment envelopes the projected path
      // and parent depend on: the request's `examples` slots and the
      // request tree's own slots (a folder move cascades through here).
      affects: (event) =>
        event.envelope.body.type === WS_RESPONSE_EXAMPLE_ENTITY_TYPE ||
        affectsExampleContainment(event.envelope.body) ||
        affectsTreeContainment(event.envelope.body, REQUEST_TREE),
      seed: seedWsResponseExample,
      loadFromStorage: (ws) =>
        hostStorage.getValidatedArray(wsKeys(ws).wsResponseExamples, WsResponseExampleSchema, {
          onError: driftRecorder({
            subsystem: 'request-executor',
            storageKey: wsKeys(ws).wsResponseExamples.key,
            workspaceId: ws,
          }),
        }),
    },
  );
  return {
    workspaceId: core.workspaceId,
    getWsResponseExamples: core.getEntities,
    seedFromPersistedWsResponseExamples: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
