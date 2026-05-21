/**
 * Side-effect intent factory for live-variable mutations.
 *
 * Every LV edit invalidates the variable-resolver cache for the
 * affected key — create / delete adds or removes a `{{live.<name>}}`
 * namespace entry, and every scalar write (binding swap, `enabled`
 * flip, manual-override toggle) changes the resolved value. Reuses the
 * existing `INVALIDATE_RESOLVER` kind so the SW runner stays a single
 * drain pipeline; the runner coalesces by `(kind, key)` with
 * latest-HLC wins.
 */

import type { MutationEnvelope } from '../../envelope';
import type { HLC } from '../../hlc';
import { INVALIDATE_RESOLVER } from '../environment/side-effects';
import type { SideEffectIntent } from '../types';
import { LIVE_VARIABLE_ENTITY_TYPE } from './types';

export { INVALIDATE_RESOLVER } from '../environment/side-effects';

export function invalidateResolverIntent(liveVariableUid: string, hlc: HLC): SideEffectIntent {
  return { kind: INVALIDATE_RESOLVER, key: liveVariableUid, hlc };
}

/**
 * Pure derivation: the side-effect intents a host must enqueue for a
 * committed live-variable envelope. Every LV mutation — create,
 * delete, scalar set/unset — invalidates the resolver, keyed by the
 * LV uid.
 *
 * Used in both directions — mint-side by the live-variable mutators,
 * receive-side by `deriveSideEffectsForEnvelope` — so an inbound LV
 * edit flushes the resolver on every host that applies it.
 */
export function deriveLiveVariableSideEffects(envelope: MutationEnvelope): SideEffectIntent[] {
  const { body, hlc } = envelope;
  if (body.type !== LIVE_VARIABLE_ENTITY_TYPE) return [];
  return [invalidateResolverIntent(body.id, hlc)];
}
