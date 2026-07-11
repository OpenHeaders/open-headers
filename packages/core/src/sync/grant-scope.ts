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
 * gate. Two grains:
 *
 *   - {@link workspaceListRowIdForMutation} — ROW ops only. The grant
 *     offer replays exactly these, and the inbound write gate mirrors
 *     the same shape test.
 *   - {@link workspaceListReadSubjectForMutation} — every workspace id
 *     a global-scope mutation REVEALS: the row ops plus the `activeId`
 *     pointer's value. Read gates filter on this grain — the row gate
 *     hides even the bare id of an ungranted workspace (a
 *     `removeFromSet` carries nothing else), so the pointer naming one
 *     must be held to the same line. Subject-less global mutations
 *     (writable only by the operator via `daemon.admin`) return `null`
 *     and ride ungated.
 */

import type { MutationEnvelope } from './envelope';
import {
  EXTENSION_WORKSPACE_ACTIVE_ID_PATH,
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  EXTENSION_WORKSPACES_SET_PATH,
} from './mutators';

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

/**
 * The workspace id this global-scope mutation reveals to a reader — a
 * list row's id, or the id the `activeId` pointer names — or `null`
 * when it reveals none.
 */
export function workspaceListReadSubjectForMutation(envelope: MutationEnvelope): string | null {
  const rowId = workspaceListRowIdForMutation(envelope);
  if (rowId !== null) return rowId;
  const body = envelope.body;
  if (body.type !== EXTENSION_WORKSPACE_ENTITY_TYPE) return null;
  if (body.kind !== 'setField' || body.path !== EXTENSION_WORKSPACE_ACTIVE_ID_PATH) return null;
  return typeof body.value === 'string' ? body.value : null;
}
