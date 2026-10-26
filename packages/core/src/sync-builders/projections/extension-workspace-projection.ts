/**
 * ExtensionWorkspace projection — `(ExtensionWorkspace[], activeId) ⇄ MutationBatch`.
 *
 * The persisted record lives one layer down: the `oh.workspaces` +
 * `oh.runtimeActive.active` host-storage keys the cache writes back to.
 * The sync engine governs the list singleton's set plus this host's
 * pointer singleton.
 *
 * `seedExtensionWorkspaces` walks a list of `ExtensionWorkspace`
 * (sorted by sortIndex ascending) and emits one `addToSet` per entry
 * under `EXTENSION_WORKSPACES_SET_PATH` with a derived order key, then
 * the host's pointer as the `active-workspace` singleton. One batch,
 * all-or-nothing under the oracle's lock chain; the HLC ticks across
 * both entities so the log replays the batch in mint order.
 */

import {
  ACTIVE_WORKSPACE_ENTITY_TYPE,
  ACTIVE_WORKSPACE_ID,
  ACTIVE_WORKSPACE_PATH,
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  EXTENSION_WORKSPACE_ID,
  EXTENSION_WORKSPACES_SET_PATH,
  type ExtensionWorkspaceSlot,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintActiveWorkspaceBatch,
  mintExtensionWorkspaceBatch,
  orderKeyMinter,
  tickHlc,
} from '@openheaders/core/sync';
import type { ExtensionWorkspace } from '@openheaders/core/types';
/**
 * Convert a list of workspaces + the host's active pointer into a
 * single `MutationBatch`: one `create` for the list singleton's shell +
 * one `addToSet` per workspace, then (when a pointer is given) one
 * `create` + one `setField` on the pointer singleton — each entity's
 * envelopes stamped with its own catalog version.
 *
 * The supplied list IS the order we want — sortIndex is the legacy
 * positional field and we re-emit each entry with a fresh fractional
 * `orderKey` derived by walking the list. The slot is the public
 * record minus `schemaVersion` (carried by the singleton snapshot)
 * and minus `sortIndex` (replaced by the envelope-resident orderKey).
 */
export function seedExtensionWorkspaces(
  workspaces: readonly ExtensionWorkspace[],
  activeWorkspaceId: string | null,
  ctx: MutatorContext,
): MutationBatch {
  const sorted = [...workspaces].sort((a, b) => a.sortIndex - b.sortIndex);
  const bodies: MutationBody[] = [
    {
      kind: 'create',
      type: EXTENSION_WORKSPACE_ENTITY_TYPE,
      id: EXTENSION_WORKSPACE_ID,
      payload: {},
    },
  ];
  const nextKey = orderKeyMinter();
  for (const ws of sorted) {
    const slot: ExtensionWorkspaceSlot = {
      id: ws.id,
      kind: ws.kind,
      name: ws.name,
      description: ws.description,
      color: ws.color,
      icon: ws.icon,
      createdAt: ws.createdAt,
      updatedAt: ws.updatedAt,
      source: ws.source,
      importedFrom: ws.importedFrom,
      orgId: ws.orgId,
      visibility: ws.visibility,
    };
    bodies.push({
      kind: 'addToSet',
      type: EXTENSION_WORKSPACE_ENTITY_TYPE,
      id: EXTENSION_WORKSPACE_ID,
      path: EXTENSION_WORKSPACES_SET_PATH,
      itemId: ws.id,
      item: slot,
      orderKey: nextKey(),
    });
  }
  const list = mintExtensionWorkspaceBatch(ctx, bodies);
  if (!activeWorkspaceId) return list;
  const pointer = mintActiveWorkspaceBatch({ ...ctx, batchId: list.batchId, hlc: tickHlc(ctx.hlc, bodies.length) }, [
    {
      kind: 'create',
      type: ACTIVE_WORKSPACE_ENTITY_TYPE,
      id: ACTIVE_WORKSPACE_ID,
      payload: {},
    },
    {
      kind: 'setField',
      type: ACTIVE_WORKSPACE_ENTITY_TYPE,
      id: ACTIVE_WORKSPACE_ID,
      path: ACTIVE_WORKSPACE_PATH,
      value: activeWorkspaceId,
    },
  ]);
  return { batchId: list.batchId, mutations: [...list.mutations, ...pointer.mutations] };
}
