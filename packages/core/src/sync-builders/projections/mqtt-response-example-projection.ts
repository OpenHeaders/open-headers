/**
 * MQTT response-example projection — `MqttResponseExample ⇄ MutationBatch /
 * MaterializedEntity`. The entity is a flat record with no set-modeled
 * paths, so the seed is one `create` envelope plus, for a NEW example,
 * the parent request's `examples` slot in the same batch; the shell
 * is stamped with its frozen `pathSegment`. Boot-time re-seeds pass
 * no placement.
 *
 * On the way back, `path` and the parent uid are projections of the
 * live slot — the request's projected path plus the segment, and the
 * request the slot sits on. With no live slot (old client, mid-replay)
 * the stored values are the net.
 */

import {
  type ChildPlacement,
  type MaterializedEntity,
  MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE,
  type MqttResponseExampleParentRef,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  mqttResponseExampleChild,
} from '@openheaders/core/sync';
import type { MqttResponseExample } from '@openheaders/core/types';
import { lastPathSegment } from '@openheaders/core/utils';
import { type ExampleParent, projectExamplePath } from './leaf-path';

export function seedMqttResponseExample(
  example: MqttResponseExample,
  ctx: MutatorContext,
  placement?: ChildPlacement<MqttResponseExampleParentRef>,
): MutationBatch {
  const payload = JSON.parse(JSON.stringify(example)) as Record<string, unknown>;
  if (placement) payload.pathSegment ??= lastPathSegment(example.path);
  const bodies: MutationBody[] = [
    { kind: 'create', type: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE, id: example.uid, payload },
  ];
  if (placement) bodies.push(mqttResponseExampleChild.slotAdd(example.uid, placement.parent, placement.orderKey));
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` back into a `MqttResponseExample`. Returns
 * `null` when the materialized data fails basic shape checks — callers
 * persist only when projection succeeds. `parent` is the live slot's
 * request (its projected path + uid); `null` keeps the stored values.
 */
export function projectMqttResponseExample(
  materialized: MaterializedEntity,
  parent: ExampleParent | null = null,
): MqttResponseExample | null {
  if (materialized.type !== MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  const example = data as MqttResponseExample;
  return parent === null
    ? example
    : { ...example, path: projectExamplePath(data, parent.path), mqttRequestUid: parent.uid };
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
