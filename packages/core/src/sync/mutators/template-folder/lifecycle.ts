/**
 * `createTemplateFolder` + `deleteTemplateFolder` — thin adapters over
 * the shared folder-mutator factory bound to the template-folder
 * routing constants. See `shared/folder-mutators.ts` for the cross-
 * entity lifecycle invariants.
 */

import { makeFolderMutators } from '../shared/folder-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import {
  TEMPLATE_FOLDER_CHILDREN_PATH,
  TEMPLATE_FOLDER_ENTITY_TYPE,
  type TemplateFolderParentRef,
} from './types';

const factories = makeFolderMutators<TemplateFolderParentRef>({
  entityType: TEMPLATE_FOLDER_ENTITY_TYPE,
  childrenPath: TEMPLATE_FOLDER_CHILDREN_PATH,
  mintBatch,
});

export interface CreateTemplateFolderArgs {
  folderUid: string;
  parent: TemplateFolderParentRef;
  name: string;
  /**
   * Stable last path segment for the folder's filesystem-style path.
   * Frozen at create time; defaults to `toFolderName(name, folderUid)`
   * when the caller omits it.
   */
  pathSegment?: string;
  /** Pre-computed fractional-indexing key for the new slot's position. */
  orderKey?: string;
}

export function createTemplateFolder(
  ctx: MutatorContext,
  args: CreateTemplateFolderArgs,
): MutatorIntent {
  return factories.createFolder(ctx, args);
}

export interface DeleteTemplateFolderArgs {
  folderUid: string;
  parent: TemplateFolderParentRef;
}

export function deleteTemplateFolder(
  ctx: MutatorContext,
  args: DeleteTemplateFolderArgs,
): MutatorIntent {
  return factories.deleteFolder(ctx, args);
}
