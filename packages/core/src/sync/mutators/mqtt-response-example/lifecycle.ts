/**
 * `createMqttResponseExample` + `deleteMqttResponseExample` — example entity lifecycle as a
 * child of its request. Thin adapters over the shared child-mutator
 * factory: the request owns the example's slot in its `examples` set,
 * and the example's `path` + parent uid are projections of that slot.
 * Each is one batch, entity + slot; the create payload is the flat
 * `MqttResponseExample` minus `uid` (carried on the envelope as `id`). Duplicate is
 * a fresh create with a new uid — no dedicated mutation; examples
 * never move.
 */

import { MQTT_REQUEST_EXAMPLES_PATH } from '../mqtt-request/types';
import { makeChildMutators } from '../shared/child-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import {
  MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE,
  type MqttResponseExampleParentRef,
  type MqttResponseExampleSlot,
} from './types';

/** The generic child verbs bound to the request's `examples` set. */
export const mqttResponseExampleChild = makeChildMutators<MqttResponseExampleParentRef, MqttResponseExampleSlot>({
  entityType: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE,
  childrenPath: MQTT_REQUEST_EXAMPLES_PATH,
  slot: (uid) => ({ uid, type: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE }),
  mintBatch,
});

export interface CreateMqttResponseExampleArgs {
  mqttResponseExampleUid: string;
  parent: MqttResponseExampleParentRef;
  /** Full `MqttResponseExample` minus `uid` (carried on the envelope as `id`). */
  payload: unknown;
  /** Pre-computed fractional-indexing key for the new slot's position. */
  orderKey?: string;
}

export function createMqttResponseExample(ctx: MutatorContext, args: CreateMqttResponseExampleArgs): MutatorIntent {
  return mqttResponseExampleChild.create(ctx, {
    childUid: args.mqttResponseExampleUid,
    parent: args.parent,
    payload: args.payload,
    orderKey: args.orderKey,
  });
}

export interface DeleteMqttResponseExampleArgs {
  mqttResponseExampleUid: string;
  parent: MqttResponseExampleParentRef;
}

export function deleteMqttResponseExample(ctx: MutatorContext, args: DeleteMqttResponseExampleArgs): MutatorIntent {
  return mqttResponseExampleChild.delete(ctx, { childUid: args.mqttResponseExampleUid, parent: args.parent });
}
