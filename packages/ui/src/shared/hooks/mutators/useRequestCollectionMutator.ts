/**
 * useRequestCollectionMutator — write-only API for request-collection
 * edits.
 *
 * Thin React adapter over `request-collection-write-client.ts`. Catalog
 * ships rename + delete at v1; create still flows through the SW seam
 * (`createLocalRequestCollection` bridge dispatch → `request-store`)
 * because there's no renderer-direct create gesture surfaced today.
 */

import { useMemo } from 'react';
import {
  applyRequestCollectionDelete,
  applyRequestCollectionRename,
  type RequestCollectionSimpleResult,
} from '@openheaders/ui/shared/sync/request-collection-write-client';
import { useGuardedMutation } from './use-guarded-mutation';

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

export function useRequestCollectionMutator(
  opts: UseRequestCollectionMutatorOptions,
): UseRequestCollectionMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const renameRequestCollection = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, collectionUid: string, name: string) =>
      applyRequestCollectionRename({ collectionUid, name }, writeOpts),
  );

  const deleteRequestCollection = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, collectionUid: string) =>
      applyRequestCollectionDelete({ collectionUid }, writeOpts),
  );

  return useMemo(
    () => ({ renameRequestCollection, deleteRequestCollection }),
    [renameRequestCollection, deleteRequestCollection],
  );
}
