/**
 * Variable intent factories for workspace-scoped variables.
 *
 * Thin per-catalog adapter over {@link makeVariableMutators}. Workspace
 * vars are singleton (one entity per workspace, fixed id =
 * `WORKSPACE_VARIABLES_ID`), so the wrapper binds the fixed id
 * internally and exposes arg shapes without an `entityUid` field.
 *
 * Set-member identity = `variable.uid`. Per-(setPath, uid) LWW handles
 * concurrent same-row edits; concurrent same-row renames converge on
 * the later-HLC name. Two surfaces independently adding same-named rows
 * produce two distinct uids → two rows for manual merge.
 */

import type { Variable } from '../../../types/variable';
import { makeVariableMutators, type VariableType } from '../shared/variable-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { deriveWorkspaceVariablesSideEffects } from './side-effects';
import { WORKSPACE_VARIABLES_ENTITY_TYPE, WORKSPACE_VARIABLES_ID, WORKSPACE_VARIABLES_PATH } from './types';

export type { VariableType };

const factories = makeVariableMutators({
  entityType: WORKSPACE_VARIABLES_ENTITY_TYPE,
  varsPath: WORKSPACE_VARIABLES_PATH,
  mintBatch,
  deriveSideEffects: deriveWorkspaceVariablesSideEffects,
});

export interface SetWorkspaceVarArgs {
  /** Whole variable record. `variable.uid` is the set-member itemId. */
  variable: Variable;
  /** Optional explicit orderKey — defaults to seed-key when omitted. */
  orderKey?: string;
}

export function setWorkspaceVar(ctx: MutatorContext, args: SetWorkspaceVarArgs): MutatorIntent {
  return factories.setVariable(ctx, {
    entityUid: WORKSPACE_VARIABLES_ID,
    variable: args.variable,
    orderKey: args.orderKey,
  });
}

export interface RemoveWorkspaceVarArgs {
  /** The row's persisted uid — NOT its name. */
  uid: string;
}

export function removeWorkspaceVar(ctx: MutatorContext, args: RemoveWorkspaceVarArgs): MutatorIntent {
  return factories.removeVariable(ctx, { entityUid: WORKSPACE_VARIABLES_ID, uid: args.uid });
}
