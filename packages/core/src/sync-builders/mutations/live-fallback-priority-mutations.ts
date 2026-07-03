/**
 * Live-fallback-priority write-site → oracle helper.
 *
 * Produces a `(MutationBatch, SideEffectIntent[])` pair from the catalog
 * factories in `@openheaders/core/sync` and a {@link MutatorContext}. Pure
 * transform — no oracle reads, no IO. Two write paths feed in:
 *   - the host-neutral auto-seed pass (a same-device host enlisting
 *     itself once it holds an exclusive workflow's consumed seed), and
 *   - the renderer management UI (reorder + prune).
 *
 * Singleton entity — no id arg on the catalog factory. Members are keyed
 * by `Principal.id`.
 */

import {
  enlistFallbackPriorityMember,
  type MutatorContext,
  type MutatorIntent,
  pruneFallbackPriorityMember,
  reorderFallbackPriorityMembers,
} from '@openheaders/core/sync';
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

export interface ReorderFallbackPriorityInput {
  /** The full member set in the desired new order; ranks are re-stamped from index. */
  orderedMembers: readonly LiveFallbackPriorityMember[];
}

export function buildReorderFallbackPriorityBatch(
  input: ReorderFallbackPriorityInput,
  ctx: MutatorContext,
): LiveFallbackPriorityMutationPayload {
  return reorderFallbackPriorityMembers(ctx, input);
}

export interface PruneFallbackPriorityInput {
  principalId: string;
}

export function buildPruneFallbackPriorityBatch(
  input: PruneFallbackPriorityInput,
  ctx: MutatorContext,
): LiveFallbackPriorityMutationPayload {
  return pruneFallbackPriorityMember(ctx, input);
}
