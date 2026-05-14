/**
 * useRequestFolderMutator — write-only API for request-folder edits.
 *
 * Thin React adapter over `request-folder-write-client.ts`.
 */

import type { RequestFolderParentRef } from '@openheaders/core/sync';
import { useMemo } from 'react';
import {
  applyRequestFolderCreate,
  applyRequestFolderDelete,
  applyRequestFolderMove,
  applyRequestFolderRename,
  type RequestFolderSimpleResult,
} from '@/shared/sync/request-folder-write-client';
import { useGuardedMutation } from './use-guarded-mutation';

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

export function useRequestFolderMutator(
  opts: UseRequestFolderMutatorOptions,
): UseRequestFolderMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const renameRequestFolder = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, folderUid: string, name: string) =>
      applyRequestFolderRename({ folderUid, name }, writeOpts),
  );

  const createRequestFolder = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, input: Parameters<UseRequestFolderMutatorApi['createRequestFolder']>[0]) =>
      applyRequestFolderCreate(input, writeOpts),
  );

  const deleteRequestFolder = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, input: Parameters<UseRequestFolderMutatorApi['deleteRequestFolder']>[0]) =>
      applyRequestFolderDelete(input, writeOpts),
  );

  const moveRequestFolder = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, input: Parameters<UseRequestFolderMutatorApi['moveRequestFolder']>[0]) =>
      applyRequestFolderMove(input, writeOpts),
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
