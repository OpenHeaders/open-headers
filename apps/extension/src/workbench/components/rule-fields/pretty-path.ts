/**
 * Rule path → human-readable label.
 *
 * Thin wrapper around `ruleResolveAdapter.prettyPath`. The generic
 * `prettyPathMap(adapter, entity, paths)` helper in
 * `shared/conflicts/conflict-adapters.ts` is the entity-agnostic
 * version; this file binds it to the rule adapter for back-compat
 * with existing rule callers.
 */

import type { V5 } from '@openheaders/core/types';
import { prettyPathMap } from '@/shared/conflicts/conflict-adapters';
import { ruleResolveAdapter } from './rule-resolve-adapter';

export function prettyRulePath(rule: V5.Rule, path: string): string {
  return ruleResolveAdapter.prettyPath(rule, path);
}

export function prettyRulePathMap(rule: V5.Rule, paths: Iterable<string>): Map<string, string> {
  return prettyPathMap(ruleResolveAdapter, rule, paths);
}
