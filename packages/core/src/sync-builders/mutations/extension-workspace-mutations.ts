/**
 * ExtensionWorkspace write-site → oracle helpers.
 *
 * Pure transforms — no oracle reads, no IO — used by both the SW
 * (legacy `workspace-store.ts` routing through the global oracle once
 * commit 3 flips it) and the renderer (`useExtensionWorkspaceMutator`
 * write client). Mirrors `files-mutations.ts`.
 *
 * The order-key parameter on `Set` and `MoveBefore` is envelope-resident
 * (§22.1): the renderer mints `keyBetween(predKey, anchorKey)` from its
 * current mirror snapshot before emitting; the SW writes mint a fresh
 * tail key via `seedKey` / `keyBetween(prev, null)` against the live
 * set the global cache exposes.
 */

import {
  type ExtensionWorkspaceSlot,
  type MutatorContext,
  type MutatorIntent,
  moveExtensionWorkspaceBefore,
  removeExtensionWorkspace,
  setActiveWorkspace,
  setExtensionWorkspace,
} from '@openheaders/core/sync';

export type ExtensionWorkspaceMutationPayload = MutatorIntent;

export interface SetExtensionWorkspaceInput {
  slot: ExtensionWorkspaceSlot;
  orderKey: string;
}

export function buildSetExtensionWorkspaceBatch(
  input: SetExtensionWorkspaceInput,
  ctx: MutatorContext,
): ExtensionWorkspaceMutationPayload {
  return setExtensionWorkspace(ctx, input);
}

export interface RemoveExtensionWorkspaceInput {
  id: string;
}

export function buildRemoveExtensionWorkspaceBatch(
  input: RemoveExtensionWorkspaceInput,
  ctx: MutatorContext,
): ExtensionWorkspaceMutationPayload {
  return removeExtensionWorkspace(ctx, input);
}

export interface MoveExtensionWorkspaceBeforeInput {
  id: string;
  orderKey: string;
}

export function buildMoveExtensionWorkspaceBeforeBatch(
  input: MoveExtensionWorkspaceBeforeInput,
  ctx: MutatorContext,
): ExtensionWorkspaceMutationPayload {
  return moveExtensionWorkspaceBefore(ctx, input);
}

export interface SetActiveExtensionWorkspaceInput {
  id: string;
}

/**
 * The host's active pointer — a `setField` on the host-local
 * `active-workspace` singleton, never a field on the shared list record.
 */
export function buildSetActiveExtensionWorkspaceBatch(
  input: SetActiveExtensionWorkspaceInput,
  ctx: MutatorContext,
): ExtensionWorkspaceMutationPayload {
  return setActiveWorkspace(ctx, input);
}
