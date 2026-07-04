/**
 * Future matches — the Request Rules panel's projection section: live
 * rules that WOULD fire if the inspected request were made again but
 * are not part of the captured fire snapshot. Closes the feedback loop
 * for rules created from the panel itself — the new rule shows up here
 * the moment it saves, instead of only after a re-request.
 *
 * Evaluated axes (mirroring the SW's DNR plane where a past capture
 * lets us): publication + enabled gates, template-resolved URL
 * conditions (url-filter / url-regex / request-domains, plus
 * exclude-request-domains), and request methods. Conditions that need
 * request context we can't replay (initiator domains, resource types,
 * response headers, domain-type) pass through — the section's "would"
 * language carries that imprecision, the same heuristic standard as
 * the header popover's Future row (`rule-applicability.ts`).
 */

import type { Collection, Rule, RuleCondition } from '@openheaders/core/types';
import { doesHostMatchDomains, doesUrlMatchRule, getRuleMatchPatterns } from '@openheaders/core/utils';
import { resolveRuleConditions, type VariableResolver } from '@openheaders/core/variables';
import { useVariableResolver } from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { useMemo } from 'react';
import type { InspectorRowWithFires } from './inspector-row-projection';
import { findRuleCollectionId } from './rule-create/rule-collection';
import type { RulesByUid } from './rule-create/use-rules-lookup';

export interface FutureMatchInputs {
  /** Live rule registry (all rules, drafts included — gated below). */
  rules: Iterable<Rule>;
  /** Rules already in the capture's fire snapshot — never projected. */
  firedRuleUids: ReadonlySet<string>;
  url: string;
  method: string;
  resolver: VariableResolver;
  /** For `{{collection.X}}` resolution inside condition templates. */
  localCollections: readonly Collection[];
}

export function computeFutureMatches({
  rules,
  firedRuleUids,
  url,
  method,
  resolver,
  localCollections,
}: FutureMatchInputs): Rule[] {
  const out: Rule[] = [];
  for (const rule of rules) {
    if (firedRuleUids.has(rule.uid)) continue;
    // Only published + enabled rules reach the wire — same gate the SW
    // compiler applies.
    if (rule.published !== true || rule.enabled === false) continue;
    if (!methodAllowed(rule.conditions, method)) continue;
    const collectionId = findRuleCollectionId(rule, localCollections);
    const ctx = collectionId ? { collectionId } : undefined;
    const resolved = resolveRuleConditions(rule.conditions, resolver, ctx);
    const ruleForMatcher = { ...rule, conditions: resolved };
    // No URL conditions = the wire plane matches every URL; with
    // conditions, the row's URL must hit one of them.
    if (getRuleMatchPatterns(ruleForMatcher).length > 0 && !doesUrlMatchRule(url, ruleForMatcher)) continue;
    if (excludedByDomain(resolved, url)) continue;
    out.push(rule);
  }
  return out;
}

function methodAllowed(conditions: readonly RuleCondition[], method: string): boolean {
  const m = method.toLowerCase();
  for (const c of conditions) {
    if (c.type === 'request-methods' && !c.values.some((v) => v.toLowerCase() === m)) return false;
    if (c.type === 'exclude-request-methods' && c.values.some((v) => v.toLowerCase() === m)) return false;
  }
  return true;
}

function excludedByDomain(conditions: readonly RuleCondition[], url: string): boolean {
  const excluded = conditions.filter((c) => c.type === 'exclude-request-domains').flatMap((c) => c.values);
  if (excluded.length === 0) return false;
  try {
    return doesHostMatchDomains(new URL(url).hostname, excluded);
  } catch {
    return false;
  }
}

/** Reactive projection for the selected row — recomputes as rules,
 *  variables or the selection change. */
export function useFutureMatches(row: InspectorRowWithFires | null, rulesByUid: RulesByUid): Rule[] {
  const resolver = useVariableResolver();
  const { localCollections } = useRules();
  return useMemo(() => {
    if (!row) return [];
    const firedRuleUids = new Set(row.fires.map((f) => f.ruleUid));
    return computeFutureMatches({
      rules: rulesByUid.values(),
      firedRuleUids,
      url: row.lifecycle.url,
      method: row.lifecycle.method,
      resolver,
      localCollections,
    });
  }, [row, rulesByUid, resolver, localCollections]);
}
