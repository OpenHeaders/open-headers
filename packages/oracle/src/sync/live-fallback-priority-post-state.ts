/**
 * Per-envelope live-fallback-priority post-state projection (WS-C C14).
 *
 * Thin adapter over `flat-entity-post-state.ts` (singleton variant). The
 * materialized form folds the `members` set into an array; consumers want
 * a Record keyed by `principalId` plus the derived ranking. The compose
 * callback uses `oracle.liveSetItems` to recover the members, then
 * `orderFallbackPriorityMembers` to derive the sorted `Principal.id[]`.
 *
 * Not sensitive — members carry only `Principal.id`s; this projection
 * feeds the same-machine broadcast + the snapshot builder and is never
 * redacted.
 */

import type { SyncLiveFallbackPriorityPostState } from '@openheaders/core/protocol';
import {
  LIVE_FALLBACK_PRIORITY_ENTITY_TYPE,
  LIVE_FALLBACK_PRIORITY_ID,
  LIVE_FALLBACK_PRIORITY_MEMBERS_PATH,
} from '@openheaders/core/sync';
import { orderFallbackPriorityMembers } from '@openheaders/core/sync-builders/live-fallback-priority-projection';
import type { LiveFallbackPriorityMember } from '@openheaders/core/types';
import { makeSingletonEntityProjectors } from './flat-entity-post-state';
import type { EntityOracle } from './oracle';

type Reads = Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>;

const projectors = makeSingletonEntityProjectors<Reads, SyncLiveFallbackPriorityPostState>({
  entityType: LIVE_FALLBACK_PRIORITY_ENTITY_TYPE,
  entityId: LIVE_FALLBACK_PRIORITY_ID,
  compose: (_materialized, oracle) => {
    const members = recordFromLiveSet(oracle);
    return { members, principalIds: orderFallbackPriorityMembers(members) };
  },
});

export const projectLiveFallbackPriorityPostState = projectors.projectPostState;
export const projectLiveFallbackPrioritySingleton = projectors.projectSingleton;

function recordFromLiveSet(oracle: Pick<EntityOracle, 'liveSetItems'>): Record<string, LiveFallbackPriorityMember> {
  const out: Record<string, LiveFallbackPriorityMember> = {};
  for (const entry of oracle.liveSetItems(
    LIVE_FALLBACK_PRIORITY_ENTITY_TYPE,
    LIVE_FALLBACK_PRIORITY_ID,
    LIVE_FALLBACK_PRIORITY_MEMBERS_PATH,
  )) {
    out[entry.itemId] = entry.item as LiveFallbackPriorityMember;
  }
  return out;
}
