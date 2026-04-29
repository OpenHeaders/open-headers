/**
 * useTemplateFolderMutator — write-only API for template-folder edits.
 *
 * Thin React adapter over `template-folder-write-client.ts`. Mirrors
 * `useRequestFolderMutator`.
 */

import type { TemplateFolderParentRef } from '@openheaders/core/sync';
import { useCallback, useMemo } from 'react';
import {
  applyTemplateFolderCreate,
  applyTemplateFolderDelete,
  applyTemplateFolderMove,
  applyTemplateFolderRename,
  type TemplateFolderSimpleResult,
} from '@/shared/sync/template-folder-write-client';

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

const NO_WORKSPACE = { ok: false, reason: 'other', message: 'no active workspace' } as const;

export function useTemplateFolderMutator(
  opts: UseTemplateFolderMutatorOptions,
): UseTemplateFolderMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const renameTemplateFolder = useCallback<UseTemplateFolderMutatorApi['renameTemplateFolder']>(
    async (folderUid, name) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyTemplateFolderRename({ folderUid, name }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const createTemplateFolder = useCallback<UseTemplateFolderMutatorApi['createTemplateFolder']>(
    async (input) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyTemplateFolderCreate(input, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const deleteTemplateFolder = useCallback<UseTemplateFolderMutatorApi['deleteTemplateFolder']>(
    async (input) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyTemplateFolderDelete(input, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const moveTemplateFolder = useCallback<UseTemplateFolderMutatorApi['moveTemplateFolder']>(
    async (input) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyTemplateFolderMove(input, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
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
