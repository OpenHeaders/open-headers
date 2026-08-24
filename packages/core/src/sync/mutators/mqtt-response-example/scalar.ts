/**
 * Scalar `setField` intent factory for MQTT response-example entities.
 *
 * Writable paths: `name` (rename), `path` (parent request rename
 * cascades the folder path), and the captured `request` / `response`
 * blocks — examples start as captures but stay editable afterwards.
 * Each block writes as one LWW value: rows inside a capture are not
 * set-modeled, so concurrent edits resolve per block, not per row.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE } from './types';

/** Writable paths — identity (`uid`) and `capturedAt` (a historical
 *  fact) stay frozen. */
export type MqttResponseExampleScalarPath = 'name' | 'path' | 'request' | 'response';

export interface SetMqttResponseExampleFieldArgs {
  mqttResponseExampleUid: string;
  path: MqttResponseExampleScalarPath;
  /** Field's new value. Schema validation happens at the oracle boundary. */
  value: unknown;
}

export function setMqttResponseExampleField(ctx: MutatorContext, args: SetMqttResponseExampleFieldArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'setField',
      type: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: args.mqttResponseExampleUid,
      path: args.path,
      value: args.value,
    },
  ]);
  return { batch, sideEffects: [] };
}
