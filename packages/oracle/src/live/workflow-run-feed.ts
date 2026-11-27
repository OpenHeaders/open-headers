/**
 * A workflow run's step events on their way to a page (the workflow
 * runs plan, The Run view) — host-neutral: every host that runs the
 * chain runner hands it one feed per run, and differs only in the sink
 * it installs (runtime messages, window IPC, an in-tab fan-out).
 *
 * Two halves, split at the settle:
 *   - the FACT rides the host's broadcast, tagged with the run's id and
 *     its place in the run's order — bounded, display only;
 *   - the PRODUCT (a response with its body) stays here and is fetched
 *     by run id and step id on a call's answer.
 */

import type { LiveWorkflowRunEventWire } from '@openheaders/core/bridge';
import type { RunTrigger, StepProduct, WorkflowRunEvent } from '@openheaders/core/live';
import { createRunProductHold, runFactOf } from '@openheaders/core/live';
import { generateUid } from '@openheaders/core/utils';

/** Body characters held across every workflow's last run. */
const HELD_BODY_BUDGET = 32 * 1024 * 1024;

type WorkflowRunEventSink = (event: LiveWorkflowRunEventWire) => void;

let sink: WorkflowRunEventSink | null = null;
const hold = createRunProductHold(HELD_BODY_BUDGET);

/** Install the host's broadcast for run events. No sink ⇒ a feed still holds products and emits nothing. */
export function setWorkflowRunEventSink(next: WorkflowRunEventSink | null): void {
  sink = next;
}

export interface WorkflowRunFeedTarget {
  workspaceId: string;
  workflowUid: string;
  /** `null` = "No environment". */
  environmentId: string | null;
  /** The caller's id for a run it started; absent ⇒ one is minted. */
  runId?: string;
  /** What started the run — its first fact says so. */
  trigger?: RunTrigger;
}

/** The listener one run's step events are handed to. */
export function openWorkflowRunFeed(target: WorkflowRunFeedTarget): (event: WorkflowRunEvent) => void {
  const { workspaceId, workflowUid, environmentId, trigger } = target;
  const runId = target.runId ?? generateUid();
  const key = `${workspaceId} ${workflowUid}`;
  let seq = 0;
  return (event) => {
    if (event.type === 'begin') hold.open(key, runId);
    if (event.type === 'step-settle' && event.product !== undefined) {
      hold.put(key, runId, event.stepId, event.product);
    }
    const fact = runFactOf(event);
    sink?.({
      workspaceId,
      workflowUid,
      environmentId,
      runId,
      seq: seq++,
      fact: fact.type === 'begin' && trigger !== undefined ? { ...fact, trigger } : fact,
    });
  };
}

/** What one step of a run produced, while this realm still holds it. */
export function getWorkflowRunProduct(runId: string, stepId: string): StepProduct | null {
  return hold.get(runId, stepId);
}

export function __resetWorkflowRunFeedForTests(): void {
  hold.clear();
  sink = null;
}
