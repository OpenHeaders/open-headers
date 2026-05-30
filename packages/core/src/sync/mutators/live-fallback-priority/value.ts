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
 * Removal (manual prune) + reorder ride with the commit-3 management UI;
 * the list is append-only here. The `addToSet` auto-vivifies the
 * singleton, so no `create` is needed at runtime — only the seed path
 * (`sync-builders/live-fallback-priority-projection.ts`) mints the scalar
 * shell.
 */

import type { LiveFallbackPriorityMember } from '../../../types/live-fallback-priority';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import {
  LIVE_FALLBACK_PRIORITY_ENTITY_TYPE,
  LIVE_FALLBACK_PRIORITY_ID,
  LIVE_FALLBACK_PRIORITY_MEMBERS_PATH,
} from './types';

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
    batch: mintBatch(ctx, [
      {
        kind: 'addToSet',
        type: LIVE_FALLBACK_PRIORITY_ENTITY_TYPE,
        id: LIVE_FALLBACK_PRIORITY_ID,
        path: LIVE_FALLBACK_PRIORITY_MEMBERS_PATH,
        itemId: args.member.principalId,
        item: args.member,
      },
    ]),
    sideEffects: [],
  };
}
