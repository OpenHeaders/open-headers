/**
 * useWorkspaceVariablesMutator — write-only API for workspace-vars edits.
 *
 * Thin React adapter over `workspace-variables-write-client.ts`.
 * Singleton entity — none of the helpers take an entity id. Identity
 * for variable rows is `variable.uid`; `setVariable` upserts the whole
 * record (handles add, edit, rename, type-toggle uniformly),
 * `removeVariable` keys by uid.
 */

import type { V5 } from '@openheaders/core/types';
import { useMemo } from 'react';
import {
  applyWorkspaceVariablesReplacement,
  applyWorkspaceVarRemove,
  applyWorkspaceVarSet,
  type WorkspaceVariablesSimpleResult,
} from '@/shared/sync/workspace-variables-write-client';
import { useGuardedMutation } from './use-guarded-mutation';

export type { WorkspaceVariablesSimpleResult };

export interface UseWorkspaceVariablesMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseWorkspaceVariablesMutatorApi {
  /** Upsert a variable row — handles add, edit, rename, type-toggle. */
  setVariable(variable: V5.Variable): Promise<WorkspaceVariablesSimpleResult>;
  /** Remove a variable row by its persisted uid. */
  removeVariable(uid: string): Promise<WorkspaceVariablesSimpleResult>;
  /** Replace the full variables list — see `applyWorkspaceVariablesReplacement`. */
  replaceVariables(
    newVars: readonly V5.Variable[],
    oldVars: readonly V5.Variable[],
  ): Promise<WorkspaceVariablesSimpleResult>;
}

export function useWorkspaceVariablesMutator(
  opts: UseWorkspaceVariablesMutatorOptions,
): UseWorkspaceVariablesMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const setVariable = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, variable: V5.Variable) => applyWorkspaceVarSet({ variable }, writeOpts),
  );

  const removeVariable = useGuardedMutation(workspaceId, surfaceId, (writeOpts, uid: string) =>
    applyWorkspaceVarRemove({ uid }, writeOpts),
  );

  const replaceVariables = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, newVars: readonly V5.Variable[], oldVars: readonly V5.Variable[]) =>
      applyWorkspaceVariablesReplacement(newVars, oldVars, writeOpts),
  );

  return useMemo(
    () => ({
      setVariable,
      removeVariable,
      replaceVariables,
    }),
    [setVariable, removeVariable, replaceVariables],
  );
}
