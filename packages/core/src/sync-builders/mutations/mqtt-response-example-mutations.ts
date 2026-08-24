/**
 * MQTT response-example write-site → oracle helpers.
 *
 * Pure transforms — no oracle reads, no IO — mirroring
 * {@link ws-response-example-mutations}. Updates cover `name`/`path`
 * renames plus the captured `request` / `response` blocks (each
 * patched as one LWW value); duplicate is a fresh add with a new uid.
 * Side effects are always empty — examples feed no DNR compile and no
 * variable resolver.
 */

import {
  MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE,
  type MqttResponseExampleScalarPath,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  type SideEffectIntent,
} from '@openheaders/core/sync';
import type { CapturedMqttRequest, CapturedMqttResponse, MqttResponseExample } from '@openheaders/core/types';
import { seedMqttResponseExample } from '../projections/mqtt-response-example-projection';

export interface MqttResponseExampleMutationPayload {
  batch: MutationBatch;
  sideEffects: SideEffectIntent[];
}

export function buildAddMqttResponseExampleBatch(
  example: MqttResponseExample,
  ctx: MutatorContext,
): MqttResponseExampleMutationPayload {
  return { batch: seedMqttResponseExample(example, ctx), sideEffects: [] };
}

export function buildDeleteMqttResponseExampleBatch(
  exampleUid: string,
  ctx: MutatorContext,
): MqttResponseExampleMutationPayload {
  const bodies: MutationBody[] = [{ kind: 'delete', type: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE, id: exampleUid }];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

/** Content edits an example editor saves in one batch. */
export interface MqttResponseExampleContentUpdates {
  request?: CapturedMqttRequest;
  response?: CapturedMqttResponse;
}

/**
 * Content patch: one `setField` per edited captured block. Each block
 * writes as a whole LWW value — capture rows are not set-modeled, so
 * concurrent edits resolve per block.
 */
export function buildUpdateMqttResponseExampleBatch(
  exampleUid: string,
  updates: MqttResponseExampleContentUpdates,
  ctx: MutatorContext,
): MqttResponseExampleMutationPayload {
  const bodies: MutationBody[] = [];
  for (const path of ['request', 'response'] as const) {
    const value = updates[path];
    if (value === undefined) continue;
    bodies.push({
      kind: 'setField',
      type: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: exampleUid,
      path,
      value: JSON.parse(JSON.stringify(value)) as unknown,
    });
  }
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

/**
 * Rename patch: per-leaf `setField` envelopes over the string scalars
 * (`name`, plus `path` when a parent request rename cascades).
 */
export function buildRenameMqttResponseExampleBatch(
  exampleUid: string,
  updates: Partial<Record<MqttResponseExampleScalarPath, string>>,
  ctx: MutatorContext,
): MqttResponseExampleMutationPayload {
  const bodies: MutationBody[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    bodies.push({
      kind: 'setField',
      type: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: exampleUid,
      path: key,
      value,
    });
  }
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}
