/**
 * Conflict-tracker binding for LiveWorkflow. Pins entityType +
 * adapter for the entity-agnostic `useEntityConflicts`.
 */

import type { LiveWorkflow, WorkflowStep } from '@openheaders/core/types';
import {
  type EntityConflictsApi,
  useEntityConflicts,
} from '@openheaders/ui/shared/conflicts/use-entity-conflicts';
import { liveWorkflowConflictAdapter } from './live-workflow-conflict-adapter';

export interface UseLiveWorkflowConflictsArgs {
  liveEntity: LiveWorkflow | null | undefined;
  isDirty: boolean;
  enabled: boolean;
  /** `LIVE_WORKFLOW_ENTITY_TYPE` from `@openheaders/core/sync`. */
  entityType: string;
}

export function useLiveWorkflowConflicts(
  args: UseLiveWorkflowConflictsArgs,
): EntityConflictsApi<LiveWorkflow> {
  return useEntityConflicts<LiveWorkflow>({
    liveEntity: args.liveEntity ?? null,
    isDirty: args.isDirty,
    enabled: args.enabled,
    entityType: args.entityType,
    adapter: liveWorkflowConflictAdapter,
  });
}

export interface LiveWorkflowFormProjectionInput {
  name: string;
  description: string;
  enabled: boolean;
  refresh: LiveWorkflow['refresh'];
  /**
   * Steps the user is currently editing. Required so the conflict
   * tracker's per-leaf path comparisons cover step + capture edits;
   * without this, baseline emits `steps.<uid>.id` paths that the
   * form's projection doesn't, and the tracker silently falls back
   * to baseline for the local value (peer-only changes never surface
   * as auto-merge targets, edit-vs-edit conflicts stay invisible).
   * Must mirror the adapter's `extractBaseline` shape.
   */
  steps?: readonly WorkflowStep[];
}

function opaqueStringify(value: unknown): string {
  if (value === undefined || value === null) return '';
  return JSON.stringify(value);
}

export function projectLiveWorkflowToForm(d: LiveWorkflowFormProjectionInput): Record<string, string> {
  const out: Record<string, string> = {
    name: d.name ?? '',
    description: d.description ?? '',
    enabled: d.enabled ? 'true' : 'false',
    'refresh.kind': d.refresh.kind,
  };
  switch (d.refresh.kind) {
    case 'interval':
      out['refresh.seconds'] = String(d.refresh.seconds);
      break;
    case 'expires-in':
    case 'expires-at':
      out['refresh.stepId'] = d.refresh.stepId;
      out['refresh.captureName'] = d.refresh.captureName;
      out['refresh.leadSeconds'] = String(d.refresh.leadSeconds);
      break;
    case 'manual':
      break;
  }
  for (const step of d.steps ?? []) {
    const sp = `steps.${step.uid}`;
    out[`${sp}.id`] = step.id;
    out[`${sp}.description`] = step.description ?? '';
    out[`${sp}.requestUid`] = step.requestUid;
    out[`${sp}.dependsOn`] = opaqueStringify(step.dependsOn ?? []);
    out[`${sp}.runIf`] = opaqueStringify(step.runIf);
    out[`${sp}.priorityFrom`] = opaqueStringify(step.priorityFrom);
    for (const capture of step.captures) {
      const cp = `${sp}.captures.${capture.uid}`;
      out[`${cp}.name`] = capture.name;
      out[`${cp}.extractor`] = opaqueStringify(capture.extractor);
    }
  }
  return out;
}
