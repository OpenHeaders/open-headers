/**
 * `createFolder` + `deleteFolder` — thin adapters over the shared
 * folder-mutator factory bound to the rule-side folder routing
 * constants. See `shared/folder-mutators.ts` for the cross-entity
 * lifecycle invariants.
 */

import { makeFolderMutators } from '../shared/folder-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { FOLDER_CHILDREN_PATH, FOLDER_ENTITY_TYPE, type FolderParentRef } from './types';

const factories = makeFolderMutators<FolderParentRef>({
  entityType: FOLDER_ENTITY_TYPE,
  childrenPath: FOLDER_CHILDREN_PATH,
  mintBatch,
});

export interface CreateFolderArgs {
  folderUid: string;
  parent: FolderParentRef;
  name: string;
  /**
   * Stable last path segment for the folder's filesystem-style path
   * (e.g. `login-x7k2abcd`). Frozen at create time; defaults to
   * `toFolderName(name, folderUid)` when the caller omits it.
   */
  pathSegment?: string;
  /** Pre-computed fractional-indexing key for the new slot's position. */
  orderKey?: string;
}

export function createFolder(ctx: MutatorContext, args: CreateFolderArgs): MutatorIntent {
  return factories.createFolder(ctx, args);
}

export interface DeleteFolderArgs {
  folderUid: string;
  parent: FolderParentRef;
}

export function deleteFolder(ctx: MutatorContext, args: DeleteFolderArgs): MutatorIntent {
  return factories.deleteFolder(ctx, args);
}
