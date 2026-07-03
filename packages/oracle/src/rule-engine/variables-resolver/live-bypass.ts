// ── Live feedback-loop bypass ───────────────────────────────────────

import { isLiveVariableEffective, scanTemplateReferencesMany } from '@openheaders/core/live';
import type { LiveVariable, Rule } from '@openheaders/core/types';
import { collectRuleTemplateStrings } from '@openheaders/core/variables';
import { getLiveVariables } from '@openheaders/oracle/live/live-variable-store';

const EMPTY_STRING_SET: ReadonlySet<string> = new Set();

/**
 * Collect the set of workflow uids this rule "touches" — i.e., every
 * workflow whose LV bindings appear in any of the rule's templatable
 * strings. Driven from the RAW rule (pre-resolve) because the template
 * literals are what carry `{{live.X}}`; after resolution they've been
 * substituted with values. Called from the DNR compile pipeline so
 * each emitted DnrRule can carry an `excludedRequestHeaders` clause
 * that blocks the rule from firing on its own chain's step requests.
 *
 * Returns an empty set when the rule touches no live variables, or
 * when no matching LV is enabled — disabled bindings don't contribute
 * to the feedback-loop risk (their workflows won't produce values a
 * disabled LV's rule consumes).
 */
export function computeRuleLiveBypass(rule: Rule): ReadonlySet<string> {
  const strings = collectRuleTemplateStrings(rule);
  if (strings.length === 0) return EMPTY_STRING_SET;
  const { live } = scanTemplateReferencesMany(strings);
  if (live.length === 0) return EMPTY_STRING_SET;
  const lvByName = new Map<string, LiveVariable>();
  for (const lv of getLiveVariables()) {
    if (isLiveVariableEffective(lv)) lvByName.set(lv.name, lv);
  }
  const out = new Set<string>();
  for (const name of live) {
    const lv = lvByName.get(name);
    if (lv) out.add(lv.workflowUid);
  }
  return out.size === 0 ? EMPTY_STRING_SET : out;
}
