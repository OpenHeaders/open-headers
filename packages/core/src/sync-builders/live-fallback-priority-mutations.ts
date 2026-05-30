/**
 * Live-fallback-priority write-site → oracle helper.
 *
 * Produces a `(MutationBatch, SideEffectIntent[])` pair from the catalog
 * factory in `@openheaders/core/sync` and a {@link MutatorContext}. Pure
 * transform — no oracle reads, no IO. The host-neutral auto-seed pass
 * (a same-device host enlisting itself once it holds an exclusive
 * workflow's consumed seed) is the sole caller.
 *
 * Singleton entity — no id arg on the catalog factory. Members are keyed
 * by `Principal.id`.
 */

import { enlistFallbackPriorityMember, type MutatorContext, type MutatorIntent } from '@openheaders/core/sync';
import type { LiveFallbackPriorityMember } from '@openheaders/core/types';

export type LiveFallbackPriorityMutationPayload = MutatorIntent;

export interface EnlistFallbackPriorityInput {
  member: LiveFallbackPriorityMember;
}

export function buildEnlistFallbackPriorityBatch(
  input: EnlistFallbackPriorityInput,
  ctx: MutatorContext,
): LiveFallbackPriorityMutationPayload {
  return enlistFallbackPriorityMember(ctx, input);
}
