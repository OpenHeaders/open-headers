/**
 * Per-envelope pause-markers post-state projection (Phase B).
 *
 * Thin adapter over `flat-entity-post-state.ts` (singleton variant).
 * Folds the live set at `markers` into the uid-keyed record so DNR +
 * renderer consumers see post-commit state without iterating arrays.
 *
 * Version-1 members (keyed by container path, still minted by 2026.8.4
 * clients) are migrated on read: the path resolves to its container
 * ref through `resolveTreeParent` over the rules tree's live
 * containers — the same net the slot reconciler uses, whose
 * `<slug>-<uid>` tail parse answers even before the container has
 * hydrated. Unresolvable paths drop out of the projection and are
 * never rewritten in the store.
 *
 * Pause markers are user-visible UX state, not secrets — the projection
 * is identical for all surfaces.
 */

import type { SyncPauseMarkersPostState } from '@openheaders/core/protocol';
import {
  FOLDER_TREE_KINDS,
  PAUSE_MARKERS_ENTITY_TYPE,
  PAUSE_MARKERS_ID,
  PAUSE_MARKERS_PATH,
  type PauseMarkerRef,
  resolveTreeParent,
} from '@openheaders/core/sync';
import {
  foldPauseMarkerItems,
  pauseMarkersRecordFromEntries,
} from '@openheaders/core/sync-builders/projections/pause-markers-projection';
import type { EntityOracle } from '../oracle';
import { makeSingletonEntityProjectors } from './flat-entity-post-state';
import { RULE_TREE } from './folder-post-state';
import { treeContainers } from './folder-tree-post-state';

type Reads = Pick<
  EntityOracle,
  'materializeOne' | 'materializeAll' | 'liveSetItems' | 'liveOrderedSetItems' | 'revision'
>;

/** Resolve a version-1 marker path to its container ref off the live rules tree. */
export function legacyPauseMarkerResolver(oracle: Reads): (path: string) => PauseMarkerRef | null {
  let containers: ReturnType<typeof treeContainers> | null = null;
  return (path) => {
    containers ??= treeContainers(oracle, RULE_TREE);
    return resolveTreeParent(path, containers, FOLDER_TREE_KINDS);
  };
}

const projectors = makeSingletonEntityProjectors<Reads, SyncPauseMarkersPostState>({
  entityType: PAUSE_MARKERS_ENTITY_TYPE,
  entityId: PAUSE_MARKERS_ID,
  compose: (_materialized, oracle) =>
    pauseMarkersRecordFromEntries(
      foldPauseMarkerItems(
        oracle.liveOrderedSetItems(PAUSE_MARKERS_ENTITY_TYPE, PAUSE_MARKERS_ID, PAUSE_MARKERS_PATH),
        legacyPauseMarkerResolver(oracle),
      ),
    ),
});

export const projectPauseMarkersPostState = projectors.projectPostState;
export const projectPauseMarkersSingleton = projectors.projectSingleton;
