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
 *
 * A workflow's products are held until that workflow runs again in this
 * realm. Across workflows the held bodies are bounded: past the budget
 * the oldest runs give theirs up first, never the newest.
 */

import type { LiveWorkflowRunEventWire } from '@openheaders/core/bridge';
import type { StepProduct, WorkflowRunEvent } from '@openheaders/core/live';
import { runFactOf } from '@openheaders/core/live';
import { generateUid } from '@openheaders/core/utils';

/** Body characters held across every workflow's last run. */
const HELD_BODY_BUDGET = 32 * 1024 * 1024;

type WorkflowRunEventSink = (event: LiveWorkflowRunEventWire) => void;

let sink: WorkflowRunEventSink | null = null;

/** Install the host's broadcast for run events. No sink ⇒ a feed still holds products and emits nothing. */
export function setWorkflowRunEventSink(next: WorkflowRunEventSink | null): void {
  sink = next;
}

interface HeldRun {
  runId: string;
  products: Map<string, StepProduct>;
  bodySize: number;
}

/** Insertion order is age: a workflow's entry is re-inserted when it runs again. */
const held = new Map<string, HeldRun>();

export interface WorkflowRunFeedTarget {
  workspaceId: string;
  workflowUid: string;
  /** `null` = "No environment". */
  environmentId: string | null;
  /** The caller's id for a run it started; absent ⇒ one is minted. */
  runId?: string;
}

/** The listener one run's step events are handed to. */
export function openWorkflowRunFeed(target: WorkflowRunFeedTarget): (event: WorkflowRunEvent) => void {
  const { workspaceId, workflowUid, environmentId } = target;
  const runId = target.runId ?? generateUid();
  const key = `${workspaceId} ${workflowUid}`;
  let seq = 0;
  return (event) => {
    if (event.type === 'begin') {
      held.delete(key);
      held.set(key, { runId, products: new Map(), bodySize: 0 });
    }
    if (event.type === 'step-settle' && event.product !== undefined) hold(key, runId, event.stepId, event.product);
    sink?.({ workspaceId, workflowUid, environmentId, runId, seq: seq++, fact: runFactOf(event) });
  };
}

function hold(key: string, runId: string, stepId: string, product: StepProduct): void {
  const run = held.get(key);
  if (run === undefined || run.runId !== runId) return;
  run.products.set(stepId, product);
  run.bodySize += product.snapshot.body.length;
  let total = 0;
  for (const each of held.values()) total += each.bodySize;
  for (const [oldestKey, oldest] of held) {
    if (total <= HELD_BODY_BUDGET || oldest === run) break;
    held.delete(oldestKey);
    total -= oldest.bodySize;
  }
}

/** What one step of a run produced, while this realm still holds it. */
export function getWorkflowRunProduct(runId: string, stepId: string): StepProduct | null {
  for (const run of held.values()) {
    if (run.runId === runId) return run.products.get(stepId) ?? null;
  }
  return null;
}

export function __resetWorkflowRunFeedForTests(): void {
  held.clear();
  sink = null;
}
