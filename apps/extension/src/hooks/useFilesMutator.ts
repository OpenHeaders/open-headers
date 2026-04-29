/**
 * useFilesMutator — write-only API for FileRef catalog edits.
 *
 * Thin React adapter over the imperative helpers in
 * `files-write-client.ts`. Mirrors `usePauseMarkersMutator`. Every
 * memoised callback closes over the `(workspaceId, surfaceId)` pair so
 * a workspace switch produces fresh function references and any
 * in-flight envelope carries the workspace id it was minted under.
 *
 * **Bytes are not handled here** — uploads still go through the
 * existing `putFile` RPC. These hooks govern catalog metadata only.
 */

import type { FileRefSlot } from '@openheaders/core/sync';
import { useCallback, useMemo } from 'react';
import {
  applyFileAdd,
  applyFileRemove,
  type FilesResult,
} from '@/shared/sync/files-write-client';

export type { FilesResult };

export interface UseFilesMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseFilesMutatorApi {
  addFileRef(ref: FileRefSlot): Promise<FilesResult>;
  removeFileRef(fileId: string): Promise<FilesResult>;
}

const NO_WORKSPACE = { ok: false, reason: 'other', message: 'no active workspace' } as const;

export function useFilesMutator(opts: UseFilesMutatorOptions): UseFilesMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const addFileRef = useCallback<UseFilesMutatorApi['addFileRef']>(
    async (ref) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyFileAdd({ ref }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const removeFileRef = useCallback<UseFilesMutatorApi['removeFileRef']>(
    async (fileId) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyFileRemove({ fileId }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  return useMemo(() => ({ addFileRef, removeFileRef }), [addFileRef, removeFileRef]);
}
