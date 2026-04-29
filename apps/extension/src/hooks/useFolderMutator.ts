/**
 * useFolderMutator — write-only API for folder edits.
 *
 * Thin React adapter over the imperative helpers in
 * `folder-write-client.ts`. Mirrors `useCollectionMutator`. The
 * `(workspaceId, surfaceId)` pair is captured per-render so a
 * workspace switch produces fresh function references and any
 * in-flight envelope carries the workspace id it was minted under.
 */

import type { FolderParentRef } from '@openheaders/core/sync';
import { useCallback, useMemo } from 'react';
import {
  applyFolderCreate,
  applyFolderDelete,
  applyFolderMove,
  applyFolderRename,
  type FolderSimpleResult,
} from '@/shared/sync/folder-write-client';

export type { FolderSimpleResult };

export interface UseFolderMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseFolderMutatorApi {
  renameFolder(folderUid: string, name: string): Promise<FolderSimpleResult>;
  createFolder(input: {
    folderUid: string;
    parent: FolderParentRef;
    name: string;
    orderKey?: string;
  }): Promise<FolderSimpleResult>;
  deleteFolder(input: {
    folderUid: string;
    parent: FolderParentRef;
  }): Promise<FolderSimpleResult>;
  moveFolder(input: {
    folderUid: string;
    newParent: FolderParentRef;
    orderKey: string;
    oldParent?: FolderParentRef;
  }): Promise<FolderSimpleResult>;
}

const NO_WORKSPACE = { ok: false, reason: 'other', message: 'no active workspace' } as const;

export function useFolderMutator(opts: UseFolderMutatorOptions): UseFolderMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const renameFolder = useCallback<UseFolderMutatorApi['renameFolder']>(
    async (folderUid, name) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyFolderRename({ folderUid, name }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const createFolder = useCallback<UseFolderMutatorApi['createFolder']>(
    async (input) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyFolderCreate(input, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const deleteFolder = useCallback<UseFolderMutatorApi['deleteFolder']>(
    async (input) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyFolderDelete(input, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const moveFolder = useCallback<UseFolderMutatorApi['moveFolder']>(
    async (input) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyFolderMove(input, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  return useMemo(
    () => ({ renameFolder, createFolder, deleteFolder, moveFolder }),
    [renameFolder, createFolder, deleteFolder, moveFolder],
  );
}
