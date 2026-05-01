/**
 * Variable intent factories for request-collection-scoped variables.
 *
 * Thin per-catalog adapter over {@link makeVariableMutators}: binds the
 * shared factory to the request-collection routing constants +
 * side-effect intent. Re-exports the four primitives under the
 * `setRequestCollectionVar` / `removeRequestCollectionVar` /
 * `renameRequestCollectionVar` / `setRequestCollectionVarType` names
 * with `requestCollectionUid`-named args for call-site clarity.
 *
 * Like rule-collection vars (§12.3), request-collection vars do NOT
 * support `secret` semantically — only Vault holds secrets. The catalog
 * still types `VariableType` as `'default' | 'secret'` so the wire shape
 * is uniform across scopes; the UI layer rejects secret on this scope.
 */

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
  name: string;
  value: string;
  type?: VariableType;
  /** Optional explicit orderKey — defaults to seed-key when omitted. */
  orderKey?: string;
}

export function setRequestCollectionVar(ctx: MutatorContext, args: SetRequestCollectionVarArgs): MutatorIntent {
  return factories.setVariable(ctx, {
    entityUid: args.requestCollectionUid,
    name: args.name,
    value: args.value,
    type: args.type,
    orderKey: args.orderKey,
  });
}

export interface RemoveRequestCollectionVarArgs {
  requestCollectionUid: string;
  name: string;
}

export function removeRequestCollectionVar(ctx: MutatorContext, args: RemoveRequestCollectionVarArgs): MutatorIntent {
  return factories.removeVariable(ctx, { entityUid: args.requestCollectionUid, name: args.name });
}

export interface RenameRequestCollectionVarArgs {
  requestCollectionUid: string;
  oldName: string;
  newName: string;
  /** Carried through so the new entry has the same value. */
  value: string;
  type?: VariableType;
  orderKey?: string;
}

export function renameRequestCollectionVar(
  ctx: MutatorContext,
  args: RenameRequestCollectionVarArgs,
): MutatorIntent {
  return factories.renameVariable(ctx, {
    entityUid: args.requestCollectionUid,
    oldName: args.oldName,
    newName: args.newName,
    value: args.value,
    type: args.type,
    orderKey: args.orderKey,
  });
}

export interface SetRequestCollectionVarTypeArgs {
  requestCollectionUid: string;
  name: string;
  /** Carried through so the LWW replacement preserves it. */
  value: string;
  type: VariableType;
}

export function setRequestCollectionVarType(
  ctx: MutatorContext,
  args: SetRequestCollectionVarTypeArgs,
): MutatorIntent {
  return factories.setVariableType(ctx, {
    entityUid: args.requestCollectionUid,
    name: args.name,
    value: args.value,
    type: args.type,
  });
}
