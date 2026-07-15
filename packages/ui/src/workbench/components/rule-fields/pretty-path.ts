/**
 * Rule path → human-readable label.
 *
 * Thin wrapper around `ruleResolveAdapter.prettyPath`. The generic
 * `prettyPathMap(adapter, entity, paths)` helper in
 * `shared/conflicts/conflict-adapters.ts` is the entity-agnostic
 * version; this file binds it to the rule adapter for back-compat
 * with existing rule callers.
 */

import type { Rule } from '@openheaders/core/types';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { prettyPathMap } from '@openheaders/ui/shared/conflicts/conflict-adapters';
import { ruleResolveAdapter } from './rule-resolve-adapter';

export function prettyRulePath(t: Translate, rule: Rule, path: string): string {
  return ruleResolveAdapter.prettyPath(t, rule, path);
}

export function prettyRulePathMap(t: Translate, rule: Rule, paths: Iterable<string>): Map<string, string> {
  return prettyPathMap(t, ruleResolveAdapter, rule, paths);
}
