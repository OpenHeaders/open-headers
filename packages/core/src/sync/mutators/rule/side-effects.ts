/**
 * Side-effect intent factories for rule mutations.
 *
 * Today there's exactly one side effect: DNR recompile. The runner
 * (S2 — not landed yet) will coalesce by `(kind, key)` with
 * latest-HLC wins, then read the materialized snapshot at execution
 * time (S4) so it picks up every batched change.
 */

import type { HLC } from '../../hlc';
import type { SideEffectIntent } from '../types';

export const RECOMPILE_DNR = 'recompile-dnr';

/**
 * Intent: re-derive DNR rule list for `ruleUid` and push it through
 * `chrome.declarativeNetRequest.updateDynamicRules`. Coalescing key
 * is `ruleUid` so a flurry of edits collapses into one recompile.
 */
export function recompileDnrIntent(ruleUid: string, hlc: HLC): SideEffectIntent {
  return { kind: RECOMPILE_DNR, key: ruleUid, hlc };
}
