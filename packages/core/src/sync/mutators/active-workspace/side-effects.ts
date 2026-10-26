/**
 * Side-effect intent factory for active-workspace mutations.
 *
 * `SWAP_PER_WORKSPACE_STORES` — derived from every committed
 * `setField` on the pointer. Drives the host's per-workspace store
 * swap (rule / template / env / request / live-workflow / live-
 * variable / request-scripts-review) + DNR rebuild + per-workspace
 * sync engine reinit. Keyed by the singleton {@link ACTIVE_WORKSPACE_ID}
 * so a flurry of flips collapses to a single drain whose target is the
 * LATEST committed pointer (the runner re-reads the workspace store,
 * not the per-envelope payload).
 *
 * The runner lives in `packages/oracle/src/sync/workspace-coord-runner.ts`
 * and drains on every global-scope broadcast. The pointer never crosses
 * a wire, so the intent only ever follows this host's own commits.
 */

import type { MutationEnvelope } from '../../envelope';
import type { HLC } from '../../hlc';
import type { SideEffectIntent } from '../types';
import { ACTIVE_WORKSPACE_ENTITY_TYPE, ACTIVE_WORKSPACE_ID, ACTIVE_WORKSPACE_PATH } from './types';

export const SWAP_PER_WORKSPACE_STORES = 'swap-per-workspace-stores';

/**
 * Intent: swap every per-workspace store to the post-commit pointer,
 * fire the cross-store DNR rebuild, and reseed the per-workspace sync
 * engines. Coalescing key is the singleton id — every flip routes
 * through one pending entry whose latest HLC wins.
 */
export function swapPerWorkspaceStoresIntent(hlc: HLC): SideEffectIntent {
  return { kind: SWAP_PER_WORKSPACE_STORES, key: ACTIVE_WORKSPACE_ID, hlc };
}

/**
 * Pure derivation: the intents a committed active-workspace envelope
 * enqueues. The oracle runs it at its commit point; the mutator runs it
 * on its own minted envelope so its `MutatorIntent.sideEffects` pins the
 * same mapping. Returns `[]` for anything but a `setField` on the
 * pointer path.
 */
export function deriveActiveWorkspaceSideEffects(envelope: MutationEnvelope): SideEffectIntent[] {
  if (envelope.body.type !== ACTIVE_WORKSPACE_ENTITY_TYPE) return [];
  const { hlc, body } = envelope;
  if (body.kind === 'setField' && body.path === ACTIVE_WORKSPACE_PATH) {
    return [swapPerWorkspaceStoresIntent(hlc)];
  }
  return [];
}
