/**
 * useWorkspaceVariablesMutator — write-only API for workspace-vars edits.
 *
 * Thin React adapter over the imperative helpers in
 * `workspace-variables-write-client.ts`. Mirrors `useEnvironmentMutator`
 * — every memoised callback closes over the `(workspaceId, surfaceId)`
 * pair so a workspace switch produces fresh function references and
 * any in-flight envelope carries the workspace id it was minted under.
 *
 * Singleton entity — none of the helpers take an entity id.
 */

import type { VariableType } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { useCallback, useMemo } from 'react';
import {
  applyWorkspaceVariablesReplacement,
  applyWorkspaceVarRemove,
  applyWorkspaceVarRename,
  applyWorkspaceVarSet,
  applyWorkspaceVarSetType,
  type WorkspaceVariablesSimpleResult,
} from '@/shared/sync/workspace-variables-write-client';

export type { WorkspaceVariablesSimpleResult };

export interface UseWorkspaceVariablesMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseWorkspaceVariablesMutatorApi {
  setVariable(name: string, value: string, type?: VariableType): Promise<WorkspaceVariablesSimpleResult>;
  removeVariable(name: string): Promise<WorkspaceVariablesSimpleResult>;
  renameVariable(
    oldName: string,
    newName: string,
    value: string,
    type?: VariableType,
  ): Promise<WorkspaceVariablesSimpleResult>;
  setVariableType(name: string, value: string, type: VariableType): Promise<WorkspaceVariablesSimpleResult>;
  /** Replace the full variables list — see `applyWorkspaceVariablesReplacement`. */
  replaceVariables(
    newVars: readonly V5.Variable[],
    oldVars: readonly V5.Variable[],
  ): Promise<WorkspaceVariablesSimpleResult>;
}

const NO_WORKSPACE = { ok: false, reason: 'other', message: 'no active workspace' } as const;

export function useWorkspaceVariablesMutator(
  opts: UseWorkspaceVariablesMutatorOptions,
): UseWorkspaceVariablesMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const setVariable = useCallback<UseWorkspaceVariablesMutatorApi['setVariable']>(
    async (name, value, type) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyWorkspaceVarSet({ name, value, type }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const removeVariable = useCallback<UseWorkspaceVariablesMutatorApi['removeVariable']>(
    async (name) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyWorkspaceVarRemove({ name }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const renameVariable = useCallback<UseWorkspaceVariablesMutatorApi['renameVariable']>(
    async (oldName, newName, value, type) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyWorkspaceVarRename(
        { oldName, newName, value, type },
        { workspaceId, surfaceId },
      );
    },
    [workspaceId, surfaceId],
  );

  const setVariableType = useCallback<UseWorkspaceVariablesMutatorApi['setVariableType']>(
    async (name, value, type) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyWorkspaceVarSetType({ name, value, type }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const replaceVariables = useCallback<UseWorkspaceVariablesMutatorApi['replaceVariables']>(
    async (newVars, oldVars) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyWorkspaceVariablesReplacement(newVars, oldVars, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  return useMemo(
    () => ({
      setVariable,
      removeVariable,
      renameVariable,
      setVariableType,
      replaceVariables,
    }),
    [setVariable, removeVariable, renameVariable, setVariableType, replaceVariables],
  );
}
