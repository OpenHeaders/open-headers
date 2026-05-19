/**
 * Internal helpers — mint envelopes + batches from oauth-bundle
 * mutator arguments. Mirrors the other catalogs.
 */

import { type MutationBatch, type MutationBody, type MutationEnvelope, newBatchId, newMutationId, PRE_BOOTSTRAP_ORG_ID } from '../../envelope';
import type { MutatorContext } from '../types';

/** OAuth-bundle mutator catalog version — bump on any wire-incompatible change (§13.4). */
export const OAUTH_BUNDLE_MUTATOR_VERSION = 1;

export function mintEnvelope(ctx: MutatorContext, body: MutationBody): MutationEnvelope {
  return {
    mutationId: newMutationId(),
    hlc: ctx.hlc,
    origin: { surfaceId: ctx.surfaceId, deviceId: ctx.deviceId, userId: ctx.userId },
    workspaceId: ctx.workspaceId,
    orgId: ctx.orgId ?? PRE_BOOTSTRAP_ORG_ID,
    mutatorVersion: OAUTH_BUNDLE_MUTATOR_VERSION,
    body,
  };
}

export function mintBatch(ctx: MutatorContext, bodies: MutationBody[]): MutationBatch {
  return {
    batchId: ctx.batchId ?? newBatchId(),
    mutations: bodies.map((b) => mintEnvelope(ctx, b)),
  };
}
