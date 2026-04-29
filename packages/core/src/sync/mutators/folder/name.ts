/**
 * `renameFolder` — set the folder's display name.
 *
 * Semantically `setField('name', _)`; named for awareness/UI clarity
 * the same way `toggleEnabled` is on rules and `renameCollection` is on
 * collections.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { FOLDER_ENTITY_TYPE } from './types';

export interface RenameFolderArgs {
  folderUid: string;
  name: string;
}

export function renameFolder(ctx: MutatorContext, args: RenameFolderArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      { kind: 'setField', type: FOLDER_ENTITY_TYPE, id: args.folderUid, path: 'name', value: args.name },
    ]),
    sideEffects: [],
  };
}
