/**
 * Live-workflow bridge routes — the node host's answers for the calls
 * the workflow editor, its status strip, Workflow Status and the Run
 * view make (the workflow runs plan, Decisions log, S5): the
 * host-neutral routes (`@openheaders/oracle/live/workflow-route/route`)
 * over this host's chain runner.
 */

import { handleLiveWorkflowRpc as handleLiveWorkflowRpcOver } from '@openheaders/oracle/live/workflow-route/route';
import { runWorkflowRefresh } from './live/chain-runner';

export { isLiveWorkflowRpc, type LiveWorkflowRpcType } from '@openheaders/oracle/live/workflow-route/route';

/** Route one bridge message; `undefined` when the type is not ours. */
export function handleLiveWorkflowRpc(type: string, message: Record<string, unknown>): Promise<unknown> {
  return handleLiveWorkflowRpcOver(type, message, runWorkflowRefresh);
}
