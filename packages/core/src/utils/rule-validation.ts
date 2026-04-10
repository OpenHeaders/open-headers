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

/**
 * Check whether a rule has all required fields to function.
 * Returns true if the rule can be activated, false if it's incomplete.
 *
 * Every rule needs at least one condition with a non-empty value. Per-type checks:
 *   - header: headerName required; value required unless operation is 'remove'
 *   - block: conditions only (no extra fields)
 *   - redirect: redirectTo
 *   - query-param: at least one param entry with a non-empty param name
 *   - inject: code must be non-empty
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
      const allMods = [...(hr.action.requestHeaders ?? []), ...(hr.action.responseHeaders ?? [])];
      if (allMods.length === 0) return false;
      // Every modification needs a header name, and non-remove operations need a value
      return allMods.every((m) => m.headerName.trim() && (m.operation === 'remove' || m.value?.trim()));
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
      if (!ir.action.code.trim()) return false;
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
