/**
 * Response-example write-site → oracle helpers.
 *
 * Pure transforms — no oracle reads, no IO — producing `(batch,
 * sideEffects)` pairs from the catalog factories. A new example takes
 * its request's `examples` slot in the same batch as the entity; a
 * delete tombstones the slot with the entity (or the entity alone when
 * the request is going too). Updates cover `name`/`path` renames
 * plus the captured `request` / `response` blocks (each patched as
 * one LWW value); duplicate is a fresh add with a new uid. Side
 * effects are always empty — examples feed no DNR compile and no
 * variable resolver.
 */

import {
  type ChildPlacement,
  deleteResponseExample,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  RESPONSE_EXAMPLE_ENTITY_TYPE,
  type ResponseExampleParentRef,
  type ResponseExampleScalarPath,
  type SideEffectIntent,
} from '@openheaders/core/sync';
import type { CapturedRequest, CapturedResponse, ResponseExample } from '@openheaders/core/types';
import { seedResponseExample } from '../projections/response-example-projection';

export interface ResponseExampleMutationPayload {
  batch: MutationBatch;
  sideEffects: SideEffectIntent[];
}

/**
 * New example → seed batch. `placement` is the request whose
 * `examples` slot the example takes in the same batch; `null` only
 * when the write site deliberately leaves the example slot-less (the
 * reconciler seeds it from its stored parent uid).
 */
export function buildAddResponseExampleBatch(
  example: ResponseExample,
  ctx: MutatorContext,
  placement: ChildPlacement<ResponseExampleParentRef> | null,
): ResponseExampleMutationPayload {
  return { batch: seedResponseExample(example, ctx, placement ?? undefined), sideEffects: [] };
}

/** Delete an example: the request's slot tombstone + the entity tombstone in one batch. */
export function buildDeleteResponseExampleBatch(
  exampleUid: string,
  parent: ResponseExampleParentRef,
  ctx: MutatorContext,
): ResponseExampleMutationPayload {
  return deleteResponseExample(ctx, { responseExampleUid: exampleUid, parent });
}

/**
 * Bare example-entity tombstone for the request-delete cascade, where
 * the request (and with it the slot set) is going too.
 */
export function buildDeleteResponseExampleEntityBatch(
  exampleUid: string,
  ctx: MutatorContext,
): ResponseExampleMutationPayload {
  const bodies: MutationBody[] = [{ kind: 'delete', type: RESPONSE_EXAMPLE_ENTITY_TYPE, id: exampleUid }];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

/** Content edits an example editor saves in one batch. */
export interface ResponseExampleContentUpdates {
  request?: CapturedRequest;
  response?: CapturedResponse;
}

/**
 * Content patch: one `setField` per edited captured block. Each block
 * writes as a whole LWW value — capture rows are not set-modeled, so
 * concurrent edits resolve per block.
 */
export function buildUpdateResponseExampleBatch(
  exampleUid: string,
  updates: ResponseExampleContentUpdates,
  ctx: MutatorContext,
): ResponseExampleMutationPayload {
  const bodies: MutationBody[] = [];
  for (const path of ['request', 'response'] as const) {
    const value = updates[path];
    if (value === undefined) continue;
    bodies.push({
      kind: 'setField',
      type: RESPONSE_EXAMPLE_ENTITY_TYPE,
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
export function buildRenameResponseExampleBatch(
  exampleUid: string,
  updates: Partial<Record<ResponseExampleScalarPath, string>>,
  ctx: MutatorContext,
): ResponseExampleMutationPayload {
  const bodies: MutationBody[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    bodies.push({
      kind: 'setField',
      type: RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: exampleUid,
      path: key,
      value,
    });
  }
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}
