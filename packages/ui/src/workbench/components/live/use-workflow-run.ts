/**
 * The page's kept run of one workflow in the editing scope's workspace —
 * `null` until a run of it was seen on this page — and the run a
 * workflow's view shows: the kept one, or, for a workflow that holds a
 * step of an action the model does not know, the record that says which
 * steps cannot run.
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
import { useMemo, useSyncExternalStore } from 'react';
import { getKeptWorkflowRun, type KeptWorkflowRun, subscribeWorkflowRuns } from '../../data/workflow-run-store';
import { useWorkbenchEditingScopeWorkspaceId } from '../../hooks/EditingScopeWorkspaceContext';

export function useWorkflowRun(workflowUid: string): KeptWorkflowRun | null {
  const workspaceId = useWorkbenchEditingScopeWorkspaceId();
  return useSyncExternalStore(subscribeWorkflowRuns, () =>
    workspaceId === null ? null : getKeptWorkflowRun(workspaceId, workflowUid),
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
