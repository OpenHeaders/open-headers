/**
 * Layout-state write-site → oracle helpers.
 *
 * Pure transforms — no oracle reads, no IO — used by both the SW
 * (legacy store routing through the oracle) and the renderer
 * (`useLayoutStateMutator` write client). Mirrors
 * `pause-markers-mutations.ts`.
 */

import { type MutatorContext, type MutatorIntent, setLayoutState } from '@openheaders/core/sync';

export type LayoutStateMutationPayload = MutatorIntent;

export interface SetLayoutInput {
  layout: unknown;
}

export function buildSetLayoutBatch(
  input: SetLayoutInput,
  ctx: MutatorContext,
): LayoutStateMutationPayload {
  return setLayoutState(ctx, { layout: input.layout });
}
