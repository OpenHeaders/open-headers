/**
 * useFilesMutator — write-only API for FileRef catalog edits.
 *
 * Thin React adapter over `files-write-client.ts`. **Bytes are not
 * handled here** — uploads still go through the existing `putFile`
 * RPC. These hooks govern catalog metadata only.
 */

import type { FileRefSlot } from '@openheaders/core/sync';
import { useMemo } from 'react';
import {
  applyFileAdd,
  applyFileRemove,
  type FilesResult,
} from '@/shared/sync/files-write-client';
import { useGuardedMutation } from './use-guarded-mutation';

export type { FilesResult };

export interface UseFilesMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseFilesMutatorApi {
  addFileRef(ref: FileRefSlot): Promise<FilesResult>;
  removeFileRef(fileId: string): Promise<FilesResult>;
}

export function useFilesMutator(opts: UseFilesMutatorOptions): UseFilesMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const addFileRef = useGuardedMutation(workspaceId, surfaceId, (writeOpts, ref: FileRefSlot) =>
    applyFileAdd({ ref }, writeOpts),
  );

  const removeFileRef = useGuardedMutation(workspaceId, surfaceId, (writeOpts, fileId: string) =>
    applyFileRemove({ fileId }, writeOpts),
  );

  return useMemo(() => ({ addFileRef, removeFileRef }), [addFileRef, removeFileRef]);
}
