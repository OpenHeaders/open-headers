/**
 * MQTT response-example projection — `MqttResponseExample ⇄
 * MutationBatch / MaterializedEntity`. The entity is a frozen flat
 * record, so the seed is a single `create` envelope and the projection
 * is a plain shape check.
 */

import {
  type MaterializedEntity,
  MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
} from '@openheaders/core/sync';
import type { MqttResponseExample } from '@openheaders/core/types';

export function seedMqttResponseExample(example: MqttResponseExample, ctx: MutatorContext): MutationBatch {
  const payload = JSON.parse(JSON.stringify(example)) as Record<string, unknown>;
  const bodies: MutationBody[] = [
    { kind: 'create', type: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE, id: example.uid, payload },
  ];
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` back into an `MqttResponseExample`.
 * Returns `null` when the materialized data fails basic shape checks —
 * callers persist only when projection succeeds.
 */
export function projectMqttResponseExample(materialized: MaterializedEntity): MqttResponseExample | null {
  if (materialized.type !== MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  return data as MqttResponseExample;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
