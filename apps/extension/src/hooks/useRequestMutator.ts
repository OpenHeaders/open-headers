/**
 * useRequestMutator — write-only API for request edits.
 *
 * Thin React adapter over {@link applyRequestUpdate} /
 * {@link applyRequestCreate} / {@link applyRequestDelete}. Owns no
 * React state of its own — every memoised callback closes over the
 * `(workspaceId, surfaceId)` pair so a workspace switch produces a
 * fresh function reference and any in-flight envelope still carries
 * the workspace id it was minted under.
 *
 * Sync engine §24 retired the `version` counter + stale-draft contract.
 * Concurrent edits reconcile per-field via HLC LWW; the result
 * discriminator collapses to `{ ok: true } | { ok: false; reason }`.
 */

import { useCallback, useMemo } from 'react';
import type { V5 } from '@openheaders/core/types';
import {
  applyRequestCreate,
  applyRequestDelete,
  applyRequestUpdate,
  type RequestMutationResult,
  type RequestSimpleResult,
  type RequestUpdates,
} from '@/shared/sync/request-write-client';

export type { RequestMutationResult, RequestSimpleResult, RequestUpdates };

export interface UseRequestMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseRequestMutatorApi {
  updateRequest(requestUid: string, updates: RequestUpdates): Promise<RequestMutationResult>;
  createRequest(request: V5.Request): Promise<RequestSimpleResult>;
  deleteRequest(requestUid: string): Promise<RequestSimpleResult>;
}

const NO_WORKSPACE = { ok: false, reason: 'other', message: 'no active workspace' } as const;

export function useRequestMutator(opts: UseRequestMutatorOptions): UseRequestMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const updateRequest = useCallback<UseRequestMutatorApi['updateRequest']>(
    async (requestUid, updates) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyRequestUpdate(requestUid, updates, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const createRequest = useCallback<UseRequestMutatorApi['createRequest']>(
    async (request) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyRequestCreate(request, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const deleteRequest = useCallback<UseRequestMutatorApi['deleteRequest']>(
    async (requestUid) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyRequestDelete(requestUid, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  return useMemo(
    () => ({ updateRequest, createRequest, deleteRequest }),
    [updateRequest, createRequest, deleteRequest],
  );
}
