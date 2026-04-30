/**
 * useTemplateMutator — write-only API for template edits.
 *
 * Thin React adapter over `template-write-client.ts`.
 */

import { useMemo } from 'react';
import type { V5 } from '@openheaders/core/types';
import {
  applyTemplateCreate,
  applyTemplateDelete,
  applyTemplateUpdate,
  type TemplateMutationResult,
  type TemplateSimpleResult,
  type TemplateUpdates,
} from '@/shared/sync/template-write-client';
import { useGuardedMutation } from './use-guarded-mutation';

export type { TemplateMutationResult, TemplateSimpleResult, TemplateUpdates };

export interface UseTemplateMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseTemplateMutatorApi {
  updateTemplate(templateUid: string, updates: TemplateUpdates): Promise<TemplateMutationResult>;
  createTemplate(template: V5.Template): Promise<TemplateSimpleResult>;
  deleteTemplate(templateUid: string): Promise<TemplateSimpleResult>;
}

export function useTemplateMutator(opts: UseTemplateMutatorOptions): UseTemplateMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const updateTemplate = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, templateUid: string, updates: TemplateUpdates) =>
      applyTemplateUpdate(templateUid, updates, writeOpts),
  );

  const createTemplate = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, template: V5.Template) => applyTemplateCreate(template, writeOpts),
  );

  const deleteTemplate = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, templateUid: string) => applyTemplateDelete(templateUid, writeOpts),
  );

  return useMemo(
    () => ({ updateTemplate, createTemplate, deleteTemplate }),
    [updateTemplate, createTemplate, deleteTemplate],
  );
}
