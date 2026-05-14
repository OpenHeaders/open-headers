/**
 * useTemplateFolderMutator — write-only API for template-folder edits.
 *
 * Thin React adapter over `template-folder-write-client.ts`.
 */

import type { TemplateFolderParentRef } from '@openheaders/core/sync';
import { useMemo } from 'react';
import {
  applyTemplateFolderCreate,
  applyTemplateFolderDelete,
  applyTemplateFolderMove,
  applyTemplateFolderRename,
  type TemplateFolderSimpleResult,
} from '@/shared/sync/template-folder-write-client';
import { useGuardedMutation } from './use-guarded-mutation';

export type { TemplateFolderSimpleResult };

export interface UseTemplateFolderMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseTemplateFolderMutatorApi {
  renameTemplateFolder(folderUid: string, name: string): Promise<TemplateFolderSimpleResult>;
  createTemplateFolder(input: {
    folderUid: string;
    parent: TemplateFolderParentRef;
    name: string;
    pathSegment?: string;
    orderKey?: string;
  }): Promise<TemplateFolderSimpleResult>;
  deleteTemplateFolder(input: {
    folderUid: string;
    parent: TemplateFolderParentRef;
  }): Promise<TemplateFolderSimpleResult>;
  moveTemplateFolder(input: {
    folderUid: string;
    newParent: TemplateFolderParentRef;
    orderKey: string;
    oldParent?: TemplateFolderParentRef;
  }): Promise<TemplateFolderSimpleResult>;
}

export function useTemplateFolderMutator(
  opts: UseTemplateFolderMutatorOptions,
): UseTemplateFolderMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const renameTemplateFolder = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, folderUid: string, name: string) =>
      applyTemplateFolderRename({ folderUid, name }, writeOpts),
  );

  const createTemplateFolder = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, input: Parameters<UseTemplateFolderMutatorApi['createTemplateFolder']>[0]) =>
      applyTemplateFolderCreate(input, writeOpts),
  );

  const deleteTemplateFolder = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, input: Parameters<UseTemplateFolderMutatorApi['deleteTemplateFolder']>[0]) =>
      applyTemplateFolderDelete(input, writeOpts),
  );

  const moveTemplateFolder = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, input: Parameters<UseTemplateFolderMutatorApi['moveTemplateFolder']>[0]) =>
      applyTemplateFolderMove(input, writeOpts),
  );

  return useMemo(
    () => ({
      renameTemplateFolder,
      createTemplateFolder,
      deleteTemplateFolder,
      moveTemplateFolder,
    }),
    [renameTemplateFolder, createTemplateFolder, deleteTemplateFolder, moveTemplateFolder],
  );
}
