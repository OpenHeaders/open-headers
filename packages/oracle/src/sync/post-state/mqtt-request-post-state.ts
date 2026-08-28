/**
 * Per-envelope MqttRequest post-state projection.
 *
 * Thin adapter over `flat-entity-post-state.ts` — parallel to
 * `websocket-request-post-state.ts`. Renderer-side write helpers need
 * the live `(itemId, orderKey)` pairs at the set-modeled `topics` /
 * `savedMessages` / `userProperties` paths before they can emit
 * matching synthesizer envelopes (§19.4).
 */

import type { SyncMqttRequestPostState } from '@openheaders/core/protocol';
import {
  MQTT_REQUEST_ENTITY_TYPE,
  MQTT_REQUEST_SAVED_MESSAGES_PATH,
  MQTT_REQUEST_TOPICS_PATH,
  MQTT_REQUEST_USER_PROPERTIES_PATH,
} from '@openheaders/core/sync';
import { projectMqttRequest } from '@openheaders/core/sync-builders/projections/mqtt-request-projection';
import type { MqttRequest } from '@openheaders/core/types';
import type { EntityOracle } from '../oracle';
import { buildSetMembersExtras, makeFlatEntityProjectors } from './flat-entity-post-state';
import { resolveLeafParentPath } from './folder-tree-post-state';
import { REQUEST_TREE } from './request-folder-post-state';

/** Set-modeled paths on an MqttRequest — mirrors the projection's set handling. */
const MQTT_REQUEST_SET_PATHS = [
  MQTT_REQUEST_TOPICS_PATH,
  MQTT_REQUEST_SAVED_MESSAGES_PATH,
  MQTT_REQUEST_USER_PROPERTIES_PATH,
] as const;

type Reads = Pick<
  EntityOracle,
  'materializeOne' | 'materializeAll' | 'liveSetItems' | 'liveOrderedSetItems' | 'revision'
>;

const projectors = makeFlatEntityProjectors<Reads, MqttRequest, SyncMqttRequestPostState>({
  entityType: MQTT_REQUEST_ENTITY_TYPE,
  project: (materialized, oracle) =>
    projectMqttRequest(materialized, resolveLeafParentPath(oracle, materialized.id, REQUEST_TREE)),
  composeResult: (mqttRequest, oracle, uid) => ({
    mqttRequest,
    ...buildSetMembersExtras(oracle, MQTT_REQUEST_ENTITY_TYPE, uid, MQTT_REQUEST_SET_PATHS),
  }),
});

export const projectMqttRequestPostState = projectors.projectPostState;
export const projectMqttRequestByUid = projectors.projectByUid;
