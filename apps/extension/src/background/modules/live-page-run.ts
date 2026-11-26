/**
 * This worker's side of a workflow run that lives in the workbench page
 * (the workflow runs plan, Laws — "The run lives with its session"). The
 * page holds the runner, the window and the session; this worker runs
 * each `call` step through the adapter its own runs use, under the same
 * rate limit, and makes the one commit at the end. Nothing of the run is
 * kept here between two calls, so this worker going away costs the run
 * the call in flight and no more.
 *
 * A call tells the page when the rate limit holds it and when it is
 * about to leave, and waits for the page to note the leave before it
 * goes to the wire: what the page opens at the leave — an `expect`'s
 * window — is then open before anything can answer the call.
 */

import type { BridgeRpcRequest, BridgeRpcResponse } from '@openheaders/core/bridge';
import { isCallStep, StepExecutionError } from '@openheaders/core/live';
import { WorkflowStepSchema } from '@openheaders/core/schemas';
import { getLiveWorkflowInWorkspace } from '@openheaders/oracle/live/live-workflow-store';
import { broadcast } from '@utils/bridge';
import * as v from 'valibot';
import { buildFetchAdapter, commitPageRun } from './live-chain-adapter';
import { settleLiveWorkflowRunByUser } from './live-refresh-scheduler';

/** How long the page has to note a call's leave before the call is given up, unsent. */
export const LEAVE_ACK_DEADLINE_MS = 2_000;

/** The calls that wait for their page to note the leave, by call id. */
const awaitingLeaveAck = new Map<string, () => void>();

function leaveNoted(callId: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const deadline = setTimeout(() => {
      awaitingLeaveAck.delete(callId);
      reject(new Error('The page that runs this workflow did not answer, so the call was not sent.'));
    }, LEAVE_ACK_DEADLINE_MS);
    awaitingLeaveAck.set(callId, () => {
      clearTimeout(deadline);
      awaitingLeaveAck.delete(callId);
      resolve();
    });
    broadcast('liveWorkflowStepSignal', { callId, signal: 'leaving' });
  });
}

/** The page noted a call's leave. `false` when no call by that id waits. */
export function ackPageRunStepLeave(callId: string): boolean {
  const noted = awaitingLeaveAck.get(callId);
  if (noted === undefined) return false;
  noted();
  return true;
}

export async function callPageRunStep(
  req: BridgeRpcRequest<'callLiveWorkflowStep'>,
): Promise<BridgeRpcResponse<'callLiveWorkflowStep'>> {
  const { callId, workspaceId, workflowUid, environmentId, resend } = req;
  const step = v.safeParse(WorkflowStepSchema, req.step);
  if (!step.success || !isCallStep(step.output)) {
    return { success: false, error: 'The step handed over is not a valid call step.' };
  }
  const stepCaptures = new Map(
    Object.entries(req.stepCaptures).map(([stepId, captures]) => [stepId, new Map(Object.entries(captures))]),
  );
  let leaving: Promise<void> = Promise.resolve();
  const adapter = buildFetchAdapter(workspaceId, workflowUid, environmentId, () => leaving);
  try {
    const response = await adapter.executeStep(
      step.output,
      stepCaptures,
      { workflowUid, workspaceId, environmentId },
      {
        resend,
        onHeld: () => broadcast('liveWorkflowStepSignal', { callId, signal: 'held' }),
        onLeave: () => {
          leaving = leaveNoted(callId);
        },
      },
    );
    return { success: true, response };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      ...(err instanceof StepExecutionError ? { snapshot: err.snapshot } : {}),
    };
  }
}

/** The run's one commit, inside the second half of the press rule. Throws when the run did not pass. */
export function settlePageRun(req: BridgeRpcRequest<'commitLiveWorkflowRun'>): Promise<void> {
  const { workspaceId, workflowUid, environmentId, bypass, outcome } = req;
  return settleLiveWorkflowRunByUser(workspaceId, workflowUid, environmentId, async () => {
    const workflow = getLiveWorkflowInWorkspace(workflowUid, workspaceId);
    if (!workflow) throw new Error(`Workflow ${workflowUid} not found in workspace ${workspaceId}`);
    await commitPageRun({ workspaceId, workflow, environmentId, bypass, outcome });
  });
}
