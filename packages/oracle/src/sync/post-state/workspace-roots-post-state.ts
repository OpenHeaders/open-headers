/**
 * Per-envelope workspace-roots post-state projection.
 *
 * Thin adapter over `flat-entity-post-state.ts` (singleton variant),
 * the trusted-roots shape: the folded record — the three trees'
 * collection uids in slot order — plus the per-uid order keys a
 * renderer collection create appends after (§23.5). The roots are
 * observable without a create (singleton), so the projection exists
 * from the first collection slot on.
 *
 * `arrangeInRootsOrder` is the read rule for the three collection
 * caches: roots slot order first, then the slot-less collections (an
 * old client's create, the boot window before the reconciliation rule
 * seeds them) in uid order — never require a slot on read.
 */

import type { SyncWorkspaceRootsPostState } from '@openheaders/core/protocol';
import { type MutationBody, WORKSPACE_ROOTS_ENTITY_TYPE, WORKSPACE_ROOTS_ID } from '@openheaders/core/sync';
import {
  projectWorkspaceRoots,
  WORKSPACE_ROOTS_SETS,
} from '@openheaders/core/sync-builders/projections/workspace-roots-projection';
import type { EntityOracle } from '../oracle';
import { buildSetMembersExtras, makeSingletonEntityProjectors } from './flat-entity-post-state';

type Reads = Pick<EntityOracle, 'materializeOne' | 'liveSetItems' | 'liveOrderedSetItems'>;

const projectors = makeSingletonEntityProjectors<Reads, SyncWorkspaceRootsPostState>({
  entityType: WORKSPACE_ROOTS_ENTITY_TYPE,
  entityId: WORKSPACE_ROOTS_ID,
  compose: (materialized, oracle) => {
    const workspaceRoots = projectWorkspaceRoots(materialized, (setPath) =>
      oracle.liveOrderedSetItems(WORKSPACE_ROOTS_ENTITY_TYPE, WORKSPACE_ROOTS_ID, setPath),
    );
    if (!workspaceRoots) return null;
    const setOrderKeys = buildSetMembersExtras(
      oracle,
      WORKSPACE_ROOTS_ENTITY_TYPE,
      WORKSPACE_ROOTS_ID,
      WORKSPACE_ROOTS_SETS.map((set) => set.path),
    ).setOrderKeys;
    return { workspaceRoots, setOrderKeys };
  },
});

export const projectWorkspaceRootsPostState = projectors.projectPostState;
export const projectWorkspaceRootsSingleton = projectors.projectSingleton;

/**
 * Collections in roots order: the tree's roots slots first (slot
 * order), then every slot-less collection in uid order.
 */
export function arrangeInRootsOrder<E extends { uid: string }>(
  oracle: Pick<EntityOracle, 'liveOrderedSetItems'>,
  rootsPath: string,
  collections: E[],
): E[] {
  const position = new Map<string, number>();
  const slots = oracle.liveOrderedSetItems(WORKSPACE_ROOTS_ENTITY_TYPE, WORKSPACE_ROOTS_ID, rootsPath);
  for (let i = 0; i < slots.length; i++) position.set(slots[i].itemId, i);
  const rank = (uid: string): number => position.get(uid) ?? Number.POSITIVE_INFINITY;
  return [...collections].sort((a, b) => {
    const ra = rank(a.uid);
    const rb = rank(b.uid);
    if (ra !== rb) return ra < rb ? -1 : 1;
    return a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0;
  });
}

/** Whether a committed envelope touched one tree's roots set. */
export function affectsRoots(body: MutationBody, rootsPath: string): boolean {
  return body.type === WORKSPACE_ROOTS_ENTITY_TYPE && 'path' in body && body.path === rootsPath;
}
