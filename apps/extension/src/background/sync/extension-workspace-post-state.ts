/**
 * Per-envelope extensionWorkspace post-state projection (Phase B).
 *
 * Thin adapter over `flat-entity-post-state.ts` (singleton variant).
 * Folds the live set at `workspaces` into a sorted
 * `V5.ExtensionWorkspace[]` and reads the `activeId` scalar so renderer
 * + SW-internal consumers see post-commit state without iterating
 * arrays themselves.
 *
 * Sort order: `liveSetItems` already returns entries sorted by orderKey
 * then itemId (the document store's tie-break). The synthetic
 * `sortIndex` re-emitted on each `V5.ExtensionWorkspace` mirrors the
 * projection's sort position so legacy consumers reading `sortIndex`
 * stay byte-stable.
 */

import {
  type ExtensionWorkspaceSlot,
  EXTENSION_WORKSPACE_ACTIVE_ID_PATH,
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  EXTENSION_WORKSPACE_ID,
  EXTENSION_WORKSPACES_SET_PATH,
} from '@openheaders/core/sync';
import type { SyncExtensionWorkspacePostState } from '@openheaders/core/protocol';
import type { V5 } from '@openheaders/core/types';
import { makeSingletonEntityProjectors } from './flat-entity-post-state';
import type { EntityOracle } from './oracle';

type Reads = Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>;

const projectors = makeSingletonEntityProjectors<Reads, SyncExtensionWorkspacePostState>({
  entityType: EXTENSION_WORKSPACE_ENTITY_TYPE,
  entityId: EXTENSION_WORKSPACE_ID,
  compose: (materialized, oracle) => {
    const entries = oracle.liveSetItems(
      EXTENSION_WORKSPACE_ENTITY_TYPE,
      EXTENSION_WORKSPACE_ID,
      EXTENSION_WORKSPACES_SET_PATH,
    );
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
  },
});

export const projectExtensionWorkspacePostState = projectors.projectPostState;
export const projectExtensionWorkspaceSingleton = projectors.projectSingleton;

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
