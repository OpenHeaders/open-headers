/**
 * Per-envelope MQTT response-example post-state projection.
 *
 * Thin adapter over `flat-entity-post-state.ts`. Examples are flat
 * records with no set-modeled paths of their own; `path` and the
 * parent uid project from the live `examples` slot on the request
 * (`example-tree-post-state.ts`), the stored values being the net.
 */

import type { SyncMqttResponseExamplePostState } from '@openheaders/core/protocol';
import { MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE } from '@openheaders/core/sync';
import { projectMqttResponseExample } from '@openheaders/core/sync-builders/projections/mqtt-response-example-projection';
import type { MqttResponseExample } from '@openheaders/core/types';
import type { EntityOracle } from '../oracle';
import { resolveExampleParent } from './example-tree-post-state';
import { makeFlatEntityProjectors } from './flat-entity-post-state';

type Reads = Pick<
  EntityOracle,
  'materializeOne' | 'materializeAll' | 'liveSetItems' | 'liveOrderedSetItems' | 'revision'
>;

const projectors = makeFlatEntityProjectors<Reads, MqttResponseExample, SyncMqttResponseExamplePostState>({
  entityType: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE,
  project: (materialized, oracle) =>
    projectMqttResponseExample(materialized, resolveExampleParent(oracle, materialized.id)),
  composeResult: (mqttResponseExample) => ({ mqttResponseExample }),
});

export const projectMqttResponseExamplePostState = projectors.projectPostState;
export const projectMqttResponseExampleByUid = projectors.projectByUid;
