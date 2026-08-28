/**
 * `createWebSocketRequest` + `deleteWebSocketRequest` +
 * `moveWebSocketRequest` — WebSocket request entity lifecycle as a tree
 * child. The parent (request collection or request folder) owns the
 * slot in its `items` set, tagged `type: 'websocketRequest'`. Row
 * seeding (`headers` / `params` / `events`) rides the seed builder
 * (`websocket-request-projection.ts`), which appends the parent slot
 * via {@link webSocketRequestChild.slotAdd} in the same batch.
 */

import {
  REQUEST_FOLDER_ITEMS_PATH,
  type RequestFolderItemSlot,
  type RequestFolderParentRef,
} from '../request-folder/types';
import { makeChildMutators } from '../shared/child-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { WEBSOCKET_REQUEST_ENTITY_TYPE } from './types';

/** The generic child verbs bound to the requests tree for this kind. */
export const webSocketRequestChild = makeChildMutators<RequestFolderParentRef, RequestFolderItemSlot>({
  entityType: WEBSOCKET_REQUEST_ENTITY_TYPE,
  childrenPath: REQUEST_FOLDER_ITEMS_PATH,
  slot: (uid) => ({ uid, type: WEBSOCKET_REQUEST_ENTITY_TYPE }),
  mintBatch,
});

export interface CreateWebSocketRequestArgs {
  webSocketRequestUid: string;
  parent: RequestFolderParentRef;
  /** Scalar shell as `WebSocketRequest` minus `uid` (carried on the envelope as `id`). */
  payload: unknown;
  orderKey?: string;
}

export function createWebSocketRequest(ctx: MutatorContext, args: CreateWebSocketRequestArgs): MutatorIntent {
  return webSocketRequestChild.create(ctx, {
    childUid: args.webSocketRequestUid,
    parent: args.parent,
    payload: args.payload,
    orderKey: args.orderKey,
  });
}

export interface DeleteWebSocketRequestArgs {
  webSocketRequestUid: string;
  parent: RequestFolderParentRef;
}

/** Delete a WebSocket request. Tombstone is permanent under §7.2 delete-wins. */
export function deleteWebSocketRequest(ctx: MutatorContext, args: DeleteWebSocketRequestArgs): MutatorIntent {
  return webSocketRequestChild.delete(ctx, { childUid: args.webSocketRequestUid, parent: args.parent });
}

export interface MoveWebSocketRequestArgs {
  webSocketRequestUid: string;
  newParent: RequestFolderParentRef;
  orderKey: string;
  /** Omit (or pass equal to `newParent`) for intra-parent reorder. */
  oldParent?: RequestFolderParentRef;
}

export function moveWebSocketRequest(ctx: MutatorContext, args: MoveWebSocketRequestArgs): MutatorIntent {
  return webSocketRequestChild.move(ctx, {
    childUid: args.webSocketRequestUid,
    newParent: args.newParent,
    orderKey: args.orderKey,
    oldParent: args.oldParent,
  });
}
