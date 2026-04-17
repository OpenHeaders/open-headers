/**
 * Rule completeness validation — shared between desktop and extension.
 *
 * Determines whether a rule has all required fields to be activated.
 * Incomplete rules can still be saved/persisted — they just won't be
 * applied to browser traffic until complete.
 *
 * This is the single source of truth for "can this rule do anything?"
 */

import type { HeaderRule, InjectRule, QueryParamRule, RedirectRule, Rule, RuleBase } from '../types/v5/rule';
import { getHeaderOperationCapability } from './headers';
import { type PauseMarkers, resolvePauseState } from './pause';

/**
 * Check whether a rule has all required fields to function.
 * Returns true if the rule can be activated, false if it's incomplete.
 *
 * Every rule needs at least one condition with a non-empty value. Per-type checks:
 *   - header: headerName required; value required unless operation is 'remove'
 *   - block: conditions only (no extra fields)
 *   - redirect: redirectTo
 *   - query-param: at least one param entry with a non-empty param name
 *   - inject: code (inline) or sourceUrl (URL mode) must be non-empty
 *   - body: matchPattern + replaceWith
 *   - delay: delayMs > 0
 *   - mock: statusCode + responseBody
 */
export function isRuleComplete(rule: Rule | Omit<Rule, 'uid' | 'path'>): boolean {
  const base = rule as RuleBase | Omit<RuleBase, 'uid' | 'path'>;
  if (
    !base.conditions ||
    base.conditions.length === 0 ||
    base.conditions.every((c) => !c.values || c.values.length === 0 || c.values.every((v) => !v.trim()))
  ) {
    return false;
  }

  switch (base.type) {
    case 'header': {
      const hr = rule as HeaderRule | Omit<HeaderRule, 'uid' | 'path'>;
      const reqMods = (hr.action.requestHeaders ?? []).map((m) => ({ mod: m, direction: 'request' as const }));
      const resMods = (hr.action.responseHeaders ?? []).map((m) => ({ mod: m, direction: 'response' as const }));
      const allMods = [...reqMods, ...resMods];
      if (allMods.length === 0) return false;
      // Every modification needs a name, a value (unless 'remove'), AND must be a
      // combination Chrome's DNR will accept — invalid combos (e.g. `append` on a
      // custom X- header) fail the capability check and make the whole rule a draft.
      // Drafts aren't compiled, so they can never leave stale DNR state behind.
      return allMods.every(({ mod, direction }) => {
        if (!mod.headerName.trim()) return false;
        if (mod.operation !== 'remove' && !mod.value?.trim()) return false;
        return getHeaderOperationCapability(direction, mod.operation, mod.headerName).allowed;
      });
    }
    case 'block':
      return true; // conditions is sufficient
    case 'redirect': {
      const rr = rule as RedirectRule | Omit<RedirectRule, 'uid' | 'path'>;
      if (!rr.action.redirectTo.trim()) return false;
      return true;
    }
    case 'query-param': {
      const qr = rule as QueryParamRule | Omit<QueryParamRule, 'uid' | 'path'>;
      if (!qr.action.params || qr.action.params.length === 0) return false;
      if (qr.action.params.every((p) => !p.param.trim())) return false;
      return true;
    }
    case 'inject': {
      const ir = rule as InjectRule | Omit<InjectRule, 'uid' | 'path'>;
      if (ir.action.source === 'url') {
        if (!ir.action.sourceUrl?.trim()) return false;
      } else {
        if (!ir.action.code.trim()) return false;
      }
      return true;
    }
    case 'body': {
      const br = rule as { action: { body: string } };
      if (!br.action.body?.trim()) return false;
      return true;
    }
    case 'delay': {
      const dr = rule as { action: { delayMs: number } };
      if (!dr.action.delayMs || dr.action.delayMs <= 0) return false;
      return true;
    }
    case 'mock': {
      const mr = rule as { action: { statusCode: number; responseBody: string } };
      if (!mr.action.statusCode || !mr.action.responseBody) return false;
      return true;
    }
    default:
      return false;
  }
}

/**
 * Single source of truth for "will this rule actually fire on live
 * traffic right now?". Combines three independent axes:
 *
 *   - `rule.enabled === true`      — user's explicit toggle
 *   - `isRuleComplete(rule)`        — all required fields present; drafts
 *                                     never compile to DNR or fire as
 *                                     scriptable injections
 *   - `!resolvePauseState(path)`    — neither the rule nor any ancestor
 *                                     collection/folder is paused
 *   - `!enginePaused`               — the global `rulesEngine.paused`
 *                                     kill switch isn't on
 *
 * Any place in the extension that needs "effective rule set" — DNR
 * compile loop, rule-state observer snapshot, badge filter, popup
 * display — should call this instead of reimplementing the check.
 */
export function isRuleEffective(rule: Rule, pauseMarkers: PauseMarkers, enginePaused: boolean): boolean {
  if (rule.enabled !== true) return false;
  if (enginePaused) return false;
  if (resolvePauseState(rule.path, pauseMarkers)) return false;
  if (!isRuleComplete(rule)) return false;
  return true;
}
