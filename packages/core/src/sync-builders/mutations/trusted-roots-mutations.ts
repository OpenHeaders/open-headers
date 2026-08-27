/**
 * Trusted-roots write-site → oracle helpers.
 *
 * Mirrors `vault-mutations.ts`. Pure transforms from the catalog
 * factory in `@openheaders/core/sync` and a {@link MutatorContext} —
 * no oracle reads, no IO. Rows carry a stable `uid` that doubles as
 * the sync engine's itemId; `buildSetTrustedRootBatch` upserts the
 * whole record, `buildRemoveTrustedRootBatch` keys by uid.
 */

import { type MutatorContext, type MutatorIntent, removeTrustedRoot, setTrustedRoot } from '@openheaders/core/sync';
import type { TrustedRoot } from '@openheaders/core/types';

export type TrustedRootsMutationPayload = MutatorIntent;

export interface SetTrustedRootInput {
  root: TrustedRoot;
  orderKey?: string;
}

export function buildSetTrustedRootBatch(input: SetTrustedRootInput, ctx: MutatorContext): TrustedRootsMutationPayload {
  return setTrustedRoot(ctx, input);
}

export interface RemoveTrustedRootInput {
  uid: string;
}

export function buildRemoveTrustedRootBatch(
  input: RemoveTrustedRootInput,
  ctx: MutatorContext,
): TrustedRootsMutationPayload {
  return removeTrustedRoot(ctx, input);
}
