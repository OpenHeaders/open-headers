/**
 * `createResponseExample` + `deleteResponseExample` — example entity lifecycle as a
 * child of its request. Thin adapters over the shared child-mutator
 * factory: the request owns the example's slot in its `examples` set,
 * and the example's `path` + parent uid are projections of that slot.
 * Each is one batch, entity + slot; the create payload is the flat
 * `ResponseExample` minus `uid` (carried on the envelope as `id`). Duplicate is
 * a fresh create with a new uid — no dedicated mutation; examples
 * never move.
 */

import { REQUEST_EXAMPLES_PATH } from '../request/types';
import { makeChildMutators } from '../shared/child-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { RESPONSE_EXAMPLE_ENTITY_TYPE, type ResponseExampleParentRef, type ResponseExampleSlot } from './types';

/** The generic child verbs bound to the request's `examples` set. */
export const responseExampleChild = makeChildMutators<ResponseExampleParentRef, ResponseExampleSlot>({
  entityType: RESPONSE_EXAMPLE_ENTITY_TYPE,
  childrenPath: REQUEST_EXAMPLES_PATH,
  slot: (uid) => ({ uid, type: RESPONSE_EXAMPLE_ENTITY_TYPE }),
  mintBatch,
});

export interface CreateResponseExampleArgs {
  responseExampleUid: string;
  parent: ResponseExampleParentRef;
  /** Full `ResponseExample` minus `uid` (carried on the envelope as `id`). */
  payload: unknown;
  /** Pre-computed fractional-indexing key for the new slot's position. */
  orderKey?: string;
}

export function createResponseExample(ctx: MutatorContext, args: CreateResponseExampleArgs): MutatorIntent {
  return responseExampleChild.create(ctx, {
    childUid: args.responseExampleUid,
    parent: args.parent,
    payload: args.payload,
    orderKey: args.orderKey,
  });
}

export interface DeleteResponseExampleArgs {
  responseExampleUid: string;
  parent: ResponseExampleParentRef;
}

export function deleteResponseExample(ctx: MutatorContext, args: DeleteResponseExampleArgs): MutatorIntent {
  return responseExampleChild.delete(ctx, { childUid: args.responseExampleUid, parent: args.parent });
}
