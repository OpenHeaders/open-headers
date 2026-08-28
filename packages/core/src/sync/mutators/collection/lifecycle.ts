/**
 * `createCollection` + `deleteCollection` + `moveCollection` — rule
 * collection lifecycle as a tree child of the workspace roots. The
 * roots singleton owns the collection's slot in its `ruleCollections`
 * set; collections reorder only, never nest, so `move` is always the
 * same-parent `moveBefore`.
 *
 * The `variables` set is NOT pre-seeded by `createCollection` — the
 * seed builder (`collection-projection.ts`) splits it into per-row
 * `addToSet` envelopes and appends the roots slot via
 * {@link collectionChild.slotAdd} in the same batch.
 */

import { makeChildMutators } from '../shared/child-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import {
  type CollectionSlot,
  WORKSPACE_ROOTS_REF,
  WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
  type WorkspaceRootsRef,
} from '../workspace-roots/types';
import { mintBatch } from './envelope';
import { COLLECTION_ENTITY_TYPE } from './types';

/** The generic child verbs bound to the roots' rule-collection set. */
export const collectionChild = makeChildMutators<WorkspaceRootsRef, CollectionSlot>({
  entityType: COLLECTION_ENTITY_TYPE,
  childrenPath: WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
  slot: (uid) => ({ uid }),
  mintBatch,
});

export interface CreateCollectionArgs {
  collectionUid: string;
  /** Scalar shell as `Collection` minus `uid` (carried on the envelope as `id`). */
  payload: unknown;
  orderKey?: string;
}

export function createCollection(ctx: MutatorContext, args: CreateCollectionArgs): MutatorIntent {
  return collectionChild.create(ctx, {
    childUid: args.collectionUid,
    parent: WORKSPACE_ROOTS_REF,
    payload: args.payload,
    orderKey: args.orderKey,
  });
}

export interface DeleteCollectionArgs {
  collectionUid: string;
}

export function deleteCollection(ctx: MutatorContext, args: DeleteCollectionArgs): MutatorIntent {
  return collectionChild.delete(ctx, { childUid: args.collectionUid, parent: WORKSPACE_ROOTS_REF });
}

export interface MoveCollectionArgs {
  collectionUid: string;
  orderKey: string;
}

export function moveCollection(ctx: MutatorContext, args: MoveCollectionArgs): MutatorIntent {
  return collectionChild.move(ctx, {
    childUid: args.collectionUid,
    newParent: WORKSPACE_ROOTS_REF,
    orderKey: args.orderKey,
  });
}
