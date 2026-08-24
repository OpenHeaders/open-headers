/**
 * Per-envelope MQTT response-example post-state projection.
 *
 * Thin adapter over `flat-entity-post-state.ts` — parallel to
 * `ws-response-example-post-state.ts`. Examples are frozen flat
 * records — no set-modeled paths, so the projection carries only the
 * projected `MqttResponseExample`.
 */

import type { SyncMqttResponseExamplePostState } from '@openheaders/core/protocol';
import { MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE } from '@openheaders/core/sync';
import { projectMqttResponseExample } from '@openheaders/core/sync-builders/projections/mqtt-response-example-projection';
import type { MqttResponseExample } from '@openheaders/core/types';
import type { EntityOracle } from '../oracle';
import { makeFlatEntityProjectors } from './flat-entity-post-state';

type Reads = Pick<EntityOracle, 'materializeOne'>;

const projectors = makeFlatEntityProjectors<Reads, MqttResponseExample, SyncMqttResponseExamplePostState>({
  entityType: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE,
  project: projectMqttResponseExample,
  composeResult: (mqttResponseExample) => ({ mqttResponseExample }),
});

export const projectMqttResponseExamplePostState = projectors.projectPostState;
export const projectMqttResponseExampleByUid = projectors.projectByUid;
