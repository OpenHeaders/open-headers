/**
 * useTemplateCollectionMutator — write-only API for template-collection
 * edits.
 *
 * Thin React adapter over `template-collection-write-client.ts`.
 */

import { useMemo } from 'react';
import {
  applyTemplateCollectionDelete,
  applyTemplateCollectionRename,
  type TemplateCollectionSimpleResult,
} from '@openheaders/ui/shared/sync/template-collection-write-client';
import { useGuardedMutation } from './use-guarded-mutation';

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

export function useTemplateCollectionMutator(
  opts: UseTemplateCollectionMutatorOptions,
): UseTemplateCollectionMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const renameTemplateCollection = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, collectionUid: string, name: string) =>
      applyTemplateCollectionRename({ collectionUid, name }, writeOpts),
  );

  const deleteTemplateCollection = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, collectionUid: string) =>
      applyTemplateCollectionDelete({ collectionUid }, writeOpts),
  );

  return useMemo(
    () => ({ renameTemplateCollection, deleteTemplateCollection }),
    [renameTemplateCollection, deleteTemplateCollection],
  );
}
