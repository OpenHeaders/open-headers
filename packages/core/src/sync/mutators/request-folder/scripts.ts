/**
 * `setRequestFolderScripts` — set or clear the folder's ancestor
 * script slots (`preRequestScript` / `postResponseScript`) in ONE
 * batch. Same contract as `setRequestCollectionScripts`: a string
 * value emits `setField`; `undefined` emits `unsetField` so the slot
 * is removed rather than blanked (field absent ↔ no script). No side
 * effects — script source doesn't feed variable resolution.
 */

import type { MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { REQUEST_FOLDER_ENTITY_TYPE } from './types';

export type RequestFolderScriptPath = 'preRequestScript' | 'postResponseScript';

export interface SetRequestFolderScriptsArgs {
  folderUid: string;
  /** Slot updates; `value: undefined` removes the slot. */
  updates: ReadonlyArray<{ path: RequestFolderScriptPath; value: string | undefined }>;
}

export function setRequestFolderScripts(ctx: MutatorContext, args: SetRequestFolderScriptsArgs): MutatorIntent {
  const bodies: MutationBody[] = args.updates.map((update) =>
    update.value === undefined
      ? {
          kind: 'unsetField',
          type: REQUEST_FOLDER_ENTITY_TYPE,
          id: args.folderUid,
          path: update.path,
        }
      : {
          kind: 'setField',
          type: REQUEST_FOLDER_ENTITY_TYPE,
          id: args.folderUid,
          path: update.path,
          value: update.value,
        },
  );
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}
