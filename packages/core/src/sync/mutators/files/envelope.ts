/**
 * Internal helpers — mint envelopes + batches from files mutator
 * arguments. Mirrors `pause-markers/envelope.ts`.
 */

import {
  type MutationBatch,
  type MutationBody,
  type MutationEnvelope,
  newBatchId,
  newMutationId,
} from '../../envelope';
import type { MutatorContext } from '../types';

/** Files mutator catalog version — bump on any wire-incompatible change (§13.4). */
export const FILES_MUTATOR_VERSION = 1;

export function mintEnvelope(ctx: MutatorContext, body: MutationBody): MutationEnvelope {
  return {
    mutationId: newMutationId(),
    hlc: ctx.hlc,
    origin: { surfaceId: ctx.surfaceId, deviceId: ctx.deviceId, userId: ctx.userId },
    workspaceId: ctx.workspaceId,
    mutatorVersion: FILES_MUTATOR_VERSION,
    body,
  };
}

export function mintBatch(ctx: MutatorContext, bodies: MutationBody[]): MutationBatch {
  return {
    batchId: ctx.batchId ?? newBatchId(),
    mutations: bodies.map((b) => mintEnvelope(ctx, b)),
  };
}
