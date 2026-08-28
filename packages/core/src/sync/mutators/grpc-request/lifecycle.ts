/**
 * `createGrpcRequest` + `deleteGrpcRequest` + `moveGrpcRequest` — gRPC
 * request entity lifecycle as a tree child. The parent (request
 * collection or request folder) owns the slot in its `items` set,
 * tagged `type: 'grpcRequest'`. Row seeding (`metadata`) rides the seed
 * builder (`grpc-request-projection.ts`), which appends the parent slot
 * via {@link grpcRequestChild.slotAdd} in the same batch.
 */

import {
  REQUEST_FOLDER_ITEMS_PATH,
  type RequestFolderItemSlot,
  type RequestFolderParentRef,
} from '../request-folder/types';
import { makeChildMutators } from '../shared/child-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { GRPC_REQUEST_ENTITY_TYPE } from './types';

/** The generic child verbs bound to the requests tree for this kind. */
export const grpcRequestChild = makeChildMutators<RequestFolderParentRef, RequestFolderItemSlot>({
  entityType: GRPC_REQUEST_ENTITY_TYPE,
  childrenPath: REQUEST_FOLDER_ITEMS_PATH,
  slot: (uid) => ({ uid, type: GRPC_REQUEST_ENTITY_TYPE }),
  mintBatch,
});

export interface CreateGrpcRequestArgs {
  grpcRequestUid: string;
  parent: RequestFolderParentRef;
  /** Scalar shell as `GrpcRequest` minus `uid` (carried on the envelope as `id`). */
  payload: unknown;
  orderKey?: string;
}

export function createGrpcRequest(ctx: MutatorContext, args: CreateGrpcRequestArgs): MutatorIntent {
  return grpcRequestChild.create(ctx, {
    childUid: args.grpcRequestUid,
    parent: args.parent,
    payload: args.payload,
    orderKey: args.orderKey,
  });
}

export interface DeleteGrpcRequestArgs {
  grpcRequestUid: string;
  parent: RequestFolderParentRef;
}

/** Delete a gRPC request. Tombstone is permanent under §7.2 delete-wins. */
export function deleteGrpcRequest(ctx: MutatorContext, args: DeleteGrpcRequestArgs): MutatorIntent {
  return grpcRequestChild.delete(ctx, { childUid: args.grpcRequestUid, parent: args.parent });
}

export interface MoveGrpcRequestArgs {
  grpcRequestUid: string;
  newParent: RequestFolderParentRef;
  orderKey: string;
  /** Omit (or pass equal to `newParent`) for intra-parent reorder. */
  oldParent?: RequestFolderParentRef;
}

export function moveGrpcRequest(ctx: MutatorContext, args: MoveGrpcRequestArgs): MutatorIntent {
  return grpcRequestChild.move(ctx, {
    childUid: args.grpcRequestUid,
    newParent: args.newParent,
    orderKey: args.orderKey,
    oldParent: args.oldParent,
  });
}
