/**
 * Side-effect intent factory for ExtensionWorkspace mutations.
 *
 *   - `PURGE_WORKSPACE_DATA` — derived from `removeExtensionWorkspace`.
 *     Drives per-workspace storage key purge (rules / collections /
 *     folders / requests / templates / markers / env / vault / test
 *     runs / files / oauth / live-* / cooldowns) for the removed id.
 *     Key is the removed workspace id so concurrent removes of
 *     different workspaces don't coalesce; same-id retries do.
 *
 * The active-pointer flip's `SWAP_PER_WORKSPACE_STORES` derives from
 * the host-local `active-workspace` singleton (`../active-workspace/
 * side-effects.ts`), never from this catalog: the legacy `setField
 * activeId` rows every log still holds are ignored here by path.
 *
 * The runner lives in `packages/oracle/src/sync/workspace-coord-runner.ts`
 * and drains the pending-intents store on every global-scope broadcast.
 */

import type { MutationEnvelope } from '../../envelope';
import type { HLC } from '../../hlc';
import type { SideEffectIntent } from '../types';
import { EXTENSION_WORKSPACE_ENTITY_TYPE, EXTENSION_WORKSPACES_SET_PATH } from './types';

export const PURGE_WORKSPACE_DATA = 'purge-workspace-data';

/**
 * Intent: purge every per-workspace storage key + encapsulated store
 * (env / vault / test runs / files / oauth / live-* / cooldowns) for
 * the removed workspace id. A delete of the active workspace batches
 * this with a `setActiveWorkspace` flip on the pointer singleton —
 * `SWAP_PER_WORKSPACE_STORES` and `PURGE_WORKSPACE_DATA` then ride the
 * same per-batch all-or-nothing commit.
 */
export function purgeWorkspaceDataIntent(workspaceId: string, hlc: HLC): SideEffectIntent {
  return { kind: PURGE_WORKSPACE_DATA, key: workspaceId, hlc };
}

/**
 * Pure derivation: given a committed envelope, return the
 * `extensionWorkspace` side-effect intents the host must enqueue.
 * The oracle runs it at its commit point; the mutators run it on their
 * own minted envelopes so their `MutatorIntent.sideEffects` pin the
 * same mapping. Returns `[]` for every body that is not a list-row
 * removal — slot writes, reorders and the legacy pointer field alike.
 */
export function deriveExtensionWorkspaceSideEffects(envelope: MutationEnvelope): SideEffectIntent[] {
  if (envelope.body.type !== EXTENSION_WORKSPACE_ENTITY_TYPE) return [];
  const { hlc, body } = envelope;
  if (body.kind === 'removeFromSet' && body.path === EXTENSION_WORKSPACES_SET_PATH) {
    return [purgeWorkspaceDataIntent(body.itemId, hlc)];
  }
  return [];
}
