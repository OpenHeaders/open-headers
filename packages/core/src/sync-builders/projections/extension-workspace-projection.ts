/**
 * ExtensionWorkspace projection — `(ExtensionWorkspace[], activeId) ⇄ MutationBatch`.
 *
 * The persisted record lives one layer down: the legacy
 * `oh.workspaces` + `oh.runtimeActive.active` host-storage keys (the
 * cache writes back to them once the write-site flip lands in commit 3).
 * The sync engine governs only the singleton record's set + active-id
 * scalar.
 *
 * `seedExtensionWorkspaces` walks a list of `ExtensionWorkspace`
 * (sorted by sortIndex ascending) and emits one `addToSet` per entry
 * under `EXTENSION_WORKSPACES_SET_PATH` with a derived order key, plus
 * one `setField` for the `activeId` scalar. All-or-nothing under the
 * oracle's per-entity lock.
 */

import {
  EXTENSION_WORKSPACE_ACTIVE_ID_PATH,
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  EXTENSION_WORKSPACE_ID,
  EXTENSION_WORKSPACES_SET_PATH,
  type ExtensionWorkspaceSlot,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  orderKeyMinter,
} from '@openheaders/core/sync';
import type { ExtensionWorkspace } from '@openheaders/core/types';
/**
 * Convert a list of workspaces + an active-id pointer into a single
 * `MutationBatch`: one `create` for the singleton shell + one
 * `addToSet` per workspace + one `setField` for the active pointer.
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
  if (activeWorkspaceId) {
    bodies.push({
      kind: 'setField',
      type: EXTENSION_WORKSPACE_ENTITY_TYPE,
      id: EXTENSION_WORKSPACE_ID,
      path: EXTENSION_WORKSPACE_ACTIVE_ID_PATH,
      value: activeWorkspaceId,
    });
  }
  return mintBatch(ctx, bodies);
}
