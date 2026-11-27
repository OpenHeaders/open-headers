/**
 * The page's kept runs of one workflow in the editing scope's workspace —
 * its latest, `null` until a run of it was seen on this page, and the
 * list its History shows — and the run a workflow's view shows: the
 * latest kept one, or, for a workflow that holds a step of an action the
 * model does not know, the record that says which steps cannot run; and,
 * over either, a run picked from the History until a newer one begins.
 */

import {
  applyRunFact,
  isKnownStep,
  isUnknownStep,
  runFactOf,
  runRefusalEvents,
  unknownStepMessage,
  type WorkflowRunRecord,
} from '@openheaders/core/live';
import type { LiveWorkflow } from '@openheaders/core/types';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import {
  getKeptWorkflowRun,
  getKeptWorkflowRuns,
  type KeptWorkflowRun,
  subscribeWorkflowRuns,
} from '../../data/workflow-run-store';
import { useWorkbenchEditingScopeWorkspaceId } from '../../hooks/EditingScopeWorkspaceContext';

const NO_RUNS: readonly KeptWorkflowRun[] = [];

export function useWorkflowRun(workflowUid: string): KeptWorkflowRun | null {
  const workspaceId = useWorkbenchEditingScopeWorkspaceId();
  return useSyncExternalStore(subscribeWorkflowRuns, () =>
    workspaceId === null ? null : getKeptWorkflowRun(workspaceId, workflowUid),
  );
}

/** The runs of one workflow this page saw, the newest first. */
export function useWorkflowRuns(workflowUid: string): readonly KeptWorkflowRun[] {
  const workspaceId = useWorkbenchEditingScopeWorkspaceId();
  return useSyncExternalStore(subscribeWorkflowRuns, () =>
    workspaceId === null ? NO_RUNS : getKeptWorkflowRuns(workspaceId, workflowUid),
  );
}

export interface ShownWorkflowRun {
  record: WorkflowRunRecord;
  /** The record stands for a run that was refused before it began: no step has a product. */
  refused: boolean;
  /** By step id, for the steps whose settle named a product. */
  products: KeptWorkflowRun['products'];
}

/** What a needs-update workflow shows in place of a run: no step ran, and the steps of an action the model does not know say why. */
function refusedRecord(workflow: LiveWorkflow): WorkflowRunRecord | null {
  const refusals = workflow.steps
    .filter(isUnknownStep)
    .filter((step) => !isKnownStep(step))
    .map((step) => ({ stepId: step.id, reason: unknownStepMessage(step) }));
  return runRefusalEvents(workflow, 0, refusals)
    .map(runFactOf)
    .reduce<WorkflowRunRecord | null>(
      (record, fact) => applyRunFact(record, { runId: '', environmentId: null }, fact),
      null,
    );
}

/** `workflow` is `null` while the editor has none to show: so is the run. */
export function useShownWorkflowRun(workflow: LiveWorkflow | null, needsUpdate: boolean): ShownWorkflowRun | null {
  const kept = useWorkflowRun(workflow?.uid ?? '');
  const refused = useMemo(
    () => (needsUpdate && workflow !== null ? refusedRecord(workflow) : null),
    [needsUpdate, workflow],
  );
  return useMemo(() => {
    if (refused !== null) return { record: refused, refused: true, products: {} };
    if (kept === null) return null;
    return { record: kept.record, refused: false, products: kept.products };
  }, [refused, kept]);
}

/** A run picked from the History, with the newest kept run of that moment: a newer one ends the pick. */
interface RunPick {
  runId: string;
  newestRunId: string | undefined;
}

export interface WorkflowRunPick {
  /** The run the view draws: the picked one while the pick holds, the latest otherwise. */
  run: ShownWorkflowRun | null | undefined;
  /** The picked run's record — `null` while the view draws the latest. */
  picked: WorkflowRunRecord | null;
  pick: (runId: string) => void;
  backToLatest: () => void;
}

/**
 * The run a view draws once its History lets one be picked. `runs` are
 * the workflow's kept runs, the newest first; `latest` is what the view
 * shows with none picked.
 */
export function useWorkflowRunPick(
  runs: readonly KeptWorkflowRun[],
  latest: ShownWorkflowRun | null | undefined,
): WorkflowRunPick {
  const [held, setHeld] = useState<RunPick | null>(null);
  const newestRunId = runs[0]?.record.runId;
  const latestRunId = latest != null && !latest.refused ? latest.record.runId : null;
  const kept =
    held !== null && held.newestRunId === newestRunId ? runs.find((run) => run.record.runId === held.runId) : undefined;
  const picked = useMemo<ShownWorkflowRun | null>(
    () => (kept === undefined ? null : { record: kept.record, refused: false, products: kept.products }),
    [kept],
  );
  const pick = useCallback(
    (runId: string) => setHeld(runId === latestRunId ? null : { runId, newestRunId }),
    [latestRunId, newestRunId],
  );
  const backToLatest = useCallback(() => setHeld(null), []);
  return { run: picked ?? latest, picked: picked?.record ?? null, pick, backToLatest };
}
