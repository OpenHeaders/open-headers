/**
 * `createWsResponseExample` + `deleteWsResponseExample` — example entity lifecycle as a
 * child of its request. Thin adapters over the shared child-mutator
 * factory: the request owns the example's slot in its `examples` set,
 * and the example's `path` + parent uid are projections of that slot.
 * Each is one batch, entity + slot; the create payload is the flat
 * `WsResponseExample` minus `uid` (carried on the envelope as `id`). Duplicate is
 * a fresh create with a new uid — no dedicated mutation; examples
 * never move.
 */

import { makeChildMutators } from '../shared/child-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import { WEBSOCKET_REQUEST_EXAMPLES_PATH } from '../websocket-request/types';
import { mintBatch } from './envelope';
import { WS_RESPONSE_EXAMPLE_ENTITY_TYPE, type WsResponseExampleParentRef, type WsResponseExampleSlot } from './types';

/** The generic child verbs bound to the request's `examples` set. */
export const wsResponseExampleChild = makeChildMutators<WsResponseExampleParentRef, WsResponseExampleSlot>({
  entityType: WS_RESPONSE_EXAMPLE_ENTITY_TYPE,
  childrenPath: WEBSOCKET_REQUEST_EXAMPLES_PATH,
  slot: (uid) => ({ uid, type: WS_RESPONSE_EXAMPLE_ENTITY_TYPE }),
  mintBatch,
});

export interface CreateWsResponseExampleArgs {
  wsResponseExampleUid: string;
  parent: WsResponseExampleParentRef;
  /** Full `WsResponseExample` minus `uid` (carried on the envelope as `id`). */
  payload: unknown;
  /** Pre-computed fractional-indexing key for the new slot's position. */
  orderKey?: string;
}

export function createWsResponseExample(ctx: MutatorContext, args: CreateWsResponseExampleArgs): MutatorIntent {
  return wsResponseExampleChild.create(ctx, {
    childUid: args.wsResponseExampleUid,
    parent: args.parent,
    payload: args.payload,
    orderKey: args.orderKey,
  });
}

export interface DeleteWsResponseExampleArgs {
  wsResponseExampleUid: string;
  parent: WsResponseExampleParentRef;
}

export function deleteWsResponseExample(ctx: MutatorContext, args: DeleteWsResponseExampleArgs): MutatorIntent {
  return wsResponseExampleChild.delete(ctx, { childUid: args.wsResponseExampleUid, parent: args.parent });
}
