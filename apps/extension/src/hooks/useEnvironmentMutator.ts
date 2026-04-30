/**
 * useEnvironmentMutator — write-only API for environment edits.
 *
 * Thin React adapter over `env-write-client.ts`.
 *
 * The result discriminator is uniform with the Rule mutator family
 * (`{ ok: true } | { ok: false; reason: 'not-found' | 'other' }`).
 * The legacy stale-draft branch is retired by Phase B (§24).
 */

import type { V5 } from '@openheaders/core/types';
import { useMemo } from 'react';
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
import { useGuardedMutation } from './use-guarded-mutation';

export type { EnvSimpleResult };

export interface UseEnvironmentMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseEnvironmentMutatorApi {
  setVariable(
    envId: string,
    name: string,
    value: string,
    type?: VariableType,
  ): Promise<EnvSimpleResult>;
  removeVariable(envId: string, name: string): Promise<EnvSimpleResult>;
  renameVariable(
    envId: string,
    oldName: string,
    newName: string,
    value: string,
    type?: VariableType,
  ): Promise<EnvSimpleResult>;
  setVariableType(
    envId: string,
    name: string,
    value: string,
    type: VariableType,
  ): Promise<EnvSimpleResult>;
  renameEnvironment(envId: string, name: string): Promise<EnvSimpleResult>;
  /** Replace the full variables list — see `applyEnvVariablesReplacement`. */
  replaceVariables(
    envId: string,
    newVars: readonly V5.Variable[],
    oldVars: readonly V5.Variable[],
  ): Promise<EnvSimpleResult>;
}

export function useEnvironmentMutator(
  opts: UseEnvironmentMutatorOptions,
): UseEnvironmentMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const setVariable = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, envId: string, name: string, value: string, type?: VariableType) =>
      applyEnvSetVar({ envId, name, value, type }, writeOpts),
  );

  const removeVariable = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, envId: string, name: string) => applyEnvRemoveVar({ envId, name }, writeOpts),
  );

  const renameVariable = useGuardedMutation(
    workspaceId,
    surfaceId,
    (
      writeOpts,
      envId: string,
      oldName: string,
      newName: string,
      value: string,
      type?: VariableType,
    ) => applyEnvRenameVar({ envId, oldName, newName, value, type }, writeOpts),
  );

  const setVariableType = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, envId: string, name: string, value: string, type: VariableType) =>
      applyEnvSetVarType({ envId, name, value, type }, writeOpts),
  );

  const renameEnv = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, envId: string, name: string) => applyRenameEnvironment({ envId, name }, writeOpts),
  );

  const replaceVariables = useGuardedMutation(
    workspaceId,
    surfaceId,
    (
      writeOpts,
      envId: string,
      newVars: readonly V5.Variable[],
      oldVars: readonly V5.Variable[],
    ) => applyEnvVariablesReplacement(envId, newVars, oldVars, writeOpts),
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
