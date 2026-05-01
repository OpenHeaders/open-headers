/**
 * Active-workspace pointer intent factory.
 *
 * Single primitive: `setActiveExtensionWorkspace(id)` — `setField` at the
 * singleton's `activeId` path. LWW by HLC; cross-tab convergence on
 * which workspace is live falls out of per-leaf LWW (§7.2).
 *
 * The caller is responsible for ensuring `id` references a workspace
 * present in the singleton's `workspaces` set. Out-of-range ids resolve
 * via the consumer's "active id missing → fall back to first" guard
 * the workspace-store already runs at hydration time.
 *
 * Side effect: `SWAP_PER_WORKSPACE_STORES`. Drives the SW-side per-
 * workspace store swap + per-workspace sync engine reinit + DNR rebuild
 * after every active flip. Singleton-keyed so concurrent flips collapse
 * to a single drain whose target is the latest-HLC active id.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { swapPerWorkspaceStoresIntent } from './side-effects';
import {
  EXTENSION_WORKSPACE_ACTIVE_ID_PATH,
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  EXTENSION_WORKSPACE_ID,
} from './types';

export interface SetActiveExtensionWorkspaceArgs {
  id: string;
}

export function setActiveExtensionWorkspace(
  ctx: MutatorContext,
  args: SetActiveExtensionWorkspaceArgs,
): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'setField',
        type: EXTENSION_WORKSPACE_ENTITY_TYPE,
        id: EXTENSION_WORKSPACE_ID,
        path: EXTENSION_WORKSPACE_ACTIVE_ID_PATH,
        value: args.id,
      },
    ]),
    sideEffects: [swapPerWorkspaceStoresIntent(ctx.hlc)],
  };
}
