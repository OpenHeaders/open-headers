/**
 * useEnvironments — env-list-slice consumer of `EnvironmentContext`.
 *
 * Returns environments, the active/default/manual env pointers,
 * collection-env overrides, and env CRUD + pointer mutators.
 *
 * Cross-cutting consumers that also need workspace variables / vault
 * read those slices via `useWorkspaceVariables()` / `useVault()`, or
 * the aggregator `useEnvVarVault()` for "I need everything" cases.
 */

import { useContext } from 'react';
import {
  EnvironmentContext,
  type EnvironmentContextValue,
  type EnvironmentWriteResult,
} from '@/context/EnvironmentContext';

export type { EnvironmentWriteResult };
export type UseEnvironmentsApi = EnvironmentContextValue;

export function useEnvironments(): UseEnvironmentsApi {
  return useContext(EnvironmentContext);
}
