/**
 * useEnvironmentMutator — write-only API for environment edits.
 *
 * Thin React adapter over the imperative helpers in
 * `env-write-client.ts`. Mirrors `useRuleMutator` — every memoised
 * callback closes over the `(workspaceId, surfaceId)` pair so a
 * workspace switch produces fresh function references and any
 * in-flight envelope carries the workspace id it was minted under.
 *
 * The result discriminator is uniform with the Rule mutator family
 * (`{ ok: true } | { ok: false; reason: 'not-found' | 'other' }`).
 * The legacy stale-draft branch is retired by Phase B (§24).
 */

import type { V5 } from '@openheaders/core/types';
import { useCallback, useMemo } from 'react';
import {
  applyEnvRemoveVar,
  applyEnvRenameVar,
  applyEnvSetVar,
  applyEnvSetVarType,
  applyEnvVariablesReplacement,
  applyRenameEnvironment,
  type EnvSimpleResult,
} from '@/shared/sync/env-write-client';
import type { VariableType } from '@openheaders/core/sync';

export type { EnvSimpleResult };

export interface UseEnvironmentMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseEnvironmentMutatorApi {
  setVariable(envId: string, name: string, value: string, type?: VariableType): Promise<EnvSimpleResult>;
  removeVariable(envId: string, name: string): Promise<EnvSimpleResult>;
  renameVariable(
    envId: string,
    oldName: string,
    newName: string,
    value: string,
    type?: VariableType,
  ): Promise<EnvSimpleResult>;
  setVariableType(envId: string, name: string, value: string, type: VariableType): Promise<EnvSimpleResult>;
  renameEnvironment(envId: string, name: string): Promise<EnvSimpleResult>;
  /** Replace the full variables list — see `applyEnvVariablesReplacement`. */
  replaceVariables(
    envId: string,
    newVars: readonly V5.Variable[],
    oldVars: readonly V5.Variable[],
  ): Promise<EnvSimpleResult>;
}

const NO_WORKSPACE = { ok: false, reason: 'other', message: 'no active workspace' } as const;

export function useEnvironmentMutator(opts: UseEnvironmentMutatorOptions): UseEnvironmentMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const setVariable = useCallback<UseEnvironmentMutatorApi['setVariable']>(
    async (envId, name, value, type) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyEnvSetVar({ envId, name, value, type }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const removeVariable = useCallback<UseEnvironmentMutatorApi['removeVariable']>(
    async (envId, name) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyEnvRemoveVar({ envId, name }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const renameVariable = useCallback<UseEnvironmentMutatorApi['renameVariable']>(
    async (envId, oldName, newName, value, type) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyEnvRenameVar(
        { envId, oldName, newName, value, type },
        { workspaceId, surfaceId },
      );
    },
    [workspaceId, surfaceId],
  );

  const setVariableType = useCallback<UseEnvironmentMutatorApi['setVariableType']>(
    async (envId, name, value, type) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyEnvSetVarType({ envId, name, value, type }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const renameEnv = useCallback<UseEnvironmentMutatorApi['renameEnvironment']>(
    async (envId, name) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyRenameEnvironment({ envId, name }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const replaceVariables = useCallback<UseEnvironmentMutatorApi['replaceVariables']>(
    async (envId, newVars, oldVars) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyEnvVariablesReplacement(envId, newVars, oldVars, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  return useMemo(
    () => ({
      setVariable,
      removeVariable,
      renameVariable,
      setVariableType,
      renameEnvironment: renameEnv,
      replaceVariables,
    }),
    [setVariable, removeVariable, renameVariable, setVariableType, renameEnv, replaceVariables],
  );
}
