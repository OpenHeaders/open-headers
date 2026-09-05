/**
 * `createGraphqlRequest` + `deleteGraphqlRequest` + `moveGraphqlRequest`
 * — GraphQL request entity lifecycle as a tree child. The parent
 * (request collection or request folder) owns the slot in its `items`
 * set, tagged `type: 'graphqlRequest'`. Row seeding (`headers`) rides
 * the seed builder (`graphql-request-projection.ts`), which appends
 * the parent slot via {@link graphqlRequestChild.slotAdd} in the same
 * batch.
 */

import {
  REQUEST_FOLDER_ITEMS_PATH,
  type RequestFolderItemSlot,
  type RequestFolderParentRef,
} from '../request-folder/types';
import { makeChildMutators } from '../shared/child-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { GRAPHQL_REQUEST_ENTITY_TYPE } from './types';

/** The generic child verbs bound to the requests tree for this kind. */
export const graphqlRequestChild = makeChildMutators<RequestFolderParentRef, RequestFolderItemSlot>({
  entityType: GRAPHQL_REQUEST_ENTITY_TYPE,
  childrenPath: REQUEST_FOLDER_ITEMS_PATH,
  slot: (uid) => ({ uid, type: GRAPHQL_REQUEST_ENTITY_TYPE }),
  mintBatch,
});

export interface CreateGraphqlRequestArgs {
  graphqlRequestUid: string;
  parent: RequestFolderParentRef;
  /** Scalar shell as `GraphqlRequest` minus `uid` (carried on the envelope as `id`). */
  payload: unknown;
  orderKey?: string;
}

export function createGraphqlRequest(ctx: MutatorContext, args: CreateGraphqlRequestArgs): MutatorIntent {
  return graphqlRequestChild.create(ctx, {
    childUid: args.graphqlRequestUid,
    parent: args.parent,
    payload: args.payload,
    orderKey: args.orderKey,
  });
}

export interface DeleteGraphqlRequestArgs {
  graphqlRequestUid: string;
  parent: RequestFolderParentRef;
}

/** Delete a GraphQL request. Tombstone is permanent under §7.2 delete-wins. */
export function deleteGraphqlRequest(ctx: MutatorContext, args: DeleteGraphqlRequestArgs): MutatorIntent {
  return graphqlRequestChild.delete(ctx, { childUid: args.graphqlRequestUid, parent: args.parent });
}

export interface MoveGraphqlRequestArgs {
  graphqlRequestUid: string;
  newParent: RequestFolderParentRef;
  orderKey: string;
  /** Omit (or pass equal to `newParent`) for intra-parent reorder. */
  oldParent?: RequestFolderParentRef;
}

export function moveGraphqlRequest(ctx: MutatorContext, args: MoveGraphqlRequestArgs): MutatorIntent {
  return graphqlRequestChild.move(ctx, {
    childUid: args.graphqlRequestUid,
    newParent: args.newParent,
    orderKey: args.orderKey,
    oldParent: args.oldParent,
  });
}
