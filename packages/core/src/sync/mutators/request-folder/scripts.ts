/**
 * `setRequestFolderScript` — set or clear one of the folder's ancestor
 * script slots (`preRequestScript` / `postResponseScript`).
 *
 * Same contract as `setRequestCollectionScript`: a string value emits
 * `setField`; `undefined` emits `unsetField` so the slot is removed
 * rather than blanked (field absent ↔ no script). No side effects —
 * script source doesn't feed variable resolution.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { REQUEST_FOLDER_ENTITY_TYPE } from './types';

export type RequestFolderScriptPath = 'preRequestScript' | 'postResponseScript';

export interface SetRequestFolderScriptArgs {
  folderUid: string;
  path: RequestFolderScriptPath;
  /** Script source; `undefined` removes the slot. */
  value: string | undefined;
}

export function setRequestFolderScript(ctx: MutatorContext, args: SetRequestFolderScriptArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      args.value === undefined
        ? {
            kind: 'unsetField',
            type: REQUEST_FOLDER_ENTITY_TYPE,
            id: args.folderUid,
            path: args.path,
          }
        : {
            kind: 'setField',
            type: REQUEST_FOLDER_ENTITY_TYPE,
            id: args.folderUid,
            path: args.path,
            value: args.value,
          },
    ]),
    sideEffects: [],
  };
}
