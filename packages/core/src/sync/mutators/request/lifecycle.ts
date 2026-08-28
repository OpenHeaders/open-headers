/**
 * `createRequest` + `deleteRequest` + `moveRequest` — request entity
 * lifecycle as a tree child. Thin adapters over the shared
 * child-mutator factory bound to the requests tree: the parent
 * (request collection or request folder) owns the request's slot in
 * its `items` set, tagged `type: 'request'` because the same set holds
 * the gRPC / WebSocket / MQTT kinds; the request's `path` is a
 * projection of that slot.
 *
 * Set-modeled paths (`headers`, `params`) and body-internal arrays are
 * NOT pre-seeded by `createRequest`. The seed builder
 * (`request-projection.ts`) flattens the create payload into per-leaf
 * scalars + per-row `addToSet` envelopes and appends the parent slot
 * via {@link requestChild.slotAdd} in the same batch — the catalog's
 * create stays opaque about the row shapes.
 */

import {
  REQUEST_FOLDER_ITEMS_PATH,
  type RequestFolderItemSlot,
  type RequestFolderParentRef,
} from '../request-folder/types';
import { makeChildMutators } from '../shared/child-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { REQUEST_ENTITY_TYPE } from './types';

/** The generic child verbs bound to the requests tree for this kind. */
export const requestChild = makeChildMutators<RequestFolderParentRef, RequestFolderItemSlot>({
  entityType: REQUEST_ENTITY_TYPE,
  childrenPath: REQUEST_FOLDER_ITEMS_PATH,
  slot: (uid) => ({ uid, type: REQUEST_ENTITY_TYPE }),
  mintBatch,
});

export interface CreateRequestArgs {
  requestUid: string;
  parent: RequestFolderParentRef;
  /**
   * Scalar shell as `Request` minus `uid` (carried on the envelope as
   * `id`). Validated at the oracle boundary by the request schema.
   */
  payload: unknown;
  /** Pre-computed fractional-indexing key for the new slot's position. */
  orderKey?: string;
}

export function createRequest(ctx: MutatorContext, args: CreateRequestArgs): MutatorIntent {
  return requestChild.create(ctx, {
    childUid: args.requestUid,
    parent: args.parent,
    payload: args.payload,
    orderKey: args.orderKey,
  });
}

export interface DeleteRequestArgs {
  requestUid: string;
  parent: RequestFolderParentRef;
}

export function deleteRequest(ctx: MutatorContext, args: DeleteRequestArgs): MutatorIntent {
  return requestChild.delete(ctx, { childUid: args.requestUid, parent: args.parent });
}

export interface MoveRequestArgs {
  requestUid: string;
  newParent: RequestFolderParentRef;
  orderKey: string;
  /** Omit (or pass equal to `newParent`) for intra-parent reorder. */
  oldParent?: RequestFolderParentRef;
}

export function moveRequest(ctx: MutatorContext, args: MoveRequestArgs): MutatorIntent {
  return requestChild.move(ctx, {
    childUid: args.requestUid,
    newParent: args.newParent,
    orderKey: args.orderKey,
    oldParent: args.oldParent,
  });
}
