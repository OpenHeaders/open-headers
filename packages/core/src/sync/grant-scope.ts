/**
 * Grant-scope classification (Phase 5 slice 2).
 *
 * The `__global__` scope's mutation log carries the cross-workspace
 * `extensionWorkspace` singleton: a `workspaces` set with one slot per
 * workspace, plus the `activeId` scalar. The slot ops (`addToSet` /
 * `removeFromSet` / `moveBefore`, keyed by `itemId` = the workspace id)
 * are per-workspace METADATA ROWS — a peer without any grant on a
 * workspace must not receive its row, on any egress path (catch-up
 * responder, live fan-out, snapshot RPC).
 *
 * This module is the single source of truth for "which workspace does a
 * global-scope mutation govern"; the *decision* (does this peer hold
 * `workspace.read` on it) stays with the capability resolver at each
 * gate. Non-row global mutations (the `activeId` pointer) return `null`
 * and ride ungated — they carry an opaque id, not workspace data.
 */

import type { MutationEnvelope } from './envelope';
import { EXTENSION_WORKSPACE_ENTITY_TYPE, EXTENSION_WORKSPACES_SET_PATH } from './mutators';

/**
 * The workspace id whose list row this global-scope mutation creates,
 * removes, or reorders — or `null` when the mutation isn't a
 * workspace-list row op.
 */
export function workspaceListRowIdForMutation(envelope: MutationEnvelope): string | null {
  const body = envelope.body;
  if (body.type !== EXTENSION_WORKSPACE_ENTITY_TYPE) return null;
  if (body.kind !== 'addToSet' && body.kind !== 'removeFromSet' && body.kind !== 'moveBefore') return null;
  if (body.path !== EXTENSION_WORKSPACES_SET_PATH) return null;
  return body.itemId;
}
