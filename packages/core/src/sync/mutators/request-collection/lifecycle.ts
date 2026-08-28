/**
 * `createRequestCollection` + `deleteRequestCollection` +
 * `moveRequestCollection` — request collection lifecycle as a tree
 * child of the workspace roots (`requestCollections` set). Mirrors
 * `collection/lifecycle.ts`; the seed builder
 * (`request-collection-projection.ts`) appends the roots slot via
 * {@link requestCollectionChild.slotAdd} in the same batch.
 */

import { makeChildMutators } from '../shared/child-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import {
  type CollectionSlot,
  WORKSPACE_ROOTS_REF,
  WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
  type WorkspaceRootsRef,
} from '../workspace-roots/types';
import { mintBatch } from './envelope';
import { REQUEST_COLLECTION_ENTITY_TYPE } from './types';

/** The generic child verbs bound to the roots' request-collection set. */
export const requestCollectionChild = makeChildMutators<WorkspaceRootsRef, CollectionSlot>({
  entityType: REQUEST_COLLECTION_ENTITY_TYPE,
  childrenPath: WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
  slot: (uid) => ({ uid }),
  mintBatch,
});

export interface CreateRequestCollectionArgs {
  collectionUid: string;
  /** Scalar shell as `Collection` minus `uid` (carried on the envelope as `id`). */
  payload: unknown;
  orderKey?: string;
}

export function createRequestCollection(ctx: MutatorContext, args: CreateRequestCollectionArgs): MutatorIntent {
  return requestCollectionChild.create(ctx, {
    childUid: args.collectionUid,
    parent: WORKSPACE_ROOTS_REF,
    payload: args.payload,
    orderKey: args.orderKey,
  });
}

export interface DeleteRequestCollectionArgs {
  collectionUid: string;
}

export function deleteRequestCollection(ctx: MutatorContext, args: DeleteRequestCollectionArgs): MutatorIntent {
  return requestCollectionChild.delete(ctx, { childUid: args.collectionUid, parent: WORKSPACE_ROOTS_REF });
}

export interface MoveRequestCollectionArgs {
  collectionUid: string;
  orderKey: string;
}

export function moveRequestCollection(ctx: MutatorContext, args: MoveRequestCollectionArgs): MutatorIntent {
  return requestCollectionChild.move(ctx, {
    childUid: args.collectionUid,
    newParent: WORKSPACE_ROOTS_REF,
    orderKey: args.orderKey,
  });
}
