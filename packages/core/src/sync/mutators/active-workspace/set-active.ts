/**
 * Active-workspace pointer intent factory.
 *
 * One primitive: `setActiveWorkspace({ id })` — `setField` at the
 * singleton's `workspaceId` path. LWW by HLC; same-host surfaces
 * converge on which workspace is live through per-leaf LWW (§7.2).
 *
 * The caller guarantees `id` names a workspace in the list. The
 * workspace store's boot fallback ("active id missing → first in sort
 * order") covers a pointer left dangling by an unclean shutdown.
 *
 * Side effect: `SWAP_PER_WORKSPACE_STORES`.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { deriveActiveWorkspaceSideEffects } from './side-effects';
import { ACTIVE_WORKSPACE_ENTITY_TYPE, ACTIVE_WORKSPACE_ID, ACTIVE_WORKSPACE_PATH } from './types';

export interface SetActiveWorkspaceArgs {
  id: string;
}

export function setActiveWorkspace(ctx: MutatorContext, args: SetActiveWorkspaceArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'setField',
      type: ACTIVE_WORKSPACE_ENTITY_TYPE,
      id: ACTIVE_WORKSPACE_ID,
      path: ACTIVE_WORKSPACE_PATH,
      value: args.id,
    },
  ]);
  return {
    batch,
    sideEffects: batch.mutations.flatMap(deriveActiveWorkspaceSideEffects),
  };
}
