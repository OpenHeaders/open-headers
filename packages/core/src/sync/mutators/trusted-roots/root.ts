/**
 * Trusted-roots mutators — the add / remove gestures on the singleton.
 *
 * `setTrustedRoot` upserts the whole row keyed by uid (add and rename
 * share one op); `removeTrustedRoot` keys by uid.
 */

import type { TrustedRoot } from '../../../types/trusted-roots';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { deriveTrustedRootsSideEffects } from './side-effects';
import { TRUSTED_ROOTS_ENTITY_TYPE, TRUSTED_ROOTS_ID, TRUSTED_ROOTS_PATH } from './types';

export interface SetTrustedRootArgs {
  /** Whole root record. `root.uid` is the set-member itemId. */
  root: TrustedRoot;
  orderKey?: string;
}

export function setTrustedRoot(ctx: MutatorContext, args: SetTrustedRootArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'addToSet',
      type: TRUSTED_ROOTS_ENTITY_TYPE,
      id: TRUSTED_ROOTS_ID,
      path: TRUSTED_ROOTS_PATH,
      itemId: args.root.uid,
      item: args.root,
      orderKey: args.orderKey,
    },
  ]);
  return { batch, sideEffects: batch.mutations.flatMap(deriveTrustedRootsSideEffects) };
}

export interface RemoveTrustedRootArgs {
  /** The row's persisted uid. */
  uid: string;
}

export function removeTrustedRoot(ctx: MutatorContext, args: RemoveTrustedRootArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'removeFromSet',
      type: TRUSTED_ROOTS_ENTITY_TYPE,
      id: TRUSTED_ROOTS_ID,
      path: TRUSTED_ROOTS_PATH,
      itemId: args.uid,
    },
  ]);
  return { batch, sideEffects: batch.mutations.flatMap(deriveTrustedRootsSideEffects) };
}
