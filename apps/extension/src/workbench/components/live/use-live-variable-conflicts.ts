/**
 * Conflict-tracker binding for LiveVariable. Mirrors
 * `use-variable-conflicts.ts` — thin wrapper that pins entityType +
 * adapter for the entity-agnostic `useEntityConflicts`.
 */

import type { LiveVariable } from '@openheaders/core/types';
import {
  type EntityConflictsApi,
  useEntityConflicts,
} from '@/shared/conflicts/use-entity-conflicts';
import { LIVE_VARIABLE_FIELD } from '@/shared/awareness';
import { liveVariableConflictAdapter } from './live-variable-conflict-adapter';

export interface UseLiveVariableConflictsArgs {
  liveEntity: LiveVariable | null | undefined;
  isDirty: boolean;
  enabled: boolean;
  /** `LIVE_VARIABLE_ENTITY_TYPE` from `@openheaders/core/sync`. */
  entityType: string;
}

export function useLiveVariableConflicts(
  args: UseLiveVariableConflictsArgs,
): EntityConflictsApi<LiveVariable> {
  return useEntityConflicts<LiveVariable>({
    liveEntity: args.liveEntity ?? null,
    isDirty: args.isDirty,
    enabled: args.enabled,
    entityType: args.entityType,
    adapter: liveVariableConflictAdapter,
  });
}

export interface LiveVariableFormProjection {
  name: string;
  description: string;
  enabled: boolean;
  requireFreshOnRuleBuild: boolean;
  workflowUid: string;
  stepId: string;
  captureName: string;
}

export function projectLiveVariableToForm(d: LiveVariableFormProjection): Record<string, string> {
  return {
    [LIVE_VARIABLE_FIELD.name]: String(d.name ?? ''),
    [LIVE_VARIABLE_FIELD.description]: String(d.description ?? ''),
    [LIVE_VARIABLE_FIELD.enabled]: d.enabled ? 'true' : 'false',
    [LIVE_VARIABLE_FIELD.requireFreshOnRuleBuild]: d.requireFreshOnRuleBuild ? 'true' : 'false',
    [LIVE_VARIABLE_FIELD.workflowUid]: String(d.workflowUid ?? ''),
    [LIVE_VARIABLE_FIELD.stepId]: String(d.stepId ?? ''),
    [LIVE_VARIABLE_FIELD.captureName]: String(d.captureName ?? ''),
  };
}
