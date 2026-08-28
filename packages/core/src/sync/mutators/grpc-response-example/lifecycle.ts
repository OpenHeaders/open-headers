/**
 * `createGrpcResponseExample` + `deleteGrpcResponseExample` — example entity lifecycle as a
 * child of its request. Thin adapters over the shared child-mutator
 * factory: the request owns the example's slot in its `examples` set,
 * and the example's `path` + parent uid are projections of that slot.
 * Each is one batch, entity + slot; the create payload is the flat
 * `GrpcResponseExample` minus `uid` (carried on the envelope as `id`). Duplicate is
 * a fresh create with a new uid — no dedicated mutation; examples
 * never move.
 */

import { GRPC_REQUEST_EXAMPLES_PATH } from '../grpc-request/types';
import { makeChildMutators } from '../shared/child-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import {
  GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
  type GrpcResponseExampleParentRef,
  type GrpcResponseExampleSlot,
} from './types';

/** The generic child verbs bound to the request's `examples` set. */
export const grpcResponseExampleChild = makeChildMutators<GrpcResponseExampleParentRef, GrpcResponseExampleSlot>({
  entityType: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
  childrenPath: GRPC_REQUEST_EXAMPLES_PATH,
  slot: (uid) => ({ uid, type: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE }),
  mintBatch,
});

export interface CreateGrpcResponseExampleArgs {
  grpcResponseExampleUid: string;
  parent: GrpcResponseExampleParentRef;
  /** Full `GrpcResponseExample` minus `uid` (carried on the envelope as `id`). */
  payload: unknown;
  /** Pre-computed fractional-indexing key for the new slot's position. */
  orderKey?: string;
}

export function createGrpcResponseExample(ctx: MutatorContext, args: CreateGrpcResponseExampleArgs): MutatorIntent {
  return grpcResponseExampleChild.create(ctx, {
    childUid: args.grpcResponseExampleUid,
    parent: args.parent,
    payload: args.payload,
    orderKey: args.orderKey,
  });
}

export interface DeleteGrpcResponseExampleArgs {
  grpcResponseExampleUid: string;
  parent: GrpcResponseExampleParentRef;
}

export function deleteGrpcResponseExample(ctx: MutatorContext, args: DeleteGrpcResponseExampleArgs): MutatorIntent {
  return grpcResponseExampleChild.delete(ctx, { childUid: args.grpcResponseExampleUid, parent: args.parent });
}
