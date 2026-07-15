/**
 * `setRequestCollectionScript` — set or clear one of the collection's
 * ancestor script slots (`preRequestScript` / `postResponseScript`).
 *
 * A string value emits `setField`; `undefined` emits `unsetField` so
 * the slot is removed rather than blanked (field absent ↔ no script,
 * the same rule the request's script fields follow). No resolver side
 * effects — script source doesn't feed variable resolution.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { REQUEST_COLLECTION_ENTITY_TYPE } from './types';

export type RequestCollectionScriptPath = 'preRequestScript' | 'postResponseScript';

export interface SetRequestCollectionScriptArgs {
  collectionUid: string;
  path: RequestCollectionScriptPath;
  /** Script source; `undefined` removes the slot. */
  value: string | undefined;
}

export function setRequestCollectionScript(ctx: MutatorContext, args: SetRequestCollectionScriptArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      args.value === undefined
        ? {
            kind: 'unsetField',
            type: REQUEST_COLLECTION_ENTITY_TYPE,
            id: args.collectionUid,
            path: args.path,
          }
        : {
            kind: 'setField',
            type: REQUEST_COLLECTION_ENTITY_TYPE,
            id: args.collectionUid,
            path: args.path,
            value: args.value,
          },
    ]),
    sideEffects: [],
  };
}
