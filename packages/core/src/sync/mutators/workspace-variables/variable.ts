/**
 * Variable intent factories for workspace-scoped variables.
 *
 * Thin per-catalog adapter over {@link makeVariableMutators}. Workspace
 * vars are singleton (one entity per workspace, fixed id =
 * `WORKSPACE_VARIABLES_ID`), so the wrapper binds the fixed id
 * internally and exposes arg shapes without an `entityUid` field.
 * `makeSideEffects` ignores the uid arg since the resolver-invalidate
 * intent for workspace-vars carries no key.
 *
 * Set-member identity = variable name. Per-(setPath, name) LWW handles
 * concurrent same-name edits; concurrent diverging renames produce two
 * new entries — the convergent answer for "two surfaces independently
 * renamed the same variable to different names."
 */

import { makeVariableMutators, type VariableType } from '../shared/variable-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { invalidateResolverIntent } from './side-effects';
import {
  WORKSPACE_VARIABLES_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ID,
  WORKSPACE_VARIABLES_PATH,
} from './types';

export type { VariableType };

const factories = makeVariableMutators({
  entityType: WORKSPACE_VARIABLES_ENTITY_TYPE,
  varsPath: WORKSPACE_VARIABLES_PATH,
  mintBatch,
  makeSideEffects: (_uid, hlc) => [invalidateResolverIntent(hlc)],
});

export interface SetWorkspaceVarArgs {
  name: string;
  value: string;
  type?: VariableType;
  /** Optional explicit orderKey — defaults to seed-key when omitted. */
  orderKey?: string;
}

export function setWorkspaceVar(ctx: MutatorContext, args: SetWorkspaceVarArgs): MutatorIntent {
  return factories.setVariable(ctx, {
    entityUid: WORKSPACE_VARIABLES_ID,
    name: args.name,
    value: args.value,
    type: args.type,
    orderKey: args.orderKey,
  });
}

export interface RemoveWorkspaceVarArgs {
  name: string;
}

export function removeWorkspaceVar(
  ctx: MutatorContext,
  args: RemoveWorkspaceVarArgs,
): MutatorIntent {
  return factories.removeVariable(ctx, { entityUid: WORKSPACE_VARIABLES_ID, name: args.name });
}

export interface RenameWorkspaceVarArgs {
  oldName: string;
  newName: string;
  /** Carried through so the new entry has the same value. */
  value: string;
  type?: VariableType;
  orderKey?: string;
}

export function renameWorkspaceVar(
  ctx: MutatorContext,
  args: RenameWorkspaceVarArgs,
): MutatorIntent {
  return factories.renameVariable(ctx, {
    entityUid: WORKSPACE_VARIABLES_ID,
    oldName: args.oldName,
    newName: args.newName,
    value: args.value,
    type: args.type,
    orderKey: args.orderKey,
  });
}

export interface SetWorkspaceVarTypeArgs {
  name: string;
  /** Carried through so the LWW replacement preserves it. */
  value: string;
  type: VariableType;
}

export function setWorkspaceVarType(
  ctx: MutatorContext,
  args: SetWorkspaceVarTypeArgs,
): MutatorIntent {
  return factories.setVariableType(ctx, {
    entityUid: WORKSPACE_VARIABLES_ID,
    name: args.name,
    value: args.value,
    type: args.type,
  });
}
