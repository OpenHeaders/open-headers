/**
 * Variable intent factories for collection-scoped variables.
 *
 * Thin per-catalog adapter over {@link makeVariableMutators}: binds the
 * shared factory to the collection routing constants + side-effect
 * intent, then re-exports the two primitives under the historical
 * `setCollectionVar` / `removeCollectionVar` names with their named-arg
 * shapes preserved for callers + tests.
 *
 * Set-member identity = `variable.uid`. Per-(setPath, uid) LWW handles
 * concurrent same-row edits; concurrent same-row renames converge on
 * the later-HLC name.
 *
 * Collection vars do NOT support `secret` semantically — only Vault
 * holds secrets (§12.3). The catalog still types `VariableType` as
 * `'default' | 'secret'` so the wire shape is uniform across scopes;
 * the UI layer + schema enforcement reject secret on collection scope.
 */

import type { Variable } from '../../../types/v5/variable';
import type { MutatorContext, MutatorIntent } from '../types';
import { makeVariableMutators, type VariableType } from '../shared/variable-mutators';
import { mintBatch } from './envelope';
import { invalidateResolverIntent } from './side-effects';
import { COLLECTION_ENTITY_TYPE, COLLECTION_VARS_PATH } from './types';

export type { VariableType };

const factories = makeVariableMutators({
  entityType: COLLECTION_ENTITY_TYPE,
  varsPath: COLLECTION_VARS_PATH,
  mintBatch,
  makeSideEffects: (uid, hlc) => [invalidateResolverIntent(uid, hlc)],
});

export interface SetCollectionVarArgs {
  collectionUid: string;
  /** Whole variable record. `variable.uid` is the set-member itemId. */
  variable: Variable;
  /** Optional explicit orderKey — defaults to seed-key when omitted. */
  orderKey?: string;
}

export function setCollectionVar(ctx: MutatorContext, args: SetCollectionVarArgs): MutatorIntent {
  return factories.setVariable(ctx, {
    entityUid: args.collectionUid,
    variable: args.variable,
    orderKey: args.orderKey,
  });
}

export interface RemoveCollectionVarArgs {
  collectionUid: string;
  /** The row's persisted uid — NOT its name. */
  uid: string;
}

export function removeCollectionVar(ctx: MutatorContext, args: RemoveCollectionVarArgs): MutatorIntent {
  return factories.removeVariable(ctx, { entityUid: args.collectionUid, uid: args.uid });
}
