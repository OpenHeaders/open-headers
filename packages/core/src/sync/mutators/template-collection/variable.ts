/**
 * Variable intent factories for template-collection-scoped variables.
 *
 * Thin per-catalog adapter over {@link makeVariableMutators}: binds the
 * shared factory to the template-collection routing constants +
 * side-effect intent. Re-exports the four primitives under the
 * `setTemplateCollectionVar` / `removeTemplateCollectionVar` /
 * `renameTemplateCollectionVar` / `setTemplateCollectionVarType` names
 * with `templateCollectionUid`-named args for call-site clarity.
 *
 * Like rule-collection vars (§12.3), template-collection vars do NOT
 * support `secret` semantically — only Vault holds secrets. The catalog
 * still types `VariableType` as `'default' | 'secret'` so the wire shape
 * is uniform across scopes; the UI layer rejects secret on this scope.
 */

import { makeVariableMutators, type VariableType } from '../shared/variable-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { invalidateResolverIntent } from './side-effects';
import { TEMPLATE_COLLECTION_ENTITY_TYPE, TEMPLATE_COLLECTION_VARS_PATH } from './types';

export type { VariableType };

const factories = makeVariableMutators({
  entityType: TEMPLATE_COLLECTION_ENTITY_TYPE,
  varsPath: TEMPLATE_COLLECTION_VARS_PATH,
  mintBatch,
  makeSideEffects: (uid, hlc) => [invalidateResolverIntent(uid, hlc)],
});

export interface SetTemplateCollectionVarArgs {
  templateCollectionUid: string;
  name: string;
  value: string;
  type?: VariableType;
  /** Optional explicit orderKey — defaults to seed-key when omitted. */
  orderKey?: string;
}

export function setTemplateCollectionVar(
  ctx: MutatorContext,
  args: SetTemplateCollectionVarArgs,
): MutatorIntent {
  return factories.setVariable(ctx, {
    entityUid: args.templateCollectionUid,
    name: args.name,
    value: args.value,
    type: args.type,
    orderKey: args.orderKey,
  });
}

export interface RemoveTemplateCollectionVarArgs {
  templateCollectionUid: string;
  name: string;
}

export function removeTemplateCollectionVar(
  ctx: MutatorContext,
  args: RemoveTemplateCollectionVarArgs,
): MutatorIntent {
  return factories.removeVariable(ctx, { entityUid: args.templateCollectionUid, name: args.name });
}

export interface RenameTemplateCollectionVarArgs {
  templateCollectionUid: string;
  oldName: string;
  newName: string;
  /** Carried through so the new entry has the same value. */
  value: string;
  type?: VariableType;
  orderKey?: string;
}

export function renameTemplateCollectionVar(
  ctx: MutatorContext,
  args: RenameTemplateCollectionVarArgs,
): MutatorIntent {
  return factories.renameVariable(ctx, {
    entityUid: args.templateCollectionUid,
    oldName: args.oldName,
    newName: args.newName,
    value: args.value,
    type: args.type,
    orderKey: args.orderKey,
  });
}

export interface SetTemplateCollectionVarTypeArgs {
  templateCollectionUid: string;
  name: string;
  /** Carried through so the LWW replacement preserves it. */
  value: string;
  type: VariableType;
}

export function setTemplateCollectionVarType(
  ctx: MutatorContext,
  args: SetTemplateCollectionVarTypeArgs,
): MutatorIntent {
  return factories.setVariableType(ctx, {
    entityUid: args.templateCollectionUid,
    name: args.name,
    value: args.value,
    type: args.type,
  });
}
