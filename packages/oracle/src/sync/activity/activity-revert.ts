/**
 * F6.d — generate the inverse mutation for an Activity Feed entry.
 *
 * Reads the {@link InverseEnvelopeContext} the F2 classifier embedded on
 * `entry.context.inverse`, validates the proposed inverse against the
 * current materialized state, and mints a fresh {@link MutationBatch}
 * the local oracle can apply. The result rides the same
 * {@link applySyncRequest} path as any user-driven mutation — gets
 * HLC-stamped, broadcast, persisted, and (because the local emit is
 * not in the wire-side seen set) does NOT itself enter the Activity
 * Feed.
 *
 * Decision references:
 *   - Storage strategy: per-mutation `InverseSpec` (see core
 *     `activity/inverse.ts`). The classifier embedded only the minimum
 *     state needed per mutator kind; the generator's job is the
 *     symmetric write-back.
 *   - Delete inversion is structurally unavailable under §7.2
 *     (delete-wins-permanent). The classifier emits the unavailable
 *     sentinel; the generator preserves it.
 *
 * Validation surfaces at revert time:
 *   - `already-tombstoned` — current state has the entity deleted; no
 *     setField / addToSet etc. can land. Refuse cleanly.
 *   - `set-item-moved-away` — the set member the inverse references
 *     has been re-added or moved by another envelope since the prior
 *     was captured. Compute a fresh orderKey against the current view
 *     or refuse, depending on the inverse kind.
 *   - `no-op` — both pre-apply and current state agree on absence
 *     (rare for setField/unsetField), nothing to do.
 *
 * The module is pure of any storage or RPC concern: callers wire it to
 * the RPC dispatcher and the oracle.
 */

import {
  newBatchId,
  newMutationId,
  PRE_BOOTSTRAP_ORG_ID,
  type InverseEnvelopeContext,
  type InverseSpec,
  type MutationBatch,
  type MutationBody,
  type MutationEnvelope,
  type MutatorContext,
} from '@openheaders/core/sync';

import type { EntityOracle } from '../oracle';

export type GenerateInverseResult =
  | { ok: true; batch: MutationBatch }
  | { ok: false; reason: GenerateInverseReason };

export type GenerateInverseReason =
  | 'delete-irreversible'
  | 'no-inverse-recorded'
  | 'no-oracle-for-workspace'
  | 'already-tombstoned'
  | 'set-item-missing'
  | 'no-op';

export interface GenerateInverseInput {
  entityType: string;
  entityId: string;
  inverse: InverseEnvelopeContext;
  oracle: EntityOracle;
  ctx: MutatorContext;
}

/**
 * Build the inverse mutation batch for an inbound envelope, given the
 * spec captured at classification time. Returns either an apply-ready
 * batch or a structured reason for refusal — the caller maps reasons
 * to user-facing copy or telemetry.
 */
export function generateInverseMutation(input: GenerateInverseInput): GenerateInverseResult {
  const { entityType, entityId, inverse, oracle, ctx } = input;

  if (inverse.spec.kind === 'unavailable') {
    return { ok: false, reason: 'delete-irreversible' };
  }

  const current = oracle.materializeOne(entityType, entityId);
  // Tombstones are permanent (§7.2). A non-delete inverse against a
  // tombstoned entity is structurally a no-op — the apply would be
  // rejected by the mutator anyway. Refuse early with a clear reason
  // so the UI surfaces "already deleted" rather than silently
  // committing a doomed envelope.
  if (current === null && inverse.spec.kind !== 'create') {
    return { ok: false, reason: 'already-tombstoned' };
  }

  const body = specToBody(inverse.spec, entityType, entityId, oracle);
  if ('reason' in body) {
    return { ok: false, reason: body.reason };
  }

  const envelope: MutationEnvelope = {
    mutationId: newMutationId(),
    hlc: ctx.hlc,
    origin: { surfaceId: ctx.surfaceId, deviceId: ctx.deviceId, userId: ctx.userId },
    workspaceId: ctx.workspaceId,
    orgId: ctx.orgId ?? PRE_BOOTSTRAP_ORG_ID,
    mutatorVersion: inverse.mutatorVersion,
    body,
  };
  const batch: MutationBatch = {
    batchId: ctx.batchId ?? newBatchId(),
    mutations: [envelope],
  };
  return { ok: true, batch };
}

type BodyResult = MutationBody | { reason: GenerateInverseReason };

/**
 * Translate the captured {@link InverseSpec} into a concrete
 * {@link MutationBody} for the entity. Validations that depend on
 * current state (set-member presence) happen here against the
 * oracle's read-only enumerators — the materialized view strips
 * itemIds, so set-member checks use `liveOrderedSetItems`.
 */
function specToBody(spec: InverseSpec, type: string, id: string, oracle: EntityOracle): BodyResult {
  switch (spec.kind) {
    case 'unavailable':
      // Already short-circuited by the caller; defensive.
      return { reason: 'delete-irreversible' };
    case 'create':
      return { kind: 'delete', type, id };
    case 'setField':
      return spec.priorExists
        ? { kind: 'setField', type, id, path: spec.path, value: spec.priorValue }
        : { kind: 'unsetField', type, id, path: spec.path };
    case 'unsetField':
      // If the prior was also absent, the inbound was a same-path
      // no-op and the inverse has nothing to do.
      if (!spec.priorExists) return { reason: 'no-op' };
      return { kind: 'setField', type, id, path: spec.path, value: spec.priorValue };
    case 'addToSet':
      return { kind: 'removeFromSet', type, id, path: spec.path, itemId: spec.itemId };
    case 'removeFromSet':
      return {
        kind: 'addToSet',
        type,
        id,
        path: spec.path,
        itemId: spec.itemId,
        item: spec.priorItem,
        orderKey: spec.priorOrderKey,
      };
    case 'moveBefore': {
      // The item must still be live in the set; otherwise a
      // `moveBefore` is meaningless and the apply would silently no-op
      // on a tombstoned member. Surface the reason so the UI can
      // explain why Revert was refused.
      const live = oracle.liveOrderedSetItems(type, id, spec.path);
      const found = live.some((entry) => entry.itemId === spec.itemId);
      if (!found) return { reason: 'set-item-missing' };
      return {
        kind: 'moveBefore',
        type,
        id,
        path: spec.path,
        itemId: spec.itemId,
        orderKey: spec.priorOrderKey,
      };
    }
  }
}
