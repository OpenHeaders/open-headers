/**
 * Variable intent factories for template-collection-scoped variables.
 *
 * Thin per-catalog adapter over {@link makeVariableMutators}: binds the
 * shared factory to the template-collection routing constants +
 * side-effect intent. Re-exports the two primitives under the
 * `setTemplateCollectionVar` / `removeTemplateCollectionVar` names with
 * `templateCollectionUid`-named args for call-site clarity.
 *
 * Set-member identity = `variable.uid`. Per-(setPath, uid) LWW handles
 * concurrent same-row edits; concurrent same-row renames converge on
 * the later-HLC name.
 *
 * Like rule-collection vars (§12.3), template-collection vars do NOT
 * support `secret` semantically — only Vault holds secrets. The catalog
 * still types `VariableType` as `'default' | 'secret'` so the wire shape
 * is uniform across scopes; the UI layer rejects secret on this scope.
 */

import type { Variable } from '../../../types/variable';
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
  /** Whole variable record. `variable.uid` is the set-member itemId. */
  variable: Variable;
  /** Optional explicit orderKey — defaults to seed-key when omitted. */
  orderKey?: string;
}

export function setTemplateCollectionVar(
  ctx: MutatorContext,
  args: SetTemplateCollectionVarArgs,
): MutatorIntent {
  return factories.setVariable(ctx, {
    entityUid: args.templateCollectionUid,
    variable: args.variable,
    orderKey: args.orderKey,
  });
}

export interface RemoveTemplateCollectionVarArgs {
  templateCollectionUid: string;
  /** The row's persisted uid — NOT its name. */
  uid: string;
}

export function removeTemplateCollectionVar(
  ctx: MutatorContext,
  args: RemoveTemplateCollectionVarArgs,
): MutatorIntent {
  return factories.removeVariable(ctx, { entityUid: args.templateCollectionUid, uid: args.uid });
}
