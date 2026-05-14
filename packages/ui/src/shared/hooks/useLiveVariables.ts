/**
 * useLiveVariables — context reader for the live-variable list slice.
 *
 * Thin wrapper over `useLiveVariablesContext()`. Mirrors `useEnvironments`
 * (per MWPT-FULL § 4.1): the Provider mounts at the surface root and
 * decides override-vs-legacy branch via `activeWorkspaceIdOverride`;
 * consumers read from context and stay agnostic of the branch.
 */

import {
  type LiveVariableOverrideResult,
  type LiveVariablesContextValue,
  type LiveVariableWriteResult,
  useLiveVariablesContext,
} from '@openheaders/ui/context';

export type { LiveVariableOverrideResult, LiveVariableWriteResult };

export type UseLiveVariablesApi = LiveVariablesContextValue;

export function useLiveVariables(): UseLiveVariablesApi {
  return useLiveVariablesContext();
}
