/**
 * useWorkspaceVariablesMutator — write-only API for workspace-vars edits.
 *
 * Thin React adapter over `workspace-variables-write-client.ts`.
 * Singleton entity — none of the helpers take an entity id.
 */

import type { VariableType } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { useMemo } from 'react';
import {
  applyWorkspaceVariablesReplacement,
  applyWorkspaceVarRemove,
  applyWorkspaceVarRename,
  applyWorkspaceVarSet,
  applyWorkspaceVarSetType,
  type WorkspaceVariablesSimpleResult,
} from '@/shared/sync/workspace-variables-write-client';
import { useGuardedMutation } from './use-guarded-mutation';

export type { WorkspaceVariablesSimpleResult };

export interface UseWorkspaceVariablesMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseWorkspaceVariablesMutatorApi {
  setVariable(
    name: string,
    value: string,
    type?: VariableType,
  ): Promise<WorkspaceVariablesSimpleResult>;
  removeVariable(name: string): Promise<WorkspaceVariablesSimpleResult>;
  renameVariable(
    oldName: string,
    newName: string,
    value: string,
    type?: VariableType,
  ): Promise<WorkspaceVariablesSimpleResult>;
  setVariableType(
    name: string,
    value: string,
    type: VariableType,
  ): Promise<WorkspaceVariablesSimpleResult>;
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
    (writeOpts, name: string, value: string, type?: VariableType) =>
      applyWorkspaceVarSet({ name, value, type }, writeOpts),
  );

  const removeVariable = useGuardedMutation(workspaceId, surfaceId, (writeOpts, name: string) =>
    applyWorkspaceVarRemove({ name }, writeOpts),
  );

  const renameVariable = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, oldName: string, newName: string, value: string, type?: VariableType) =>
      applyWorkspaceVarRename({ oldName, newName, value, type }, writeOpts),
  );

  const setVariableType = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, name: string, value: string, type: VariableType) =>
      applyWorkspaceVarSetType({ name, value, type }, writeOpts),
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
      renameVariable,
      setVariableType,
      replaceVariables,
    }),
    [setVariable, removeVariable, renameVariable, setVariableType, replaceVariables],
  );
}
