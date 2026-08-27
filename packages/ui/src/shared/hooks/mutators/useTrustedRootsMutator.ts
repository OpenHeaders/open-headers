/**
 * useTrustedRootsMutator — write-only API for the workspace trust list.
 *
 * Thin React adapter over `trusted-roots-write-client.ts`. Singleton
 * entity — the helpers take no entity id.
 */

import {
  type ApplyTrustedRootAddInput,
  applyTrustedRootAdd,
  applyTrustedRootRemove,
  type TrustedRootAddResult,
  type TrustedRootsResult,
} from '@openheaders/ui/shared/sync/trusted-roots-write-client';
import { useMemo } from 'react';
import { useGuardedMutation } from './use-guarded-mutation';

export type { TrustedRootAddResult, TrustedRootsResult };

export interface UseTrustedRootsMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseTrustedRootsMutatorApi {
  addRoot(input: ApplyTrustedRootAddInput): Promise<TrustedRootAddResult>;
  removeRoot(uid: string): Promise<TrustedRootsResult>;
}

export function useTrustedRootsMutator(opts: UseTrustedRootsMutatorOptions): UseTrustedRootsMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const addRoot = useGuardedMutation(workspaceId, surfaceId, (writeOpts, input: ApplyTrustedRootAddInput) =>
    applyTrustedRootAdd(input, writeOpts),
  );

  const removeRoot = useGuardedMutation(workspaceId, surfaceId, (writeOpts, uid: string) =>
    applyTrustedRootRemove({ uid }, writeOpts),
  );

  return useMemo(() => ({ addRoot, removeRoot }), [addRoot, removeRoot]);
}
