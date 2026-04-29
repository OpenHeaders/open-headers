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

import type { HLC } from '../../hlc';
import type { SideEffectIntent } from '../types';
import { RECOMPILE_DNR } from '../rule/side-effects';
import { PAUSE_MARKERS_ID } from './types';

export { RECOMPILE_DNR };

export function recompileDnrIntent(hlc: HLC): SideEffectIntent {
  return { kind: RECOMPILE_DNR, key: PAUSE_MARKERS_ID, hlc };
}
