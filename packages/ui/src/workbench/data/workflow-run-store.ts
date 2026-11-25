/**
 * The page's record of each workflow's last run (the workflow runs
 * plan, The Run view) — kept for this page's life only, at the
 * workbench level so a tab switch or a view switch keeps it.
 *
 * Built from `liveWorkflowRunEvent` frames alone, whoever started the
 * run (a press, a schedule, an agent). A frame carries facts; each
 * step's product is asked for as its settle arrives, while the realm
 * that ran the step still holds it.
 */

import { hostBridge, type LiveWorkflowRunEventWire } from '@openheaders/core/bridge';
import { applyRunFact, createRunProductHold, type StepProduct, type WorkflowRunRecord } from '@openheaders/core/live';

/** Body characters kept across every workflow's last run on this page. */
const KEPT_BODY_BUDGET = 32 * 1024 * 1024;

/** `asked` — on its way; `kept` — here; `gone` — the realm that ran the step no longer had it. */
export type KeptProductState = 'asked' | 'kept' | 'gone';

export interface KeptWorkflowRun {
  record: WorkflowRunRecord;
  /** By step id, for the steps whose settle named a product. */
  products: Readonly<Record<string, KeptProductState>>;
}

const kept = new Map<string, KeptWorkflowRun>();
const hold = createRunProductHold(KEPT_BODY_BUDGET);
const listeners = new Set<() => void>();

function keyOf(workspaceId: string, workflowUid: string): string {
  return `${workspaceId} ${workflowUid}`;
}

function notify(): void {
  for (const listener of listeners) listener();
}

function onFrame(frame: LiveWorkflowRunEventWire): void {
  const key = keyOf(frame.workspaceId, frame.workflowUid);
  const before = kept.get(key);
  const record = applyRunFact(before?.record ?? null, frame, frame.fact);
  if (record === null || record === before?.record) return;
  const { fact } = frame;
  if (fact.type === 'begin') hold.open(key, frame.runId);
  const asks = fact.type === 'step-settle' && fact.hasProduct;
  kept.set(key, {
    record,
    products: {
      ...(fact.type === 'begin' ? {} : before?.products),
      ...(asks ? { [fact.stepId]: 'asked' } : {}),
    },
  });
  notify();
  if (asks) void fetchProduct(key, frame.runId, fact.stepId);
}

async function fetchProduct(key: string, runId: string, stepId: string): Promise<void> {
  const answer = await hostBridge.call('getLiveWorkflowRunProduct', { runId, stepId }).catch(() => null);
  const current = kept.get(key);
  if (current === undefined || current.record.runId !== runId) return;
  const product = answer?.product ?? null;
  if (product !== null) hold.put(key, runId, stepId, product);
  kept.set(key, { ...current, products: { ...current.products, [stepId]: product === null ? 'gone' : 'kept' } });
  notify();
}

/** Start keeping runs on this page. Returns the stop. */
export function installWorkflowRunStore(): () => void {
  return hostBridge.subscribe('liveWorkflowRunEvent', onFrame);
}

export function subscribeWorkflowRuns(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getKeptWorkflowRun(workspaceId: string, workflowUid: string): KeptWorkflowRun | null {
  return kept.get(keyOf(workspaceId, workflowUid)) ?? null;
}

/** A kept step's product — `null` once the page's budget gave it up to newer runs. */
export function readKeptRunProduct(runId: string, stepId: string): StepProduct | null {
  return hold.get(runId, stepId);
}

export function __resetWorkflowRunStoreForTests(): void {
  kept.clear();
  hold.clear();
  listeners.clear();
}
