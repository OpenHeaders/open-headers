/**
 * Per-envelope layout-state post-state projection (Phase B).
 *
 * Thin adapter over `flat-entity-post-state.ts` (singleton variant).
 * Reads the materialized whole-object scalar at `LAYOUT_STATE_PATH` and
 * re-emits the opaque blob so renderer consumers see post-commit state
 * without round-tripping through the SW.
 */

import type { SyncLayoutStatePostState } from '@openheaders/core/protocol';
import {
  LAYOUT_STATE_ENTITY_TYPE,
  LAYOUT_STATE_ID,
  LAYOUT_STATE_PATH,
} from '@openheaders/core/sync';
import { makeSingletonEntityProjectors } from './flat-entity-post-state';
import type { EntityOracle } from './oracle';

type Reads = Pick<EntityOracle, 'materializeOne'>;

const projectors = makeSingletonEntityProjectors<Reads, SyncLayoutStatePostState>({
  entityType: LAYOUT_STATE_ENTITY_TYPE,
  entityId: LAYOUT_STATE_ID,
  compose: (materialized) => {
    const data = materialized.data as Record<string, unknown> | null;
    const layout = data && LAYOUT_STATE_PATH in data ? data[LAYOUT_STATE_PATH] : null;
    return { layout: layout ?? null };
  },
});

export const projectLayoutStatePostState = projectors.projectPostState;
export const projectLayoutStateSingleton = projectors.projectSingleton;
