/**
 * Live-value write-site → oracle helpers.
 *
 * Mirrors `oauth-bundle-mutations.ts`. Each helper produces a
 * `(MutationBatch, SideEffectIntent[])` pair from the catalog factory in
 * `@openheaders/core/sync` and a {@link MutatorContext}. Pure transforms
 * — no oracle reads, no IO. The host-neutral `putWorkflowRunCache`
 * (every live runner's success path) and the cache-clear paths consume
 * these.
 *
 * Singleton entity — no id arg on the catalog factories. Members are
 * keyed by run-key (`${workflowUid}:${environmentId ?? '__none__'}`).
 */

import { type MutatorContext, type MutatorIntent, putLiveValue, removeLiveValues } from '@openheaders/core/sync';
import type { LiveValueRecord } from '@openheaders/core/types';

export type LiveValueMutationPayload = MutatorIntent;

export interface PutLiveValueInput {
  runKey: string;
  value: LiveValueRecord;
}

export function buildPutLiveValueBatch(input: PutLiveValueInput, ctx: MutatorContext): LiveValueMutationPayload {
  return putLiveValue(ctx, input);
}

export interface RemoveLiveValuesInput {
  runKeys: readonly string[];
}

export function buildRemoveLiveValuesBatch(
  input: RemoveLiveValuesInput,
  ctx: MutatorContext,
): LiveValueMutationPayload {
  return removeLiveValues(ctx, input);
}
