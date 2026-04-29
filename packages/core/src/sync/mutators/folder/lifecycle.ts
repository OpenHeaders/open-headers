/**
 * `createFolder` + `deleteFolder` — folder entity lifecycle.
 *
 * Each is a cross-entity batch: the folder entity itself carries the
 * `name` (and `schemaVersion`) scalars; the parent (collection or
 * folder) carries the child-slot in its `folders` set. Per-batch
 * all-or-nothing at the local oracle (§11.2) keeps observers from
 * seeing the half-and-half intermediate state.
 *
 * Cascading rule deletes when a folder is removed are NOT modelled
 * here — the side-effect of a folder-delete is the SW-side rule-store
 * cascade, which runs as separate `delete(rule, ...)` envelopes minted
 * by the rule catalog. Keeping that cross-entity orchestration outside
 * the folder catalog matches what session 14 did for collection-delete.
 */

import type { MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { FOLDER_CHILDREN_PATH, FOLDER_ENTITY_TYPE, type FolderParentRef, type FolderSlot } from './types';

export interface CreateFolderArgs {
  folderUid: string;
  parent: FolderParentRef;
  name: string;
  /**
   * Pre-computed fractional-indexing key for the new slot's position
   * in the parent's `folders` set. Omit to let the seed key handle
   * ordering — fine for first child or when the caller doesn't care.
   */
  orderKey?: string;
}

export function createFolder(ctx: MutatorContext, args: CreateFolderArgs): MutatorIntent {
  const slot: FolderSlot = { uid: args.folderUid };
  const bodies: MutationBody[] = [
    {
      kind: 'create',
      type: FOLDER_ENTITY_TYPE,
      id: args.folderUid,
      payload: { schemaVersion: 5, name: args.name },
    },
    {
      kind: 'addToSet',
      type: args.parent.type,
      id: args.parent.uid,
      path: FOLDER_CHILDREN_PATH,
      itemId: args.folderUid,
      item: slot,
      orderKey: args.orderKey,
    },
  ];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

export interface DeleteFolderArgs {
  folderUid: string;
  parent: FolderParentRef;
}

export function deleteFolder(ctx: MutatorContext, args: DeleteFolderArgs): MutatorIntent {
  const bodies: MutationBody[] = [
    {
      kind: 'removeFromSet',
      type: args.parent.type,
      id: args.parent.uid,
      path: FOLDER_CHILDREN_PATH,
      itemId: args.folderUid,
    },
    { kind: 'delete', type: FOLDER_ENTITY_TYPE, id: args.folderUid },
  ];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}
