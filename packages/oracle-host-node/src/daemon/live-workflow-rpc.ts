/**
 * Live-workflow bridge routes — the node host's answers for the calls
 * the workflow editor, its status strip, Workflow Status and the Run
 * view make (the workflow runs plan, Decisions log, S5): a run on a
 * person's press, the cache read, the circuit reset, and what one step
 * of a run produced.
 *
 * The press goes through the host-neutral manual-refresh rule over this
 * host's chain runner. A workbench surface names the workspace it shows;
 * a caller that names none means the active one.
 */

import type { BridgeRpcResponse } from '@openheaders/core/bridge';
import {
  getWorkflowRunCache,
  listCachesForWorkflow,
  resetCircuitForRun,
} from '@openheaders/oracle/live/live-cache-store';
import { refreshWorkflowByUser } from '@openheaders/oracle/live/manual-refresh';
import { getWorkflowRunProduct } from '@openheaders/oracle/live/workflow-run-feed';
import { getActiveWorkspaceId } from '@openheaders/oracle/workspace/extension-workspace-store';
import { runWorkflowRefresh } from './live/chain-runner';

const LIVE_WORKFLOW_TYPES = new Set([
  'refreshLiveWorkflowNow',
  'getLiveCacheForWorkflow',
  'resetLiveWorkflowCircuit',
  'getLiveWorkflowRunProduct',
]);

export type LiveWorkflowRpcType =
  | 'refreshLiveWorkflowNow'
  | 'getLiveCacheForWorkflow'
  | 'resetLiveWorkflowCircuit'
  | 'getLiveWorkflowRunProduct';

export function isLiveWorkflowRpc(type: unknown): type is LiveWorkflowRpcType {
  return typeof type === 'string' && LIVE_WORKFLOW_TYPES.has(type);
}

function stringOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function workspaceOf(message: Record<string, unknown>): string {
  return typeof message.workspaceId === 'string' ? message.workspaceId : getActiveWorkspaceId();
}

function environmentOf(message: Record<string, unknown>): string | null {
  return typeof message.environmentId === 'string' ? message.environmentId : null;
}

export async function handleRefreshLiveWorkflowNow(
  message: Record<string, unknown>,
): Promise<BridgeRpcResponse<'refreshLiveWorkflowNow'>> {
  const workflowUid = stringOf(message.workflowUid);
  const environmentId = environmentOf(message);
  const workspaceId = workspaceOf(message);
  let thrown: string | null = null;
  try {
    await refreshWorkflowByUser(
      {
        workspaceId,
        workflowUid,
        environmentId,
        ...(typeof message.runId === 'string' ? { runId: message.runId } : {}),
      },
      {
        // The runner returns a failed run as a value; the rule takes a throw.
        run: async (args) => {
          const result = await runWorkflowRefresh(args);
          if (!result.ok) throw new Error(result.message);
        },
      },
    );
  } catch (err) {
    thrown = err instanceof Error ? err.message : String(err);
  }
  // The cache row carries the failed step's own sentence where the run got that far.
  const run = await getWorkflowRunCache(workflowUid, environmentId, workspaceId);
  if (thrown !== null) return { success: false, error: run?.lastErrorMessage ?? thrown };
  if (run === null) return { success: false, error: `Workflow ${workflowUid} left no run to read` };
  return { success: true, run };
}

export async function handleGetLiveCacheForWorkflow(
  message: Record<string, unknown>,
): Promise<BridgeRpcResponse<'getLiveCacheForWorkflow'>> {
  const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : undefined;
  try {
    return { runs: await listCachesForWorkflow(stringOf(message.workflowUid), workspaceId) };
  } catch {
    return { runs: [] };
  }
}

export async function handleResetLiveWorkflowCircuit(
  message: Record<string, unknown>,
): Promise<BridgeRpcResponse<'resetLiveWorkflowCircuit'>> {
  try {
    await resetCircuitForRun(stringOf(message.workflowUid), environmentOf(message), workspaceOf(message));
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function handleGetLiveWorkflowRunProduct(
  message: Record<string, unknown>,
): BridgeRpcResponse<'getLiveWorkflowRunProduct'> {
  return { product: getWorkflowRunProduct(stringOf(message.runId), stringOf(message.stepId)) };
}

/** Route one bridge message; `undefined` when the type is not ours. */
export async function handleLiveWorkflowRpc(type: string, message: Record<string, unknown>): Promise<unknown> {
  switch (type) {
    case 'refreshLiveWorkflowNow':
      return handleRefreshLiveWorkflowNow(message);
    case 'getLiveCacheForWorkflow':
      return handleGetLiveCacheForWorkflow(message);
    case 'resetLiveWorkflowCircuit':
      return handleResetLiveWorkflowCircuit(message);
    case 'getLiveWorkflowRunProduct':
      return handleGetLiveWorkflowRunProduct(message);
    default:
      return undefined;
  }
}
