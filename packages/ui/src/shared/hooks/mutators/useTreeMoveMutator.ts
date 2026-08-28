/**
 * useTreeMoveMutator — write-only API for the sidebar's tree moves
 * (leaves of every kind, collections). Thin React adapter over
 * `tree-move-write-client.ts`; folder moves stay on their per-tree
 * mutators.
 */

import type { SyncSimpleResult } from '@openheaders/ui/shared/sync/apply-payload';
import {
  type ApplyTreeCollectionMoveInput,
  type ApplyTreeLeafMoveInput,
  applyTreeCollectionMove,
  applyTreeLeafMove,
} from '@openheaders/ui/shared/sync/tree-move-write-client';
import { useMemo } from 'react';
import { useGuardedMutation } from './use-guarded-mutation';

export interface UseTreeMoveMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseTreeMoveMutatorApi {
  moveLeaf(input: ApplyTreeLeafMoveInput): Promise<SyncSimpleResult>;
  moveCollection(input: ApplyTreeCollectionMoveInput): Promise<SyncSimpleResult>;
}

export function useTreeMoveMutator(opts: UseTreeMoveMutatorOptions): UseTreeMoveMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const moveLeaf = useGuardedMutation(workspaceId, surfaceId, (writeOpts, input: ApplyTreeLeafMoveInput) =>
    applyTreeLeafMove(input, writeOpts),
  );

  const moveCollection = useGuardedMutation(workspaceId, surfaceId, (writeOpts, input: ApplyTreeCollectionMoveInput) =>
    applyTreeCollectionMove(input, writeOpts),
  );

  return useMemo(() => ({ moveLeaf, moveCollection }), [moveLeaf, moveCollection]);
}
