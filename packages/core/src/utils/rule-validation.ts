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
import type { ResolutionContext, ResolvedVariable } from '../types/v5/variable';
import {
  collectRuleTemplateStrings,
  type ResolutionEnvSnapshot,
  resolveTemplate,
  type ScopedLookupFn,
} from '../variables';
import { validateActionValues } from './action-validation';
import { validateConditionValues, validateDomainValues } from './condition-validation';
import { getHeaderOperationCapability } from './headers';
import { type PauseMarkers, resolvePauseState } from './pause';

/**
 * Check whether a rule has all required fields to function.
 * Returns true if the rule can be activated, false if it's incomplete.
 *
 * Every rule needs at least one condition with a non-empty value. Per-type checks:
 *   - header: headerName required; value required unless operation is 'remove'
 *   - block: conditions only (action has no fields)
 *   - redirect: redirectTo
 *   - query-param: at least one param entry with a non-empty param name
 *   - inject: code (inline) or sourceUrl (URL mode) must be non-empty
 *   - body: body content non-empty
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

  // Per-condition input validation. A rule whose conditions carry values
  // Chrome's DNR will reject — bare regex syntax in `request-domains`,
  // a `request-methods` value that isn't an HTTP method, an unparseable
  // url-regex, etc. — is treated as INCOMPLETE rather than allowed to
  // reach Chrome and atomically fail an `updateDynamicRules` batch.
  //
  // Only `severity: 'error'` issues from `validateConditionValues` and
  // non-fixable kinds from `validateDomainValues` (`non-ascii`, `empty`)
  // gate completeness. Warnings (regex-looking url-filter, RE2 lookbehind,
  // etc.) and auto-fixable domain mistakes (wildcards, ports, schemes,
  // uppercase) stay advisory — the editor surfaces them inline; the rule
  // still compiles. Incompleteness is for things the rule can't recover
  // from without user intervention.
  for (const c of base.conditions) {
    if (validateConditionValues(c).some((i) => i.severity === 'error')) return false;
    if (validateDomainValues(c).some((i) => i.kind === 'non-ascii' || i.kind === 'empty')) return false;
  }

  // Per-type action input validation. Same gating contract as conditions:
  // `severity: 'error'` means Chrome / scriptable layer would reject the
  // value, so the rule is INCOMPLETE (saves but doesn't compile) until
  // fixed. Warnings (status code outside 100-599 on a `block` rule that
  // ignores it; delay over the platform cap; content-type without
  // subtype) stay advisory and don't gate.
  if (validateActionValues(rule).some((i) => i.severity === 'error')) return false;

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

// ── Variable-resolution gating ─────────────────────────────────────

/**
 * Does every `{{...}}` reference in this rule resolve against the
 * supplied lookups? Returns true iff the rule's templates would
 * produce zero blocking resolution errors in
 * {@link resolveTemplate}.
 *
 * "Blocking" excludes the `reserved-namespace` error class —
 * references like `{{file.X}}` / `{{dynamic.X}}` are intentionally
 * unresolved until those features ship and should not prevent a rule
 * from taking effect. Every other failure class
 * (`unresolved`, `unset-in-scope`, `unknown-namespace`,
 * `step-out-of-context`, `empty`) indicates a rule the user probably
 * didn't want to execute — injecting the literal `{{env.URL}}` string
 * onto the wire is almost never the intent.
 *
 * Pure — no resolver instance required. Callers supply the same
 * lookup shape `resolveTemplate` takes, so the core fn can be used
 * from any layer (extension DNR compile, desktop rule evaluation,
 * CLI validation).
 */
export function isRuleResolvable(
  rule: Rule | Omit<Rule, 'uid' | 'path'>,
  lookup: (name: string) => ResolvedVariable | null,
  scopedLookup?: ScopedLookupFn,
  env?: ResolutionEnvSnapshot,
  context?: ResolutionContext,
): boolean {
  // `collectRuleTemplateStrings` currently needs the uid/path-bearing
  // `Rule` shape in its type; safe because the walker only reads
  // `conditions` + `action.*`. Draft rules (no uid) call the same
  // walker by casting — matches how `isRuleComplete` handles drafts.
  const strings = collectRuleTemplateStrings(rule as Rule);
  // `context` isn't consumed by `resolveTemplate` directly — the
  // lookups are expected to already be bound to the relevant context
  // (collection id, env id). We pass it through for future extension
  // where callers prefer context-aware lookups without pre-binding.
  void context;
  for (const s of strings) {
    if (!s) continue;
    const { errors } = resolveTemplate(s, lookup, scopedLookup, env);
    for (const e of errors) {
      if (e.reason === 'reserved-namespace') continue;
      return false;
    }
  }
  return true;
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
