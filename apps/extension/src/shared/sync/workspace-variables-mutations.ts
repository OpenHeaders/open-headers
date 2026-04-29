/**
 * Workspace-variables write-site → oracle helpers.
 *
 * Mirrors `env-mutations.ts` / `collection-mutations.ts`. Each helper
 * produces a `(MutationBatch, SideEffectIntent[])` pair from the
 * catalog factory in `@openheaders/core/sync` and a {@link
 * MutatorContext}. Pure transforms — no oracle reads, no IO — used by
 * both the SW (boot-time hydration via the workspace-variables cache)
 * and the renderer (`useWorkspaceVariablesMutator` write client).
 *
 * The singleton entity has no id arg on the catalog factories — every
 * call targets the fixed id internally, so these wrappers don't carry
 * one either.
 */

import {
  type MutatorContext,
  type MutatorIntent,
  removeWorkspaceVar,
  renameWorkspaceVar,
  setWorkspaceVar,
  setWorkspaceVarType,
  type VariableType,
} from '@openheaders/core/sync';

export type WorkspaceVariablesMutationPayload = MutatorIntent;

export interface SetWorkspaceVarInput {
  name: string;
  value: string;
  type?: VariableType;
  orderKey?: string;
}

export function buildSetWorkspaceVarBatch(
  input: SetWorkspaceVarInput,
  ctx: MutatorContext,
): WorkspaceVariablesMutationPayload {
  return setWorkspaceVar(ctx, input);
}

export interface RemoveWorkspaceVarInput {
  name: string;
}

export function buildRemoveWorkspaceVarBatch(
  input: RemoveWorkspaceVarInput,
  ctx: MutatorContext,
): WorkspaceVariablesMutationPayload {
  return removeWorkspaceVar(ctx, input);
}

export interface RenameWorkspaceVarInput {
  oldName: string;
  newName: string;
  value: string;
  type?: VariableType;
  orderKey?: string;
}

export function buildRenameWorkspaceVarBatch(
  input: RenameWorkspaceVarInput,
  ctx: MutatorContext,
): WorkspaceVariablesMutationPayload {
  return renameWorkspaceVar(ctx, input);
}

export interface SetWorkspaceVarTypeInput {
  name: string;
  value: string;
  type: VariableType;
}

export function buildSetWorkspaceVarTypeBatch(
  input: SetWorkspaceVarTypeInput,
  ctx: MutatorContext,
): WorkspaceVariablesMutationPayload {
  return setWorkspaceVarType(ctx, input);
}
