/**
 * Live-variable draft + effectiveness checks. Parallels
 * `workflow-state.ts` and `utils/rule-validation.ts`.
 *
 * LV is a thin binding from a workflow step capture into the
 * `{{live.<name>}}` namespace. It has no structural completeness
 * predicate beyond schema validity (which is enforced at the codec
 * boundary, not here) — the substantive completeness lives on the
 * backing workflow. So `isLiveVariableEffective` collapses to the
 * publication + enabled axes; per-binding validity is the resolver's
 * job (it surfaces unresolved-binding chips at the resolution site,
 * not as a broad "draft" flag).
 */

import type { LiveVariable } from '../types/v5/live';

/**
 * Single source of truth for "is this LV a still-drafting,
 * not-yet-published entity?". Drives draft pill on the tab strip,
 * `row-draft` styling, italic tab label, tab-close discard prompt.
 *
 * Reads `published === true` so both `false` and `undefined` collapse
 * to "draft" — matches `isLiveVariableEffective`'s contract.
 */
export function isLiveVariableDraft(lv: LiveVariable): boolean {
  return lv.published !== true;
}

/**
 * Single source of truth for "will this LV resolve to a value at
 * `{{live.<name>}}` lookup time?". Combines:
 *
 *   - `lv.published === true` — user committed this draft to live state
 *                               (Save = publish). New LVs from
 *                               `+ New Live Variable` start
 *                               `published: false` so per-keystroke
 *                               binding edits don't expose half-typed
 *                               `workflowUid` / `stepId` / `captureName`
 *                               combinations to live template
 *                               resolution.
 *   - `lv.enabled === true`   — user's explicit toggle
 *
 * Resolver call sites that today filter on `lv.enabled` should call
 * this helper instead, and the gate fires at the same chokepoint that
 * already gates rule resolution / suggestion lists / variables panels.
 */
export function isLiveVariableEffective(lv: LiveVariable): boolean {
  if (isLiveVariableDraft(lv)) return false;
  if (lv.enabled !== true) return false;
  return true;
}
