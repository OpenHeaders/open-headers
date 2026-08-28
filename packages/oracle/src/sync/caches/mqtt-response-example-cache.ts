/**
 * MQTT response-example cache + persistence sink. Thin adapter over
 * `flat-entity-cache.ts` — parallel to `ws-response-example-cache.ts`.
 */

import { MqttResponseExampleSchema } from '@openheaders/core/schemas';
import { MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE } from '@openheaders/core/sync';
import {
  projectMqttResponseExample,
  seedMqttResponseExample,
} from '@openheaders/core/sync-builders/projections/mqtt-response-example-projection';
import type { MqttResponseExample } from '@openheaders/core/types';
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

export type MqttResponseExampleCacheListener = () => void;

export interface MqttResponseExampleCache {
  readonly workspaceId: string;
  getMqttResponseExamples(): MqttResponseExample[];
  seedFromPersistedMqttResponseExamples(items: MqttResponseExample[]): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: MqttResponseExampleCacheListener): () => void;
  dispose(): void;
}

export function createMqttResponseExampleCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): MqttResponseExampleCache {
  const core = createFlatEntityCache<MqttResponseExample, typeof MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE>(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE,
      loggerTag: 'MqttResponseExampleCache',
      storageKey: (ws) => wsKeys(ws).mqttResponseExamples,
      project: (materialized, oracle) =>
        projectMqttResponseExample(materialized, resolveExampleParent(oracle, materialized.id)),
      arrange: (entities, oracle) => arrangeInExampleOrder(oracle, (e) => e.mqttRequestUid, entities),
      // Own envelopes plus the containment envelopes the projected path
      // and parent depend on: the request's `examples` slots and the
      // request tree's own slots (a folder move cascades through here).
      affects: (event) =>
        event.envelope.body.type === MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE ||
        affectsExampleContainment(event.envelope.body) ||
        affectsTreeContainment(event.envelope.body, REQUEST_TREE),
      seed: seedMqttResponseExample,
      loadFromStorage: (ws) =>
        hostStorage.getValidatedArray(wsKeys(ws).mqttResponseExamples, MqttResponseExampleSchema, {
          onError: driftRecorder({
            subsystem: 'request-executor',
            storageKey: wsKeys(ws).mqttResponseExamples.key,
            workspaceId: ws,
          }),
        }),
    },
  );
  return {
    workspaceId: core.workspaceId,
    getMqttResponseExamples: core.getEntities,
    seedFromPersistedMqttResponseExamples: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
