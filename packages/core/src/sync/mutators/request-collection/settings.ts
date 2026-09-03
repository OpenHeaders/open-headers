/**
 * `setRequestCollectionSettings` — set or clear the collection's
 * inheritable request settings knob by knob in ONE batch, so a save
 * that touches several knobs lands atomically.
 *
 * Every knob is its own leaf under `settings.<key>`: a defined value
 * emits `setField`, `undefined` emits `unsetField` so the knob goes
 * transparent rather than blank (field absent ↔ inherit / the runtime
 * default — the same rule the request's own settings fields follow).
 * The object is never written whole, so two devices editing two knobs
 * converge per leaf. No resolver side effects — settings don't feed
 * variable resolution.
 */

import type { InheritableSettingUpdate } from '../../../settings-inheritance';
import type { InheritableSettingKey } from '../../../types';
import type { MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { REQUEST_COLLECTION_ENTITY_TYPE, REQUEST_COLLECTION_SETTINGS_PATH } from './types';

/** A knob's sync leaf — `settings.timeoutMs`. */
export type RequestCollectionSettingPath = `${typeof REQUEST_COLLECTION_SETTINGS_PATH}.${InheritableSettingKey}`;

export function requestCollectionSettingPath(key: InheritableSettingKey): RequestCollectionSettingPath {
  return `${REQUEST_COLLECTION_SETTINGS_PATH}.${key}`;
}

export interface SetRequestCollectionSettingsArgs {
  collectionUid: string;
  /** Knob updates; `value: undefined` clears the knob. */
  updates: ReadonlyArray<InheritableSettingUpdate>;
}

export function setRequestCollectionSettings(
  ctx: MutatorContext,
  args: SetRequestCollectionSettingsArgs,
): MutatorIntent {
  const bodies: MutationBody[] = args.updates.map((update) =>
    update.value === undefined
      ? {
          kind: 'unsetField',
          type: REQUEST_COLLECTION_ENTITY_TYPE,
          id: args.collectionUid,
          path: requestCollectionSettingPath(update.key),
        }
      : {
          kind: 'setField',
          type: REQUEST_COLLECTION_ENTITY_TYPE,
          id: args.collectionUid,
          path: requestCollectionSettingPath(update.key),
          value: update.value,
        },
  );
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}
