/**
 * gRPC response-example write-site → oracle helpers.
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
  deleteGrpcResponseExample,
  GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
  type GrpcResponseExampleParentRef,
  type GrpcResponseExampleScalarPath,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  type SideEffectIntent,
} from '@openheaders/core/sync';
import type { CapturedGrpcRequest, CapturedGrpcResponse, GrpcResponseExample } from '@openheaders/core/types';
import { seedGrpcResponseExample } from '../projections/grpc-response-example-projection';

export interface GrpcResponseExampleMutationPayload {
  batch: MutationBatch;
  sideEffects: SideEffectIntent[];
}

/**
 * New example → seed batch. `placement` is the request whose
 * `examples` slot the example takes in the same batch; `null` only
 * when the write site deliberately leaves the example slot-less (the
 * reconciler seeds it from its stored parent uid).
 */
export function buildAddGrpcResponseExampleBatch(
  example: GrpcResponseExample,
  ctx: MutatorContext,
  placement: ChildPlacement<GrpcResponseExampleParentRef> | null,
): GrpcResponseExampleMutationPayload {
  return { batch: seedGrpcResponseExample(example, ctx, placement ?? undefined), sideEffects: [] };
}

/** Delete an example: the request's slot tombstone + the entity tombstone in one batch. */
export function buildDeleteGrpcResponseExampleBatch(
  exampleUid: string,
  parent: GrpcResponseExampleParentRef,
  ctx: MutatorContext,
): GrpcResponseExampleMutationPayload {
  return deleteGrpcResponseExample(ctx, { grpcResponseExampleUid: exampleUid, parent });
}

/**
 * Bare example-entity tombstone for the request-delete cascade, where
 * the request (and with it the slot set) is going too.
 */
export function buildDeleteGrpcResponseExampleEntityBatch(
  exampleUid: string,
  ctx: MutatorContext,
): GrpcResponseExampleMutationPayload {
  const bodies: MutationBody[] = [{ kind: 'delete', type: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE, id: exampleUid }];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

/** Content edits an example editor saves in one batch. */
export interface GrpcResponseExampleContentUpdates {
  request?: CapturedGrpcRequest;
  response?: CapturedGrpcResponse;
}

/**
 * Content patch: one `setField` per edited captured block. Each block
 * writes as a whole LWW value — capture rows are not set-modeled, so
 * concurrent edits resolve per block.
 */
export function buildUpdateGrpcResponseExampleBatch(
  exampleUid: string,
  updates: GrpcResponseExampleContentUpdates,
  ctx: MutatorContext,
): GrpcResponseExampleMutationPayload {
  const bodies: MutationBody[] = [];
  for (const path of ['request', 'response'] as const) {
    const value = updates[path];
    if (value === undefined) continue;
    bodies.push({
      kind: 'setField',
      type: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
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
export function buildRenameGrpcResponseExampleBatch(
  exampleUid: string,
  updates: Partial<Record<GrpcResponseExampleScalarPath, string>>,
  ctx: MutatorContext,
): GrpcResponseExampleMutationPayload {
  const bodies: MutationBody[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    bodies.push({
      kind: 'setField',
      type: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: exampleUid,
      path: key,
      value,
    });
  }
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}
