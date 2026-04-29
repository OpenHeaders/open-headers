/**
 * Per-envelope live-variable post-state projection.
 *
 * LV is fully flat-scalar — no set-modeled paths, so the projection
 * carries only the projected `V5.LiveVariable`. Renderer-side write
 * helpers fold this into their local mirror so partial-update emit
 * paths can read the canonical entity without round-tripping back to
 * the SW (§19.4 synchronous-render discipline).
 */

import type { SyncLiveVariablePostState } from '@openheaders/core/protocol';
import type { MutationEnvelope } from '@openheaders/core/sync';
import { LIVE_VARIABLE_ENTITY_TYPE } from '@openheaders/core/sync';
import { projectLiveVariable } from '@/shared/sync/live-variable-projection';
import type { EntityOracle } from './oracle';

export function projectLiveVariablePostState(
  oracle: Pick<EntityOracle, 'materializeOne'>,
  envelope: MutationEnvelope,
): SyncLiveVariablePostState | null {
  if (envelope.body.type !== LIVE_VARIABLE_ENTITY_TYPE) return null;
  return projectLiveVariableByUid(oracle, envelope.body.id);
}

export function projectLiveVariableByUid(
  oracle: Pick<EntityOracle, 'materializeOne'>,
  liveVariableUid: string,
): SyncLiveVariablePostState | null {
  const materialized = oracle.materializeOne(LIVE_VARIABLE_ENTITY_TYPE, liveVariableUid);
  if (!materialized) return null;

  const liveVariable = projectLiveVariable(materialized);
  if (!liveVariable) return null;

  return { liveVariable };
}
