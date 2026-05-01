/**
 * `renameFolder` — thin adapter over the shared folder-mutator factory.
 * Semantically `setField('name', _)`; named for awareness/UI clarity.
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

export interface RenameFolderArgs {
  folderUid: string;
  name: string;
}

export function renameFolder(ctx: MutatorContext, args: RenameFolderArgs): MutatorIntent {
  return factories.renameFolder(ctx, args);
}
