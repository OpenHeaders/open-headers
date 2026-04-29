/**
 * useTemplateCollectionMutator — write-only API for template-collection
 * edits.
 *
 * Thin React adapter over `template-collection-write-client.ts`.
 */

import { useCallback, useMemo } from 'react';
import {
  applyTemplateCollectionDelete,
  applyTemplateCollectionRename,
  type TemplateCollectionSimpleResult,
} from '@/shared/sync/template-collection-write-client';

export type { TemplateCollectionSimpleResult };

export interface UseTemplateCollectionMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseTemplateCollectionMutatorApi {
  renameTemplateCollection(
    collectionUid: string,
    name: string,
  ): Promise<TemplateCollectionSimpleResult>;
  deleteTemplateCollection(collectionUid: string): Promise<TemplateCollectionSimpleResult>;
}

const NO_WORKSPACE = { ok: false, reason: 'other', message: 'no active workspace' } as const;

export function useTemplateCollectionMutator(
  opts: UseTemplateCollectionMutatorOptions,
): UseTemplateCollectionMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const renameTemplateCollection = useCallback<
    UseTemplateCollectionMutatorApi['renameTemplateCollection']
  >(
    async (collectionUid, name) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyTemplateCollectionRename({ collectionUid, name }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const deleteTemplateCollection = useCallback<
    UseTemplateCollectionMutatorApi['deleteTemplateCollection']
  >(
    async (collectionUid) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyTemplateCollectionDelete({ collectionUid }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  return useMemo(
    () => ({ renameTemplateCollection, deleteTemplateCollection }),
    [renameTemplateCollection, deleteTemplateCollection],
  );
}
