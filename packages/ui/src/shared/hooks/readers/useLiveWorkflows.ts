/**
 * useLiveWorkflows — context reader for the live-workflow list slice.
 *
 * Thin wrapper over `useLiveWorkflowsContext()`. Mirrors `useLiveVariables`
 * (per MWPT-FULL § 4.1): the Provider mounts at the surface root and
 * decides override-vs-legacy branch via `activeWorkspaceIdOverride`;
 * consumers read from context and stay agnostic of the branch.
 */

import {
  type LiveWorkflowsContextValue,
  type LiveWorkflowWriteResult,
  useLiveWorkflowsContext,
} from '@openheaders/ui/context';

export type { LiveWorkflowWriteResult };

export type UseLiveWorkflowsApi = LiveWorkflowsContextValue;

export function useLiveWorkflows(): UseLiveWorkflowsApi {
  return useLiveWorkflowsContext();
}
