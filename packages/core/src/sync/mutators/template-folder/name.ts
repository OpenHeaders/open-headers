/**
 * `renameTemplateFolder` — thin adapter over the shared folder-mutator
 * factory. Semantically `setField('name', _)`.
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

export interface RenameTemplateFolderArgs {
  folderUid: string;
  name: string;
}

export function renameTemplateFolder(
  ctx: MutatorContext,
  args: RenameTemplateFolderArgs,
): MutatorIntent {
  return factories.renameFolder(ctx, args);
}
