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
import type { SideEffectIntent } from '../types';
import { EXTENSION_WORKSPACE_ID } from './types';

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
