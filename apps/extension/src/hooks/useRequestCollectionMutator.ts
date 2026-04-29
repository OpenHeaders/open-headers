/**
 * useRequestCollectionMutator — write-only API for request-collection
 * edits.
 *
 * Thin React adapter over `request-collection-write-client.ts`. Catalog
 * ships rename + delete at v1; create still flows through the SW seam
 * (`createLocalRequestCollection` bridge dispatch → `request-store`)
 * because there's no renderer-direct create gesture surfaced today.
 */

import { useCallback, useMemo } from 'react';
import {
  applyRequestCollectionDelete,
  applyRequestCollectionRename,
  type RequestCollectionSimpleResult,
} from '@/shared/sync/request-collection-write-client';

export type { RequestCollectionSimpleResult };

export interface UseRequestCollectionMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseRequestCollectionMutatorApi {
  renameRequestCollection(
    collectionUid: string,
    name: string,
  ): Promise<RequestCollectionSimpleResult>;
  deleteRequestCollection(collectionUid: string): Promise<RequestCollectionSimpleResult>;
}

const NO_WORKSPACE = { ok: false, reason: 'other', message: 'no active workspace' } as const;

export function useRequestCollectionMutator(
  opts: UseRequestCollectionMutatorOptions,
): UseRequestCollectionMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const renameRequestCollection = useCallback<
    UseRequestCollectionMutatorApi['renameRequestCollection']
  >(
    async (collectionUid, name) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyRequestCollectionRename({ collectionUid, name }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const deleteRequestCollection = useCallback<
    UseRequestCollectionMutatorApi['deleteRequestCollection']
  >(
    async (collectionUid) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyRequestCollectionDelete({ collectionUid }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  return useMemo(
    () => ({ renameRequestCollection, deleteRequestCollection }),
    [renameRequestCollection, deleteRequestCollection],
  );
}
