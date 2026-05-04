/**
 * Variable intent factories for request-collection-scoped variables.
 *
 * Thin per-catalog adapter over {@link makeVariableMutators}: binds the
 * shared factory to the request-collection routing constants +
 * side-effect intent. Re-exports the two primitives under the
 * `setRequestCollectionVar` / `removeRequestCollectionVar` names with
 * `requestCollectionUid`-named args for call-site clarity.
 *
 * Set-member identity = `variable.uid`. Per-(setPath, uid) LWW handles
 * concurrent same-row edits; concurrent same-row renames converge on
 * the later-HLC name.
 *
 * Like rule-collection vars (§12.3), request-collection vars do NOT
 * support `secret` semantically — only Vault holds secrets. The catalog
 * still types `VariableType` as `'default' | 'secret'` so the wire shape
 * is uniform across scopes; the UI layer rejects secret on this scope.
 */

import type { Variable } from '../../../types/v5/variable';
import { makeVariableMutators, type VariableType } from '../shared/variable-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { invalidateResolverIntent } from './side-effects';
import { REQUEST_COLLECTION_ENTITY_TYPE, REQUEST_COLLECTION_VARS_PATH } from './types';

export type { VariableType };

const factories = makeVariableMutators({
  entityType: REQUEST_COLLECTION_ENTITY_TYPE,
  varsPath: REQUEST_COLLECTION_VARS_PATH,
  mintBatch,
  makeSideEffects: (uid, hlc) => [invalidateResolverIntent(uid, hlc)],
});

export interface SetRequestCollectionVarArgs {
  requestCollectionUid: string;
  /** Whole variable record. `variable.uid` is the set-member itemId. */
  variable: Variable;
  /** Optional explicit orderKey — defaults to seed-key when omitted. */
  orderKey?: string;
}

export function setRequestCollectionVar(ctx: MutatorContext, args: SetRequestCollectionVarArgs): MutatorIntent {
  return factories.setVariable(ctx, {
    entityUid: args.requestCollectionUid,
    variable: args.variable,
    orderKey: args.orderKey,
  });
}

export interface RemoveRequestCollectionVarArgs {
  requestCollectionUid: string;
  /** The row's persisted uid — NOT its name. */
  uid: string;
}

export function removeRequestCollectionVar(ctx: MutatorContext, args: RemoveRequestCollectionVarArgs): MutatorIntent {
  return factories.removeVariable(ctx, { entityUid: args.requestCollectionUid, uid: args.uid });
}
