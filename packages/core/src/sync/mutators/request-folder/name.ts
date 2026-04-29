/**
 * `renameRequestFolder` — set the request folder's display name.
 *
 * Semantically `setField('name', _)`; named for awareness/UI clarity
 * the same way `renameFolder` is on rule folders.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { REQUEST_FOLDER_ENTITY_TYPE } from './types';

export interface RenameRequestFolderArgs {
  folderUid: string;
  name: string;
}

export function renameRequestFolder(
  ctx: MutatorContext,
  args: RenameRequestFolderArgs,
): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'setField',
        type: REQUEST_FOLDER_ENTITY_TYPE,
        id: args.folderUid,
        path: 'name',
        value: args.name,
      },
    ]),
    sideEffects: [],
  };
}
