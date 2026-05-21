/**
 * Side-effect intent factories for pause-markers mutations.
 *
 * Pause markers shape the effective rule set (an ancestor `'paused'`
 * marker disables every rule under it; a deeper `'unpaused'` override
 * re-enables a subtree). Every change therefore needs a DNR recompile.
 * Reuses the existing `RECOMPILE_DNR` intent kind (Rule mutators emit
 * the same kind keyed by ruleUid); the dnr-intent runner widens its
 * entity-type filter to include this entity so one runner covers both
 * lanes.
 *
 * Coalescing key is the singleton id so every pause-markers edit
 * collapses into one recompile per HLC tick — `scheduleUpdate('rules')`
 * is itself debounced + hash-guarded, so even rapid toggles converge
 * to one DNR write.
 */

import type { MutationEnvelope } from '../../envelope';
import type { HLC } from '../../hlc';
import { RECOMPILE_DNR } from '../rule/side-effects';
import type { SideEffectIntent } from '../types';
import { PAUSE_MARKERS_ENTITY_TYPE, PAUSE_MARKERS_ID } from './types';

export { RECOMPILE_DNR };

export function recompileDnrIntent(hlc: HLC): SideEffectIntent {
  return { kind: RECOMPILE_DNR, key: PAUSE_MARKERS_ID, hlc };
}

/**
 * Pure derivation: the side-effect intents a host must enqueue for a
 * committed pause-markers envelope. Every marker change reshapes the
 * effective rule set, so each emits one `RECOMPILE_DNR` intent keyed
 * by the singleton id. Receive-side counterpart of the inline emission
 * the pause-markers mutators do at mint time.
 */
export function derivePauseMarkersSideEffects(envelope: MutationEnvelope): SideEffectIntent[] {
  if (envelope.body.type !== PAUSE_MARKERS_ENTITY_TYPE) return [];
  return [recompileDnrIntent(envelope.hlc)];
}
