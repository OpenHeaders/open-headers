/**
 * useRequestFolderMutator — write-only API for request-folder edits.
 *
 * Thin React adapter over `request-folder-write-client.ts`. Mirrors
 * `useFolderMutator`.
 */

import type { RequestFolderParentRef } from '@openheaders/core/sync';
import { useCallback, useMemo } from 'react';
import {
  applyRequestFolderCreate,
  applyRequestFolderDelete,
  applyRequestFolderMove,
  applyRequestFolderRename,
  type RequestFolderSimpleResult,
} from '@/shared/sync/request-folder-write-client';

export type { RequestFolderSimpleResult };

export interface UseRequestFolderMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseRequestFolderMutatorApi {
  renameRequestFolder(folderUid: string, name: string): Promise<RequestFolderSimpleResult>;
  createRequestFolder(input: {
    folderUid: string;
    parent: RequestFolderParentRef;
    name: string;
    orderKey?: string;
  }): Promise<RequestFolderSimpleResult>;
  deleteRequestFolder(input: {
    folderUid: string;
    parent: RequestFolderParentRef;
  }): Promise<RequestFolderSimpleResult>;
  moveRequestFolder(input: {
    folderUid: string;
    newParent: RequestFolderParentRef;
    orderKey: string;
    oldParent?: RequestFolderParentRef;
  }): Promise<RequestFolderSimpleResult>;
}

const NO_WORKSPACE = { ok: false, reason: 'other', message: 'no active workspace' } as const;

export function useRequestFolderMutator(
  opts: UseRequestFolderMutatorOptions,
): UseRequestFolderMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const renameRequestFolder = useCallback<UseRequestFolderMutatorApi['renameRequestFolder']>(
    async (folderUid, name) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyRequestFolderRename({ folderUid, name }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const createRequestFolder = useCallback<UseRequestFolderMutatorApi['createRequestFolder']>(
    async (input) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyRequestFolderCreate(input, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const deleteRequestFolder = useCallback<UseRequestFolderMutatorApi['deleteRequestFolder']>(
    async (input) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyRequestFolderDelete(input, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const moveRequestFolder = useCallback<UseRequestFolderMutatorApi['moveRequestFolder']>(
    async (input) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyRequestFolderMove(input, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  return useMemo(
    () => ({
      renameRequestFolder,
      createRequestFolder,
      deleteRequestFolder,
      moveRequestFolder,
    }),
    [renameRequestFolder, createRequestFolder, deleteRequestFolder, moveRequestFolder],
  );
}
