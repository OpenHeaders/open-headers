/**
 * `setRequestCollectionScripts` — set or clear the collection's
 * ancestor script slots (the HTTP pair's fields, the session kinds'
 * `scripts.<kind>` leaves) in ONE batch, so a save that touches
 * several slots lands atomically.
 *
 * A string value emits `setField`; `undefined` emits `unsetField` so
 * the slot is removed rather than blanked (field absent ↔ no script,
 * the same rule the request's script fields follow). No resolver side
 * effects — script source doesn't feed variable resolution.
 */

import type { ScriptSlotPath } from '../../../scripts/slots';
import type { MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { REQUEST_COLLECTION_ENTITY_TYPE } from './types';

/** A slot's sync leaf — the HTTP pair's top-level fields, or a leaf of
 *  the session `scripts` record (`scripts.ws-before-connect`). */
export type RequestCollectionScriptPath = ScriptSlotPath;

export interface SetRequestCollectionScriptsArgs {
  collectionUid: string;
  /** Slot updates; `value: undefined` removes the slot. */
  updates: ReadonlyArray<{ path: RequestCollectionScriptPath; value: string | undefined }>;
}

export function setRequestCollectionScripts(ctx: MutatorContext, args: SetRequestCollectionScriptsArgs): MutatorIntent {
  const bodies: MutationBody[] = args.updates.map((update) =>
    update.value === undefined
      ? {
          kind: 'unsetField',
          type: REQUEST_COLLECTION_ENTITY_TYPE,
          id: args.collectionUid,
          path: update.path,
        }
      : {
          kind: 'setField',
          type: REQUEST_COLLECTION_ENTITY_TYPE,
          id: args.collectionUid,
          path: update.path,
          value: update.value,
        },
  );
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}
