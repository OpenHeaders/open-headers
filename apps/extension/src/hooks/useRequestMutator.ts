/**
 * useRequestMutator — write-only API for request edits.
 *
 * Thin React adapter over `request-write-client.ts`.
 *
 * Sync engine §24 retired the `version` counter + stale-draft contract.
 * Concurrent edits reconcile per-field via HLC LWW; the result
 * discriminator collapses to `{ ok: true } | { ok: false; reason }`.
 */

import { useMemo } from 'react';
import type { Request } from '@openheaders/core/types';
import {
  applyRequestCreate,
  applyRequestDelete,
  applyRequestUpdate,
  type RequestMutationResult,
  type RequestSimpleResult,
  type RequestUpdates,
} from '@/shared/sync/request-write-client';
import { useGuardedMutation } from './use-guarded-mutation';

export type { RequestMutationResult, RequestSimpleResult, RequestUpdates };

export interface UseRequestMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseRequestMutatorApi {
  updateRequest(requestUid: string, updates: RequestUpdates): Promise<RequestMutationResult>;
  createRequest(request: Request): Promise<RequestSimpleResult>;
  deleteRequest(requestUid: string): Promise<RequestSimpleResult>;
}

export function useRequestMutator(opts: UseRequestMutatorOptions): UseRequestMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const updateRequest = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, requestUid: string, updates: RequestUpdates) =>
      applyRequestUpdate(requestUid, updates, writeOpts),
  );

  const createRequest = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, request: Request) => applyRequestCreate(request, writeOpts),
  );

  const deleteRequest = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, requestUid: string) => applyRequestDelete(requestUid, writeOpts),
  );

  return useMemo(
    () => ({ updateRequest, createRequest, deleteRequest }),
    [updateRequest, createRequest, deleteRequest],
  );
}
