/**
 * `createMqttResponseExample` + `deleteMqttResponseExample` — example
 * entity lifecycle. Each is a single-envelope batch; the create payload
 * is the flat `MqttResponseExample` minus `uid` (carried on the
 * envelope as `id`). Duplicate is a fresh create with a new uid — no
 * dedicated mutation.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE } from './types';

export interface CreateMqttResponseExampleArgs {
  mqttResponseExampleUid: string;
  /** Full `MqttResponseExample` minus `uid` (carried on the envelope as `id`). */
  payload: unknown;
}

export function createMqttResponseExample(ctx: MutatorContext, args: CreateMqttResponseExampleArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'create',
      type: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: args.mqttResponseExampleUid,
      payload: args.payload,
    },
  ]);
  return { batch, sideEffects: [] };
}

export interface DeleteMqttResponseExampleArgs {
  mqttResponseExampleUid: string;
}

export function deleteMqttResponseExample(ctx: MutatorContext, args: DeleteMqttResponseExampleArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    { kind: 'delete', type: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE, id: args.mqttResponseExampleUid },
  ]);
  return { batch, sideEffects: [] };
}
