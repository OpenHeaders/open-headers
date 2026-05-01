/**
 * `createRequestFolder` + `deleteRequestFolder` — thin adapters over the
 * shared folder-mutator factory bound to the request-folder routing
 * constants. See `shared/folder-mutators.ts` for the cross-entity
 * lifecycle invariants.
 */

import { makeFolderMutators } from '../shared/folder-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import {
  REQUEST_FOLDER_CHILDREN_PATH,
  REQUEST_FOLDER_ENTITY_TYPE,
  type RequestFolderParentRef,
} from './types';

const factories = makeFolderMutators<RequestFolderParentRef>({
  entityType: REQUEST_FOLDER_ENTITY_TYPE,
  childrenPath: REQUEST_FOLDER_CHILDREN_PATH,
  mintBatch,
});

export interface CreateRequestFolderArgs {
  folderUid: string;
  parent: RequestFolderParentRef;
  name: string;
  /**
   * Stable last path segment for the folder's filesystem-style path
   * (e.g. `auth-x7k2abcd`). Frozen at create time; defaults to
   * `toFolderName(name, folderUid)` when the caller omits it.
   */
  pathSegment?: string;
  /** Pre-computed fractional-indexing key for the new slot's position. */
  orderKey?: string;
}

export function createRequestFolder(
  ctx: MutatorContext,
  args: CreateRequestFolderArgs,
): MutatorIntent {
  return factories.createFolder(ctx, args);
}

export interface DeleteRequestFolderArgs {
  folderUid: string;
  parent: RequestFolderParentRef;
}

export function deleteRequestFolder(
  ctx: MutatorContext,
  args: DeleteRequestFolderArgs,
): MutatorIntent {
  return factories.deleteFolder(ctx, args);
}
