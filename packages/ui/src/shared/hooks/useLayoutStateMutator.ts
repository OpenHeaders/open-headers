/**
 * useLayoutStateMutator — write-only API for layout-state writes.
 *
 * Thin React adapter over the imperative helpers in
 * `layout-state-write-client.ts`. Singleton entity — the helper takes
 * no entity id.
 */

import { useMemo } from 'react';
import { applyLayoutSet, type LayoutStateResult } from '@openheaders/ui/shared/sync/layout-state-write-client';
import { useGuardedMutation } from './use-guarded-mutation';

export type { LayoutStateResult };

export interface UseLayoutStateMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseLayoutStateMutatorApi {
  setLayout(layout: unknown): Promise<LayoutStateResult>;
}

export function useLayoutStateMutator(
  opts: UseLayoutStateMutatorOptions,
): UseLayoutStateMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const setLayout = useGuardedMutation(workspaceId, surfaceId, (writeOpts, layout: unknown) =>
    applyLayoutSet({ layout }, writeOpts),
  );

  return useMemo(() => ({ setLayout }), [setLayout]);
}
