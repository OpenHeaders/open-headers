/**
 * File intent factories for a spec's source-file set.
 *
 * Set-member identity = `file.uid` (per `types.ts`). `setSpecFile`
 * upserts the whole row — add, content edit, and rename converge
 * uniformly under per-(setPath, uid) LWW; `removeSpecFile` keys by
 * uid. Mirrors the variable-scope primitives (`setEnvVar` /
 * `removeEnvVar`) with no side effects.
 */

import type { SpecFile } from '../../../types/spec';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { SPEC_ENTITY_TYPE, SPEC_FILES_PATH } from './types';

export interface SetSpecFileArgs {
  specUid: string;
  /** Whole file record. `file.uid` is the set-member itemId. */
  file: SpecFile;
  /** Optional explicit orderKey — defaults to seed-key when omitted. */
  orderKey?: string;
}

export function setSpecFile(ctx: MutatorContext, args: SetSpecFileArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'addToSet',
      type: SPEC_ENTITY_TYPE,
      id: args.specUid,
      path: SPEC_FILES_PATH,
      itemId: args.file.uid,
      item: args.file,
      orderKey: args.orderKey,
    },
  ]);
  return { batch, sideEffects: [] };
}

export interface RemoveSpecFileArgs {
  specUid: string;
  /** The row's persisted uid — NOT its fileName. */
  uid: string;
}

export function removeSpecFile(ctx: MutatorContext, args: RemoveSpecFileArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'removeFromSet',
      type: SPEC_ENTITY_TYPE,
      id: args.specUid,
      path: SPEC_FILES_PATH,
      itemId: args.uid,
    },
  ]);
  return { batch, sideEffects: [] };
}
