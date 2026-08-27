/**
 * Per-envelope trusted-roots post-state projection.
 *
 * Thin adapter over `flat-entity-post-state.ts` (singleton variant).
 * Mirrors `vault-post-state.ts`: the folded record, the live root uids
 * and the per-uid order keys the editor's Save reads (§23.5).
 */

import type { SyncTrustedRootsPostState } from '@openheaders/core/protocol';
import { TRUSTED_ROOTS_ENTITY_TYPE, TRUSTED_ROOTS_ID, TRUSTED_ROOTS_PATH } from '@openheaders/core/sync';
import { projectTrustedRoots } from '@openheaders/core/sync-builders/projections/trusted-roots-projection';
import type { EntityOracle } from '../oracle';
import { buildSetMembersExtras, makeSingletonEntityProjectors } from './flat-entity-post-state';

type Reads = Pick<EntityOracle, 'materializeOne' | 'liveSetItems' | 'liveOrderedSetItems'>;

const projectors = makeSingletonEntityProjectors<Reads, SyncTrustedRootsPostState>({
  entityType: TRUSTED_ROOTS_ENTITY_TYPE,
  entityId: TRUSTED_ROOTS_ID,
  compose: (materialized, oracle) => {
    const live = oracle.liveOrderedSetItems(TRUSTED_ROOTS_ENTITY_TYPE, TRUSTED_ROOTS_ID, TRUSTED_ROOTS_PATH);
    const trustedRoots = projectTrustedRoots(materialized, live);
    if (!trustedRoots) return null;
    const rootUids = live.map((entry) => entry.itemId);
    const setOrderKeys = buildSetMembersExtras(oracle, TRUSTED_ROOTS_ENTITY_TYPE, TRUSTED_ROOTS_ID, [
      TRUSTED_ROOTS_PATH,
    ]).setOrderKeys;
    return { trustedRoots, rootUids, setOrderKeys };
  },
});

export const projectTrustedRootsPostState = projectors.projectPostState;
export const projectTrustedRootsSingleton = projectors.projectSingleton;
