/**
 * Conflict-tracker binding for V5.LiveWorkflow. Pins entityType +
 * adapter for the entity-agnostic `useEntityConflicts`.
 */

import type { V5 } from '@openheaders/core/types';
import {
  type EntityConflictsApi,
  useEntityConflicts,
} from '@/shared/conflicts/use-entity-conflicts';
import { liveWorkflowConflictAdapter } from './live-workflow-conflict-adapter';

export interface UseLiveWorkflowConflictsArgs {
  liveEntity: V5.LiveWorkflow | null | undefined;
  isDirty: boolean;
  enabled: boolean;
  /** `LIVE_WORKFLOW_ENTITY_TYPE` from `@openheaders/core/sync`. */
  entityType: string;
}

export function useLiveWorkflowConflicts(
  args: UseLiveWorkflowConflictsArgs,
): EntityConflictsApi<V5.LiveWorkflow> {
  return useEntityConflicts<V5.LiveWorkflow>({
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
  refresh: V5.LiveWorkflow['refresh'];
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
  return out;
}
