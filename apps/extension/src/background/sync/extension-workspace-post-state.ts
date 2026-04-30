/**
 * Per-envelope extensionWorkspace post-state projection (Phase B).
 *
 * Same shape as `files-post-state.ts` for the singleton extensionWorkspace
 * entity. Folds the live set at `workspaces` into a sorted
 * `V5.ExtensionWorkspace[]` and reads the `activeId` scalar — renderer
 * + SW-internal consumers see post-commit state without iterating
 * arrays themselves.
 *
 * Sort order: by orderKey ascending then by id (matches the §23.5
 * "ordering lives on the parent" posture; orderKey is envelope-resident
 * per §22.1). The synthetic `sortIndex` re-emitted on each
 * V5.ExtensionWorkspace mirrors the projection's sort position so legacy
 * consumers reading `sortIndex` keep behaving the same.
 *
 * Tombstoned (singleton deletion is not a production gesture) and
 * non-matching envelopes return `null`.
 */

import {
  type ExtensionWorkspaceSlot,
  EXTENSION_WORKSPACE_ACTIVE_ID_PATH,
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  EXTENSION_WORKSPACE_ID,
  EXTENSION_WORKSPACES_SET_PATH,
  type MutationEnvelope,
} from '@openheaders/core/sync';
import type { SyncExtensionWorkspacePostState } from '@openheaders/core/protocol';
import type { V5 } from '@openheaders/core/types';
import type { EntityOracle } from './oracle';

/** Build the post-state for `envelope`; returns null for non-matching envelopes. */
export function projectExtensionWorkspacePostState(
  oracle: Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>,
  envelope: MutationEnvelope,
): SyncExtensionWorkspacePostState | null {
  if (envelope.body.type !== EXTENSION_WORKSPACE_ENTITY_TYPE) return null;
  return projectExtensionWorkspaceSingleton(oracle);
}

/**
 * Bulk projection — used by the snapshot RPC on renderer-mirror mount
 * and by the cache for boot-replay re-emit. Returns null when the
 * singleton hasn't been materialized yet.
 */
export function projectExtensionWorkspaceSingleton(
  oracle: Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>,
): SyncExtensionWorkspacePostState | null {
  const materialized = oracle.materializeOne(
    EXTENSION_WORKSPACE_ENTITY_TYPE,
    EXTENSION_WORKSPACE_ID,
  );
  if (!materialized) return null;

  const entries = oracle.liveSetItems(
    EXTENSION_WORKSPACE_ENTITY_TYPE,
    EXTENSION_WORKSPACE_ID,
    EXTENSION_WORKSPACES_SET_PATH,
  );
  // `liveSetItems` already returns entries sorted by orderKey then itemId
  // (the document store's tie-break). Re-emit each slot as a public
  // `V5.ExtensionWorkspace` with the projection-position carried as
  // `sortIndex` so legacy consumers stay byte-stable.
  const workspaces: V5.ExtensionWorkspace[] = [];
  let sortIndex = 0;
  for (const entry of entries) {
    if (!isExtensionWorkspaceSlot(entry.item)) continue;
    workspaces.push(toExtensionWorkspace(entry.item, sortIndex));
    sortIndex += 1;
  }

  const data = (materialized.data ?? {}) as Record<string, unknown>;
  const activeRaw = data[EXTENSION_WORKSPACE_ACTIVE_ID_PATH];
  const activeWorkspaceId = typeof activeRaw === 'string' ? activeRaw : null;
  return { workspaces, activeWorkspaceId };
}

const isExtensionWorkspaceSlot = (v: unknown): v is ExtensionWorkspaceSlot => {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    (r.kind === 'personal' || r.kind === 'team') &&
    typeof r.name === 'string' &&
    typeof r.createdAt === 'string' &&
    typeof r.updatedAt === 'string'
  );
};

function toExtensionWorkspace(
  slot: ExtensionWorkspaceSlot,
  sortIndex: number,
): V5.ExtensionWorkspace {
  return {
    schemaVersion: 5,
    id: slot.id,
    kind: slot.kind,
    name: slot.name,
    description: slot.description,
    color: slot.color,
    icon: slot.icon,
    sortIndex,
    createdAt: slot.createdAt,
    updatedAt: slot.updatedAt,
    source: slot.source,
  };
}
