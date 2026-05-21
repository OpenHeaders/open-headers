/**
 * Side-effect intent factory for live-workflow mutations.
 *
 * Workflow `enabled` flips, refresh-policy swaps, and step-list
 * replacements can all change resolution outcomes for any LV bound to
 * the workflow — as can create / delete. Reuses the existing
 * `INVALIDATE_RESOLVER` kind so the SW runner stays a single drain
 * pipeline; the runner coalesces by `(kind, key)` with latest-HLC
 * wins.
 */

import type { MutationEnvelope } from '../../envelope';
import type { HLC } from '../../hlc';
import { INVALIDATE_RESOLVER } from '../environment/side-effects';
import type { SideEffectIntent } from '../types';
import { LIVE_WORKFLOW_ENTITY_TYPE } from './types';

export { INVALIDATE_RESOLVER } from '../environment/side-effects';

export function invalidateResolverIntent(workflowUid: string, hlc: HLC): SideEffectIntent {
  return { kind: INVALIDATE_RESOLVER, key: workflowUid, hlc };
}

/**
 * Pure derivation: the side-effect intents a host must enqueue for a
 * committed live-workflow envelope. Every workflow mutation — create,
 * delete, scalar set/unset — invalidates the resolver, keyed by the
 * workflow uid.
 *
 * Used in both directions — mint-side by the live-workflow mutators,
 * receive-side by `deriveSideEffectsForEnvelope` — so an inbound
 * workflow edit flushes the resolver on every host that applies it.
 */
export function deriveLiveWorkflowSideEffects(envelope: MutationEnvelope): SideEffectIntent[] {
  const { body, hlc } = envelope;
  if (body.type !== LIVE_WORKFLOW_ENTITY_TYPE) return [];
  return [invalidateResolverIntent(body.id, hlc)];
}
