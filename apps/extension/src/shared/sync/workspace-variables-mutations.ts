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
 * one either. Variable rows carry a stable `uid` that doubles as the
 * sync engine's itemId; `buildSetWorkspaceVarBatch` upserts the whole
 * record (handles add, edit, rename, type-toggle uniformly);
 * `buildRemoveWorkspaceVarBatch` keys by uid.
 */

import type { V5 } from '@openheaders/core/types';
type Variable = V5.Variable;
import {
  type MutatorContext,
  type MutatorIntent,
  removeWorkspaceVar,
  setWorkspaceVar,
} from '@openheaders/core/sync';

export type WorkspaceVariablesMutationPayload = MutatorIntent;

export interface SetWorkspaceVarInput {
  /** Whole variable record. `variable.uid` is the set-member itemId. */
  variable: Variable;
  orderKey?: string;
}

export function buildSetWorkspaceVarBatch(
  input: SetWorkspaceVarInput,
  ctx: MutatorContext,
): WorkspaceVariablesMutationPayload {
  return setWorkspaceVar(ctx, input);
}

export interface RemoveWorkspaceVarInput {
  /** The row's persisted uid — NOT its name. */
  uid: string;
}

export function buildRemoveWorkspaceVarBatch(
  input: RemoveWorkspaceVarInput,
  ctx: MutatorContext,
): WorkspaceVariablesMutationPayload {
  return removeWorkspaceVar(ctx, input);
}
