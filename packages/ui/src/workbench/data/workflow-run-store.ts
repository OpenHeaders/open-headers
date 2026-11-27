/**
 * The page's records of each workflow's last runs (the workflow runs
 * plan, The Run view) — kept for this page's life only, at the
 * workbench level so a tab switch or a view switch keeps them.
 *
 * Built from `liveWorkflowRunEvent` frames alone, whoever started the
 * run (a press, a schedule, an agent). A frame carries facts; each
 * step's product is asked for as its settle arrives, while the realm
 * that ran the step still holds it.
 *
 * A run's rows stay for as long as the run is listed. Its products are
 * bounded across every run kept here: past the budget the oldest runs
 * give theirs up first.
 */

import { hostBridge, type LiveWorkflowRunEventWire } from '@openheaders/core/bridge';
import { applyRunFact, createRunProductHold, type StepProduct, type WorkflowRunRecord } from '@openheaders/core/live';

/** Runs kept a workflow, the newest first. */
const KEPT_RUNS_PER_WORKFLOW = 20;

/** Body characters kept across every run kept on this page. */
const KEPT_BODY_BUDGET = 32 * 1024 * 1024;

/** `asked` — on its way; `kept` — here; `gone` — the realm that ran the step no longer had it. */
export type KeptProductState = 'asked' | 'kept' | 'gone';

export interface KeptWorkflowRun {
  record: WorkflowRunRecord;
  /** By step id, for the steps whose settle named a product. */
  products: Readonly<Record<string, KeptProductState>>;
}

const NO_RUNS: readonly KeptWorkflowRun[] = [];

const kept = new Map<string, readonly KeptWorkflowRun[]>();
const hold = createRunProductHold(KEPT_BODY_BUDGET, KEPT_RUNS_PER_WORKFLOW);
const listeners = new Set<() => void>();

function keyOf(workspaceId: string, workflowUid: string): string {
  return `${workspaceId} ${workflowUid}`;
}

function notify(): void {
  for (const listener of listeners) listener();
}

function onFrame(frame: LiveWorkflowRunEventWire): void {
  const key = keyOf(frame.workspaceId, frame.workflowUid);
  const runs = kept.get(key) ?? NO_RUNS;
  const { fact } = frame;
  const before = fact.type === 'begin' ? undefined : runs.find((run) => run.record.runId === frame.runId);
  const record = applyRunFact(before?.record ?? null, frame, fact);
  if (record === null || record === before?.record) return;
  const asks = fact.type === 'step-settle' && fact.hasProduct;
  const run: KeptWorkflowRun = {
    record,
    products: { ...before?.products, ...(asks ? { [fact.stepId]: 'asked' } : {}) },
  };
  if (fact.type === 'begin') {
    hold.open(key, frame.runId);
    const earlier = runs.filter((each) => each.record.runId !== frame.runId);
    kept.set(key, [run, ...earlier].slice(0, KEPT_RUNS_PER_WORKFLOW));
  } else {
    kept.set(
      key,
      runs.map((each) => (each === before ? run : each)),
    );
  }
  notify();
  if (asks) void fetchProduct(key, frame.runId, fact.stepId);
}

async function fetchProduct(key: string, runId: string, stepId: string): Promise<void> {
  const answer = await hostBridge.call('getLiveWorkflowRunProduct', { runId, stepId }).catch(() => null);
  const runs = kept.get(key) ?? NO_RUNS;
  const current = runs.find((run) => run.record.runId === runId);
  if (current === undefined) return;
  const product = answer?.product ?? null;
  if (product !== null) hold.put(key, runId, stepId, product);
  const next: KeptWorkflowRun = {
    ...current,
    products: { ...current.products, [stepId]: product === null ? 'gone' : 'kept' },
  };
  kept.set(
    key,
    runs.map((each) => (each === current ? next : each)),
  );
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

/** The runs of a workflow this page saw, the newest first. */
export function getKeptWorkflowRuns(workspaceId: string, workflowUid: string): readonly KeptWorkflowRun[] {
  return kept.get(keyOf(workspaceId, workflowUid)) ?? NO_RUNS;
}

/** The workflow's latest run on this page. */
export function getKeptWorkflowRun(workspaceId: string, workflowUid: string): KeptWorkflowRun | null {
  return getKeptWorkflowRuns(workspaceId, workflowUid)[0] ?? null;
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
