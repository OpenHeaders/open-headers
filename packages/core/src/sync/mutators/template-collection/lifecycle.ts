/**
 * `createTemplateCollection` + `deleteTemplateCollection` +
 * `moveTemplateCollection` — template collection lifecycle as a tree
 * child of the workspace roots (`templateCollections` set). Mirrors
 * `collection/lifecycle.ts`; the seed builder
 * (`template-collection-projection.ts`) appends the roots slot via
 * {@link templateCollectionChild.slotAdd} in the same batch.
 */

import { makeChildMutators } from '../shared/child-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import {
  type CollectionSlot,
  WORKSPACE_ROOTS_REF,
  WORKSPACE_ROOTS_TEMPLATE_COLLECTIONS_PATH,
  type WorkspaceRootsRef,
} from '../workspace-roots/types';
import { mintBatch } from './envelope';
import { TEMPLATE_COLLECTION_ENTITY_TYPE } from './types';

/** The generic child verbs bound to the roots' template-collection set. */
export const templateCollectionChild = makeChildMutators<WorkspaceRootsRef, CollectionSlot>({
  entityType: TEMPLATE_COLLECTION_ENTITY_TYPE,
  childrenPath: WORKSPACE_ROOTS_TEMPLATE_COLLECTIONS_PATH,
  slot: (uid) => ({ uid }),
  mintBatch,
});

export interface CreateTemplateCollectionArgs {
  collectionUid: string;
  /** Scalar shell as `Collection` minus `uid` (carried on the envelope as `id`). */
  payload: unknown;
  orderKey?: string;
}

export function createTemplateCollection(ctx: MutatorContext, args: CreateTemplateCollectionArgs): MutatorIntent {
  return templateCollectionChild.create(ctx, {
    childUid: args.collectionUid,
    parent: WORKSPACE_ROOTS_REF,
    payload: args.payload,
    orderKey: args.orderKey,
  });
}

export interface DeleteTemplateCollectionArgs {
  collectionUid: string;
}

export function deleteTemplateCollection(ctx: MutatorContext, args: DeleteTemplateCollectionArgs): MutatorIntent {
  return templateCollectionChild.delete(ctx, { childUid: args.collectionUid, parent: WORKSPACE_ROOTS_REF });
}

export interface MoveTemplateCollectionArgs {
  collectionUid: string;
  orderKey: string;
}

export function moveTemplateCollection(ctx: MutatorContext, args: MoveTemplateCollectionArgs): MutatorIntent {
  return templateCollectionChild.move(ctx, {
    childUid: args.collectionUid,
    newParent: WORKSPACE_ROOTS_REF,
    orderKey: args.orderKey,
  });
}
