/**
 * Live-fallback-priority projection — `LiveFallbackPrioritySnapshot ⇄
 * MutationBatch` + the derived ranking the election consumes.
 *
 * The oracle stores each ranked host as a set-modeled member at
 * `members` with itemId = `principalId`. `seedLiveFallbackPriority`
 * walks the map and emits one `create` for the scalar shell (carries
 * `schemaVersion`) plus one `addToSet` per member. All-or-nothing under
 * the oracle's per-entity lock.
 *
 * `orderFallbackPriorityMembers` is the single place the **order-as-data**
 * members become the flat `Principal.id[]` ranking: sort by `order`, then
 * by `principalId` as a deterministic secondary so two hosts that append
 * concurrently at the same `order` resolve to the identical sequence on
 * every peer once their LWW members converge.
 */

import {
  LIVE_FALLBACK_PRIORITY_ENTITY_TYPE,
  LIVE_FALLBACK_PRIORITY_ID,
  LIVE_FALLBACK_PRIORITY_MEMBERS_PATH,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
} from '../sync';
import type { LiveFallbackPriorityMember, LiveFallbackPrioritySnapshot } from '../types/live-fallback-priority';

export type { LiveFallbackPrioritySnapshot } from '../types/live-fallback-priority';

/**
 * Convert a priority snapshot into a `MutationBatch` of one `create` for
 * the scalar shell + one `addToSet` per member. All-or-nothing under the
 * oracle's per-entity lock.
 */
export function seedLiveFallbackPriority(snapshot: LiveFallbackPrioritySnapshot, ctx: MutatorContext): MutationBatch {
  const bodies: MutationBody[] = [
    {
      kind: 'create',
      type: LIVE_FALLBACK_PRIORITY_ENTITY_TYPE,
      id: LIVE_FALLBACK_PRIORITY_ID,
      payload: { schemaVersion: snapshot.schemaVersion },
    },
  ];
  for (const member of Object.values(snapshot.members)) {
    bodies.push({
      kind: 'addToSet',
      type: LIVE_FALLBACK_PRIORITY_ENTITY_TYPE,
      id: LIVE_FALLBACK_PRIORITY_ID,
      path: LIVE_FALLBACK_PRIORITY_MEMBERS_PATH,
      itemId: member.principalId,
      item: member,
    });
  }
  return mintBatch(ctx, bodies);
}

/**
 * Derive the flat priority ranking (`Principal.id[]`) from the member
 * map. Sorted by `(order, principalId)` so the result is identical on
 * every host that has converged on the same member set — the property
 * the offline election relies on (no live coordination available).
 */
export function orderFallbackPriorityMembers(members: Record<string, LiveFallbackPriorityMember>): string[] {
  return Object.values(members)
    .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.principalId < b.principalId ? -1 : 1))
    .map((m) => m.principalId);
}

/** Highest `order` currently in the map, or `-1` when empty (so the first append takes `0`). */
export function maxFallbackPriorityOrder(members: Record<string, LiveFallbackPriorityMember>): number {
  let max = -1;
  for (const member of Object.values(members)) {
    if (member.order > max) max = member.order;
  }
  return max;
}
