/**
 * Side-effect intent factories for ExtensionWorkspace mutations.
 *
 * Two intents bracket the renderer-direct write path:
 *
 *   - `SWAP_PER_WORKSPACE_STORES` — emitted by `setActiveExtensionWorkspace`.
 *     Drives the SW-side per-workspace store swap (rule / template /
 *     env / request / live-workflow / live-variable / request-scripts-
 *     review) + DNR rebuild + per-workspace sync engine reinit. Key is
 *     the singleton {@link EXTENSION_WORKSPACE_ID} so a flurry of
 *     setActive flips collapses to a single drain whose materialized
 *     `activeWorkspaceId` is the LATEST committed value (the runner
 *     re-reads the cache mirror, not the per-envelope payload).
 *   - `PURGE_WORKSPACE_DATA` — emitted by `removeExtensionWorkspace`.
 *     Drives per-workspace storage key purge (rules / collections /
 *     folders / requests / templates / markers / env / vault / test
 *     runs / files / oauth / live-* / cooldowns) for the removed id.
 *     Key is the removed workspace id so concurrent removes of
 *     different workspaces don't coalesce; same-id retries do.
 *
 * The runners live in
 * `apps/extension/src/background/sync/workspace-coord-runner.ts`. Both
 * subscribe to the global broadcast and drain the IDB pending-intents
 * store on each `extensionWorkspace` envelope — same pattern as the
 * DNR + resolver-invalidate runners.
 */

import type { HLC } from '../../hlc';
import type { MutationEnvelope } from '../../envelope';
import type { SideEffectIntent } from '../types';
import {
  EXTENSION_WORKSPACE_ACTIVE_ID_PATH,
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  EXTENSION_WORKSPACE_ID,
  EXTENSION_WORKSPACES_SET_PATH,
} from './types';

export const SWAP_PER_WORKSPACE_STORES = 'swap-per-workspace-stores';
export const PURGE_WORKSPACE_DATA = 'purge-workspace-data';

/**
 * Intent: swap every per-workspace SW store to the post-commit
 * `activeWorkspaceId`, fire the cross-store DNR rebuild, and reseed
 * the per-workspace sync engines. Coalescing key is the singleton
 * id — every setActive routes through one IDB entry whose latest HLC
 * wins.
 */
export function swapPerWorkspaceStoresIntent(hlc: HLC): SideEffectIntent {
  return { kind: SWAP_PER_WORKSPACE_STORES, key: EXTENSION_WORKSPACE_ID, hlc };
}

/**
 * Intent: purge every per-workspace storage key + encapsulated store
 * (env / vault / test runs / files / oauth / live-* / cooldowns) for
 * the removed workspace id. The renderer's `applyDeleteWorkspace`
 * batches this with a `setActiveExtensionWorkspace` flip when the
 * removed id was active — `SWAP_PER_WORKSPACE_STORES` and
 * `PURGE_WORKSPACE_DATA` then ride the same per-batch all-or-nothing
 * commit.
 */
export function purgeWorkspaceDataIntent(workspaceId: string, hlc: HLC): SideEffectIntent {
  return { kind: PURGE_WORKSPACE_DATA, key: workspaceId, hlc };
}

/**
 * Pure derivation: given a committed envelope, return the
 * `extensionWorkspace` side-effect intents the host must enqueue.
 *
 * Used in two directions:
 *   1. Mint-time, inside the mutator functions (`setActiveExtensionWorkspace`,
 *      `removeExtensionWorkspace`) — they call this on their own
 *      minted envelope so the intent list in their {@link MutatorIntent}
 *      result derives from the envelope rather than a parallel computation.
 *   2. Receive-time, in the inbound mutation-stream bridge — same
 *      function, same envelope shape, so a peer's setActive flip
 *      lands the SWAP intent on every host that applies the mutation.
 *
 * Pure (no IO, no state). Returns `[]` for envelope kinds that don't
 * map to a side effect (set / move / unrelated entity types).
 */
export function deriveExtensionWorkspaceSideEffects(envelope: MutationEnvelope): SideEffectIntent[] {
  if (envelope.body.type !== EXTENSION_WORKSPACE_ENTITY_TYPE) return [];
  const { hlc, body } = envelope;
  if (body.kind === 'setField' && body.path === EXTENSION_WORKSPACE_ACTIVE_ID_PATH) {
    return [swapPerWorkspaceStoresIntent(hlc)];
  }
  if (body.kind === 'removeFromSet' && body.path === EXTENSION_WORKSPACES_SET_PATH) {
    return [purgeWorkspaceDataIntent(body.itemId, hlc)];
  }
  return [];
}
