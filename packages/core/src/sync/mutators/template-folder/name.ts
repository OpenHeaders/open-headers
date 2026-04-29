/**
 * `renameTemplateFolder` — set the template folder's display name.
 *
 * Semantically `setField('name', _)`; named for awareness/UI clarity
 * the same way `renameFolder` is on rule folders.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { TEMPLATE_FOLDER_ENTITY_TYPE } from './types';

export interface RenameTemplateFolderArgs {
  folderUid: string;
  name: string;
}

export function renameTemplateFolder(
  ctx: MutatorContext,
  args: RenameTemplateFolderArgs,
): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'setField',
        type: TEMPLATE_FOLDER_ENTITY_TYPE,
        id: args.folderUid,
        path: 'name',
        value: args.name,
      },
    ]),
    sideEffects: [],
  };
}
