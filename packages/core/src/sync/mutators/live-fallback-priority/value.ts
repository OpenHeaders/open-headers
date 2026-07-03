/**
 * Value intent factories for live-fallback-priority.
 *
 * `enlistFallbackPriorityMember` — append (or re-stamp) one host's rank.
 * One `addToSet` on `members`; whole-record LWW per `(members,
 * principalId)`. A same-device host calls this to enlist itself once it
 * holds an exclusive workflow's consumed seed (WS-C C14 auto-seed). The
 * caller derives `order` as `max(existing) + 1`; concurrent same-`order`
 * appends by two hosts converge via the reader's `(order, principalId)`
 * sort.
 *
 * `reorderFallbackPriorityMembers` — the commit-3 management gesture. The
 * user drags the list into a new order; the factory re-emits EVERY member
 * as an `addToSet` re-stamped with a fresh contiguous `order` (its array
 * index). Whole-list re-emit is collision-free given the order-as-data
 * per-`principalId` LWW: each member's payload is updated independently,
 * and a manual reorder is rare enough that interleaving two concurrent
 * reorders (per-member HLC LWW) is benign — the result is still
 * deterministic on every peer.
 *
 * `pruneFallbackPriorityMember` — the only removal path for the otherwise
 * append-only list. One `removeFromSet` tombstone keyed by `principalId`.
 *
 * The `addToSet` auto-vivifies the singleton, so no `create` is needed at
 * runtime — only the seed path
 * (`sync-builders/projections/live-fallback-priority-projection.ts`) mints the scalar
 * shell.
 */

import type { LiveFallbackPriorityMember } from '../../../types/live-fallback-priority';
import type { MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import {
  LIVE_FALLBACK_PRIORITY_ENTITY_TYPE,
  LIVE_FALLBACK_PRIORITY_ID,
  LIVE_FALLBACK_PRIORITY_MEMBERS_PATH,
} from './types';

function addMemberBody(member: LiveFallbackPriorityMember): MutationBody {
  return {
    kind: 'addToSet',
    type: LIVE_FALLBACK_PRIORITY_ENTITY_TYPE,
    id: LIVE_FALLBACK_PRIORITY_ID,
    path: LIVE_FALLBACK_PRIORITY_MEMBERS_PATH,
    itemId: member.principalId,
    item: member,
  };
}

export interface EnlistFallbackPriorityMemberArgs {
  /** The ranked host — `principalId` is the set member identity. */
  member: LiveFallbackPriorityMember;
}

/** Append (or re-stamp) one host's rank in the priority list. */
export function enlistFallbackPriorityMember(
  ctx: MutatorContext,
  args: EnlistFallbackPriorityMemberArgs,
): MutatorIntent {
  return {
    batch: mintBatch(ctx, [addMemberBody(args.member)]),
    sideEffects: [],
  };
}

export interface ReorderFallbackPriorityMembersArgs {
  /**
   * The full member set in the desired new order. The factory re-stamps
   * each member's `order` from its index, so callers pass display order
   * and need not compute the ordinals themselves.
   */
  orderedMembers: readonly LiveFallbackPriorityMember[];
}

/**
 * Re-emit the whole list with fresh contiguous ranks (one `addToSet` per
 * member, `order` = array index). Empty input emits an empty batch.
 */
export function reorderFallbackPriorityMembers(
  ctx: MutatorContext,
  args: ReorderFallbackPriorityMembersArgs,
): MutatorIntent {
  return {
    batch: mintBatch(
      ctx,
      args.orderedMembers.map((member, index) => addMemberBody({ ...member, order: index })),
    ),
    sideEffects: [],
  };
}

export interface PruneFallbackPriorityMemberArgs {
  /** Identity of the host to drop from the list. */
  principalId: string;
}

/** Remove one host from the priority list (the list's only removal path). */
export function pruneFallbackPriorityMember(ctx: MutatorContext, args: PruneFallbackPriorityMemberArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'removeFromSet',
        type: LIVE_FALLBACK_PRIORITY_ENTITY_TYPE,
        id: LIVE_FALLBACK_PRIORITY_ID,
        path: LIVE_FALLBACK_PRIORITY_MEMBERS_PATH,
        itemId: args.principalId,
      },
    ]),
    sideEffects: [],
  };
}
