/**
 * Internal helpers — mint envelopes + batches from script-package
 * mutator arguments. Mirrors the other catalogs.
 */

import {
  type MutationBatch,
  type MutationBody,
  type MutationEnvelope,
  newBatchId,
  newMutationId,
  PRE_BOOTSTRAP_ORG_ID,
} from '../../envelope';
import { tickHlc } from '../../hlc';
import type { MutatorContext } from '../types';

/** Script-package mutator catalog version — bump on any wire-incompatible change (§13.4). */
export const SCRIPT_PACKAGE_MUTATOR_VERSION = 1;

export function mintEnvelope(ctx: MutatorContext, body: MutationBody): MutationEnvelope {
  return {
    mutationId: newMutationId(),
    hlc: ctx.hlc,
    origin: { surfaceId: ctx.surfaceId, deviceId: ctx.deviceId, userId: ctx.userId },
    workspaceId: ctx.workspaceId,
    orgId: ctx.orgId ?? PRE_BOOTSTRAP_ORG_ID,
    mutatorVersion: SCRIPT_PACKAGE_MUTATOR_VERSION,
    body,
  };
}

export function mintBatch(ctx: MutatorContext, bodies: MutationBody[]): MutationBatch {
  return {
    batchId: ctx.batchId ?? newBatchId(),
    mutations: bodies.map((b, i) => mintEnvelope(i === 0 ? ctx : { ...ctx, hlc: tickHlc(ctx.hlc, i) }, b)),
  };
}
