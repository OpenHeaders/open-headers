/**
 * MqttRequest cache + persistence sink. Thin adapter over
 * `flat-entity-cache.ts` — parallel to `websocket-request-cache.ts`.
 */

import { MqttRequestSchema } from '@openheaders/core/schemas';
import { MQTT_REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import {
  projectMqttRequest,
  seedMqttRequest,
} from '@openheaders/core/sync-builders/projections/mqtt-request-projection';
import type { MqttRequest } from '@openheaders/core/types';
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

export type MqttRequestCacheListener = () => void;

export interface MqttRequestCache {
  readonly workspaceId: string;
  getMqttRequests(): MqttRequest[];
  seedFromPersistedMqttRequests(requests: MqttRequest[]): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: MqttRequestCacheListener): () => void;
  dispose(): void;
}

export function createMqttRequestCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): MqttRequestCache {
  const core = createFlatEntityCache<MqttRequest, typeof MQTT_REQUEST_ENTITY_TYPE>(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: MQTT_REQUEST_ENTITY_TYPE,
      loggerTag: 'MqttRequestCache',
      storageKey: (ws) => wsKeys(ws).mqttRequests,
      filterBroadcastByType: true,
      project: (materialized, oracle) =>
        projectMqttRequest(materialized, resolveLeafParentPath(oracle, materialized.id, REQUEST_TREE)),
      arrange: (entities, oracle) => arrangeInTreeOrder(oracle, REQUEST_TREE, entities),
      // Own envelopes plus the containment envelopes a leaf's projected
      // path and sibling order depend on (a parent's `folders` / `items`
      // slots — folder moves cascade through here).
      affects: (event) =>
        event.envelope.body.type === MQTT_REQUEST_ENTITY_TYPE ||
        affectsTreeContainment(event.envelope.body, REQUEST_TREE),
      seed: seedMqttRequest,
      loadFromStorage: (ws) =>
        hostStorage.getValidatedArray(wsKeys(ws).mqttRequests, MqttRequestSchema, {
          onError: driftRecorder({
            subsystem: 'request-executor',
            storageKey: wsKeys(ws).mqttRequests.key,
            workspaceId: ws,
          }),
        }),
    },
  );
  return {
    workspaceId: core.workspaceId,
    getMqttRequests: core.getEntities,
    seedFromPersistedMqttRequests: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
