/**
 * Thin template-bound binding around the generic `useEntityConflicts`
 * hook. Mirrors `rule-fields/use-rule-conflicts.ts` — same shape, swap
 * adapter + entity type.
 */

import { TEMPLATE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { Template } from '@openheaders/core/types';
import { type EntityConflictsApi, useEntityConflicts } from '@/shared/conflicts/use-entity-conflicts';
import { templateConflictAdapter } from './template-conflict-adapter';

export interface UseTemplateConflictsArgs {
  liveTemplate: Template | null | undefined;
  isDirty: boolean;
  enabled: boolean;
}

export function useTemplateConflicts(args: UseTemplateConflictsArgs): EntityConflictsApi<Template> {
  return useEntityConflicts<Template>({
    liveEntity: args.liveTemplate,
    isDirty: args.isDirty,
    enabled: args.enabled,
    entityType: TEMPLATE_ENTITY_TYPE,
    adapter: templateConflictAdapter,
  });
}
