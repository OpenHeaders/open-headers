/**
 * useTemplateMutator — write-only API for template edits.
 *
 * Thin React adapter over `template-write-client.ts`. Mirrors
 * `useRequestMutator` shape — every memoised callback closes over
 * `(workspaceId, surfaceId)` so a workspace switch produces a fresh
 * function reference and any in-flight envelope still carries the
 * workspace id it was minted under.
 */

import { useCallback, useMemo } from 'react';
import type { V5 } from '@openheaders/core/types';
import {
  applyTemplateCreate,
  applyTemplateDelete,
  applyTemplateUpdate,
  type TemplateMutationResult,
  type TemplateSimpleResult,
  type TemplateUpdates,
} from '@/shared/sync/template-write-client';

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

const NO_WORKSPACE = { ok: false, reason: 'other', message: 'no active workspace' } as const;

export function useTemplateMutator(opts: UseTemplateMutatorOptions): UseTemplateMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const updateTemplate = useCallback<UseTemplateMutatorApi['updateTemplate']>(
    async (templateUid, updates) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyTemplateUpdate(templateUid, updates, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const createTemplate = useCallback<UseTemplateMutatorApi['createTemplate']>(
    async (template) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyTemplateCreate(template, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const deleteTemplate = useCallback<UseTemplateMutatorApi['deleteTemplate']>(
    async (templateUid) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyTemplateDelete(templateUid, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  return useMemo(
    () => ({ updateTemplate, createTemplate, deleteTemplate }),
    [updateTemplate, createTemplate, deleteTemplate],
  );
}
