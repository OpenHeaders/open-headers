/**
 * ExtensionWorkspace slot intent factories.
 *
 * Three primitives keyed by workspace id:
 *   - `setExtensionWorkspace(slot, orderKey)` — addToSet on the
 *     singleton's `workspaces` path. Used for both create (fresh id)
 *     and update (existing id, replace-by-itemId). Whole-record
 *     replace; per-field LWW within a slot is not a v1 primitive.
 *   - `removeExtensionWorkspace(id)` — removeFromSet tombstone. The
 *     caller is responsible for re-pointing `activeId` if it referenced
 *     the deleted workspace (emit a separate `setActiveExtensionWorkspace`
 *     in the same batch — per-batch all-or-nothing keeps the pair
 *     atomic).
 *   - `moveExtensionWorkspaceBefore(id, orderKey)` — moveBefore on the
 *     `workspaces` set. Order keys are envelope-resident (§22.1); the
 *     caller mints `keyBetween(predKey, anchorKey)` from its current
 *     mirror snapshot before emitting.
 *
 * Side effects:
 *   - `setExtensionWorkspace` and `moveExtensionWorkspaceBefore` carry
 *     no intents — workspace-meta create / rename / reorder don't
 *     recompile DNR or invalidate the resolver (those scopes are
 *     per-workspace).
 *   - `removeExtensionWorkspace` emits `PURGE_WORKSPACE_DATA(id)` so
 *     the SW-side per-workspace data purge runs after the commit
 *     lands. Bundled-with-setActive deletes (renderer's
 *     `applyDeleteWorkspace` for the active id) ride the same
 *     all-or-nothing batch — the active flip's
 *     `SWAP_PER_WORKSPACE_STORES` + this purge intent both persist
 *     before broadcast.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { deriveExtensionWorkspaceSideEffects } from './side-effects';
import {
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  EXTENSION_WORKSPACE_ID,
  EXTENSION_WORKSPACES_SET_PATH,
  type ExtensionWorkspaceSlot,
} from './types';

export interface SetExtensionWorkspaceArgs {
  slot: ExtensionWorkspaceSlot;
  /** Fractional-indexing key for the slot's position in the set. Required. */
  orderKey: string;
}

export function setExtensionWorkspace(
  ctx: MutatorContext,
  args: SetExtensionWorkspaceArgs,
): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'addToSet',
      type: EXTENSION_WORKSPACE_ENTITY_TYPE,
      id: EXTENSION_WORKSPACE_ID,
      path: EXTENSION_WORKSPACES_SET_PATH,
      itemId: args.slot.id,
      item: args.slot,
      orderKey: args.orderKey,
    },
  ]);
  // Always funnel through the derivation so the invariant
  // "mutator side-effects = derive(envelope)" holds for every body
  // kind. addToSet on the workspaces set currently maps to no
  // intents, but routing through the derivation keeps the contract
  // intact if that changes.
  return {
    batch,
    sideEffects: batch.mutations.flatMap(deriveExtensionWorkspaceSideEffects),
  };
}

export interface RemoveExtensionWorkspaceArgs {
  id: string;
}

export function removeExtensionWorkspace(
  ctx: MutatorContext,
  args: RemoveExtensionWorkspaceArgs,
): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'removeFromSet',
      type: EXTENSION_WORKSPACE_ENTITY_TYPE,
      id: EXTENSION_WORKSPACE_ID,
      path: EXTENSION_WORKSPACES_SET_PATH,
      itemId: args.id,
    },
  ]);
  // Derive side effects from the minted envelope — same function the
  // inbound bridge calls on peer-received envelopes, so PURGE fires on
  // every host that applies the remove.
  return {
    batch,
    sideEffects: batch.mutations.flatMap(deriveExtensionWorkspaceSideEffects),
  };
}

export interface MoveExtensionWorkspaceBeforeArgs {
  id: string;
  /** Fractional-indexing key for the slot's new position. */
  orderKey: string;
}

export function moveExtensionWorkspaceBefore(
  ctx: MutatorContext,
  args: MoveExtensionWorkspaceBeforeArgs,
): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'moveBefore',
      type: EXTENSION_WORKSPACE_ENTITY_TYPE,
      id: EXTENSION_WORKSPACE_ID,
      path: EXTENSION_WORKSPACES_SET_PATH,
      itemId: args.id,
      orderKey: args.orderKey,
    },
  ]);
  return {
    batch,
    sideEffects: batch.mutations.flatMap(deriveExtensionWorkspaceSideEffects),
  };
}
