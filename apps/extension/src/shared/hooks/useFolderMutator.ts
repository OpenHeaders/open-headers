/**
 * useFolderMutator — write-only API for folder edits.
 *
 * Thin React adapter over `folder-write-client.ts`.
 */

import type { FolderParentRef } from '@openheaders/core/sync';
import { useMemo } from 'react';
import {
  applyFolderCreate,
  applyFolderDelete,
  applyFolderMove,
  applyFolderRename,
  type FolderSimpleResult,
} from '@openheaders/ui/shared/sync/folder-write-client';
import { useGuardedMutation } from './use-guarded-mutation';

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

export function useFolderMutator(opts: UseFolderMutatorOptions): UseFolderMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const renameFolder = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, folderUid: string, name: string) =>
      applyFolderRename({ folderUid, name }, writeOpts),
  );

  const createFolder = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, input: Parameters<UseFolderMutatorApi['createFolder']>[0]) =>
      applyFolderCreate(input, writeOpts),
  );

  const deleteFolder = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, input: Parameters<UseFolderMutatorApi['deleteFolder']>[0]) =>
      applyFolderDelete(input, writeOpts),
  );

  const moveFolder = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, input: Parameters<UseFolderMutatorApi['moveFolder']>[0]) =>
      applyFolderMove(input, writeOpts),
  );

  return useMemo(
    () => ({ renameFolder, createFolder, deleteFolder, moveFolder }),
    [renameFolder, createFolder, deleteFolder, moveFolder],
  );
}
