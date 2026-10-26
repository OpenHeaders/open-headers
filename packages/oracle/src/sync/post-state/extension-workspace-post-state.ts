/**
 * Per-envelope extensionWorkspace post-state projection (Phase B).
 *
 * Thin adapter over `flat-entity-post-state.ts` (singleton variant).
 * Folds the live set at `workspaces` into a sorted
 * `ExtensionWorkspace[]` and reads this host's pointer off the
 * host-local `active-workspace` singleton, so renderer + SW-internal
 * consumers see post-commit state without iterating arrays themselves.
 * An envelope of either entity type projects the composed state.
 *
 * The legacy `activeId` scalar on the list record (hundreds of rows in
 * every existing log, and still written by older hubs) is never read:
 * the generic store records the field, this projector ignores it.
 *
 * Sort order: `liveSetItems` already returns entries sorted by orderKey
 * then itemId (the document store's tie-break). The synthetic
 * `sortIndex` re-emitted on each `ExtensionWorkspace` mirrors the
 * projection's sort position so legacy consumers reading `sortIndex`
 * stay byte-stable.
 */

import type { SyncExtensionWorkspacePostState } from '@openheaders/core/protocol';
import {
  ACTIVE_WORKSPACE_ENTITY_TYPE,
  ACTIVE_WORKSPACE_ID,
  ACTIVE_WORKSPACE_PATH,
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  EXTENSION_WORKSPACE_ID,
  EXTENSION_WORKSPACES_SET_PATH,
  type ExtensionWorkspaceSlot,
} from '@openheaders/core/sync';
import type { ExtensionWorkspace } from '@openheaders/core/types';
import type { EntityOracle } from '../oracle';
import { makeSingletonEntityProjectors } from './flat-entity-post-state';

type Reads = Pick<EntityOracle, 'materializeOne' | 'liveOrderedSetItems'>;

const projectors = makeSingletonEntityProjectors<Reads, SyncExtensionWorkspacePostState>({
  entityType: EXTENSION_WORKSPACE_ENTITY_TYPE,
  companionEntityTypes: [ACTIVE_WORKSPACE_ENTITY_TYPE],
  entityId: EXTENSION_WORKSPACE_ID,
  compose: (_materialized, oracle) => {
    const entries = oracle.liveOrderedSetItems(
      EXTENSION_WORKSPACE_ENTITY_TYPE,
      EXTENSION_WORKSPACE_ID,
      EXTENSION_WORKSPACES_SET_PATH,
    );
    const workspaces: ExtensionWorkspace[] = [];
    const orderKeys: Record<string, string> = {};
    let sortIndex = 0;
    for (const entry of entries) {
      if (!isExtensionWorkspaceSlot(entry.item)) continue;
      workspaces.push(toExtensionWorkspace(entry.item, sortIndex));
      orderKeys[entry.item.id] = entry.key;
      sortIndex += 1;
    }
    return { workspaces, activeWorkspaceId: readActiveWorkspaceId(oracle), orderKeys };
  },
});

export const projectExtensionWorkspacePostState = projectors.projectPostState;
export const projectExtensionWorkspaceSingleton = projectors.projectSingleton;

/** This host's pointer, or `null` until the singleton holds one. */
function readActiveWorkspaceId(oracle: Reads): string | null {
  const pointer = oracle.materializeOne(ACTIVE_WORKSPACE_ENTITY_TYPE, ACTIVE_WORKSPACE_ID);
  const data = (pointer?.data ?? {}) as Record<string, unknown>;
  const raw = data[ACTIVE_WORKSPACE_PATH];
  return typeof raw === 'string' ? raw : null;
}

const isExtensionWorkspaceSlot = (v: unknown): v is ExtensionWorkspaceSlot => {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    (r.kind === 'personal' || r.kind === 'team') &&
    typeof r.name === 'string' &&
    typeof r.createdAt === 'string' &&
    typeof r.updatedAt === 'string' &&
    typeof r.orgId === 'string'
  );
};

function toExtensionWorkspace(slot: ExtensionWorkspaceSlot, sortIndex: number): ExtensionWorkspace {
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
    importedFrom: slot.importedFrom,
    orgId: slot.orgId,
    visibility: slot.visibility,
  };
}
