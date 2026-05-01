/**
 * Variable intent factories for collection-scoped variables.
 *
 * Thin per-catalog adapter over {@link makeVariableMutators}: binds the
 * shared factory to the collection routing constants + side-effect
 * intent, then re-exports the four primitives under the historical
 * `setCollectionVar` / `removeCollectionVar` / `renameCollectionVar` /
 * `setCollectionVarType` names with their named-arg shapes preserved
 * for callers + tests.
 *
 * Collection vars do NOT support `secret` semantically — only Vault
 * holds secrets (§12.3). The catalog still types `VariableType` as
 * `'default' | 'secret'` so the wire shape is uniform across scopes;
 * the UI layer + schema enforcement reject secret on collection scope.
 */

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
  name: string;
  value: string;
  type?: VariableType;
  /** Optional explicit orderKey — defaults to seed-key when omitted. */
  orderKey?: string;
}

export function setCollectionVar(ctx: MutatorContext, args: SetCollectionVarArgs): MutatorIntent {
  return factories.setVariable(ctx, { entityUid: args.collectionUid, name: args.name, value: args.value, type: args.type, orderKey: args.orderKey });
}

export interface RemoveCollectionVarArgs {
  collectionUid: string;
  name: string;
}

export function removeCollectionVar(ctx: MutatorContext, args: RemoveCollectionVarArgs): MutatorIntent {
  return factories.removeVariable(ctx, { entityUid: args.collectionUid, name: args.name });
}

export interface RenameCollectionVarArgs {
  collectionUid: string;
  oldName: string;
  newName: string;
  /** Carried through so the new entry has the same value. */
  value: string;
  type?: VariableType;
  orderKey?: string;
}

export function renameCollectionVar(ctx: MutatorContext, args: RenameCollectionVarArgs): MutatorIntent {
  return factories.renameVariable(ctx, {
    entityUid: args.collectionUid,
    oldName: args.oldName,
    newName: args.newName,
    value: args.value,
    type: args.type,
    orderKey: args.orderKey,
  });
}

export interface SetCollectionVarTypeArgs {
  collectionUid: string;
  name: string;
  /** Carried through so the LWW replacement preserves it. */
  value: string;
  type: VariableType;
}

export function setCollectionVarType(ctx: MutatorContext, args: SetCollectionVarTypeArgs): MutatorIntent {
  return factories.setVariableType(ctx, { entityUid: args.collectionUid, name: args.name, value: args.value, type: args.type });
}
