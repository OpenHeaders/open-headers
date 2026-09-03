/**
 * `setRequestFolderSettings` — set or clear the folder's inheritable
 * request settings knob by knob in ONE batch. Same contract as
 * `setRequestCollectionSettings`: one leaf per knob under
 * `settings.<key>`, a defined value emits `setField`, `undefined`
 * emits `unsetField` (field absent ↔ inherit / the runtime default).
 * No side effects — settings don't feed variable resolution.
 */

import type { InheritableSettingUpdate } from '../../../settings-inheritance';
import type { InheritableSettingKey } from '../../../types';
import type { MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { REQUEST_FOLDER_ENTITY_TYPE, REQUEST_FOLDER_SETTINGS_PATH } from './types';

/** See `RequestCollectionSettingPath` — the same leaves on a folder. */
export type RequestFolderSettingPath = `${typeof REQUEST_FOLDER_SETTINGS_PATH}.${InheritableSettingKey}`;

export function requestFolderSettingPath(key: InheritableSettingKey): RequestFolderSettingPath {
  return `${REQUEST_FOLDER_SETTINGS_PATH}.${key}`;
}

export interface SetRequestFolderSettingsArgs {
  folderUid: string;
  /** Knob updates; `value: undefined` clears the knob. */
  updates: ReadonlyArray<InheritableSettingUpdate>;
}

export function setRequestFolderSettings(ctx: MutatorContext, args: SetRequestFolderSettingsArgs): MutatorIntent {
  const bodies: MutationBody[] = args.updates.map((update) =>
    update.value === undefined
      ? {
          kind: 'unsetField',
          type: REQUEST_FOLDER_ENTITY_TYPE,
          id: args.folderUid,
          path: requestFolderSettingPath(update.key),
        }
      : {
          kind: 'setField',
          type: REQUEST_FOLDER_ENTITY_TYPE,
          id: args.folderUid,
          path: requestFolderSettingPath(update.key),
          value: update.value,
        },
  );
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}
