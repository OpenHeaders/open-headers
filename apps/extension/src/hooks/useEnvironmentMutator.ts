/**
 * useEnvironmentMutator — write-only API for environment edits.
 *
 * Thin React adapter over `env-write-client.ts`. Identity for variable
 * rows is `variable.uid`; `setVariable` upserts the whole record
 * (handles add, edit, rename, type-toggle uniformly), `removeVariable`
 * keys by uid.
 *
 * The result discriminator is uniform with the Rule mutator family
 * (`{ ok: true } | { ok: false; reason: 'not-found' | 'other' }`).
 */

import type { V5 } from '@openheaders/core/types';
import { useMemo } from 'react';
import {
  applyEnvRemoveVar,
  applyEnvSetVar,
  applyEnvVariablesReplacement,
  applyRenameEnvironment,
  type EnvSimpleResult,
} from '@/shared/sync/env-write-client';
import { useGuardedMutation } from './use-guarded-mutation';

export type { EnvSimpleResult };

export interface UseEnvironmentMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseEnvironmentMutatorApi {
  /** Upsert a variable row — handles add, edit, rename, type-toggle. */
  setVariable(envId: string, variable: V5.Variable): Promise<EnvSimpleResult>;
  /** Remove a variable row by its persisted uid. */
  removeVariable(envId: string, uid: string): Promise<EnvSimpleResult>;
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
    (writeOpts, envId: string, variable: V5.Variable) =>
      applyEnvSetVar({ envId, variable }, writeOpts),
  );

  const removeVariable = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, envId: string, uid: string) => applyEnvRemoveVar({ envId, uid }, writeOpts),
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
      renameEnvironment: renameEnv,
      replaceVariables,
    }),
    [setVariable, removeVariable, renameEnv, replaceVariables],
  );
}
