/**
 * useLayoutStateMutator — write-only API for layout-state writes.
 *
 * Thin React adapter over the imperative helpers in
 * `layout-state-write-client.ts`. Mirrors `usePauseMarkersMutator`. The
 * single memoised callback closes over the `(workspaceId, surfaceId)`
 * pair so a workspace switch produces fresh function references and
 * any in-flight envelope carries the workspace id it was minted under.
 *
 * Singleton entity — the helper takes no entity id.
 */

import { useCallback, useMemo } from 'react';
import { applyLayoutSet, type LayoutStateResult } from '@/shared/sync/layout-state-write-client';

export type { LayoutStateResult };

export interface UseLayoutStateMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseLayoutStateMutatorApi {
  setLayout(layout: unknown): Promise<LayoutStateResult>;
}

const NO_WORKSPACE = { ok: false, reason: 'other', message: 'no active workspace' } as const;

export function useLayoutStateMutator(
  opts: UseLayoutStateMutatorOptions,
): UseLayoutStateMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const setLayout = useCallback<UseLayoutStateMutatorApi['setLayout']>(
    async (layout) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyLayoutSet({ layout }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  return useMemo(() => ({ setLayout }), [setLayout]);
}
