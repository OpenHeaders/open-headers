/**
 * Rule resolver — applies VariableResolver to V5.Rule fields.
 *
 * Resolves all {{VAR}} templates in rule string fields (conditions, values,
 * patterns, etc.) producing rules that are ready for wire transmission
 * or direct application.
 *
 * Resolution is context-aware: if a rule belongs to a specific collection,
 * collection-scoped variables are included in resolution.
 */

import type {
  BlockRule,
  BodyRule,
  DelayRule,
  HeaderRule,
  InjectRule,
  MockRule,
  QueryParamRule,
  RedirectRule,
  ResolutionContext,
  Rule,
  RuleCondition,
} from '../types/v5';
import type { ResolutionError, VariableResolver } from './resolver';

// ── Single-rule resolution ────────────────────────────────────────

/**
 * A rule plus every `{{VAR}}` reference that failed to resolve while
 * interpolating it. Errors are deduped by `reference` — a rule that
 * references `{{env.API_URL}}` in ten fields produces one entry.
 */
export interface RuleResolution {
  rule: Rule;
  errors: ResolutionError[];
}

/**
 * Resolve all {{VAR}} templates in a rule's string fields AND return
 * every resolution failure encountered. This is the richer entry point
 * that downstream compile pipelines use to surface broken references
 * to the user before the rule hits the wire with a literal `{{X}}` in
 * its pattern — see `rule-engine`'s Status reporting.
 */
export function resolveRuleWithDiagnostics(
  rule: Rule,
  resolver: VariableResolver,
  context?: ResolutionContext,
): RuleResolution {
  const collector: ResolutionError[] = [];
  const resolvedRule = walkRule(rule, resolver, context, collector);
  return { rule: resolvedRule, errors: dedupeErrors(collector) };
}

/**
 * Resolve all {{VAR}} templates in a rule's string fields.
 * Returns a new rule object with all templates interpolated.
 * Unresolved variables are left as-is in the output — for callers that
 * need the error list, use `resolveRuleWithDiagnostics`.
 */
export function resolveRule(rule: Rule, resolver: VariableResolver, context?: ResolutionContext): Rule {
  return walkRule(rule, resolver, context, undefined);
}

function walkRule(
  rule: Rule,
  resolver: VariableResolver,
  context: ResolutionContext | undefined,
  errors: ResolutionError[] | undefined,
): Rule {
  const resolvedConditions = resolveConditions(rule.conditions, resolver, context, errors);

  const base = {
    ...rule,
    conditions: resolvedConditions,
  };

  switch (rule.type) {
    case 'header':
      return resolveHeaderRule(base as HeaderRule, resolver, context, errors);
    case 'redirect':
      return resolveRedirectRule(base as RedirectRule, resolver, context, errors);
    case 'body':
      return resolveBodyRule(base as BodyRule, resolver, context, errors);
    case 'inject':
      return resolveInjectRule(base as InjectRule, resolver, context, errors);
    case 'block':
      // Block has no resolvable action fields — pass through.
      return base as BlockRule;
    case 'delay':
      return base as DelayRule;
    case 'mock':
      return resolveMockRule(base as MockRule, resolver, context, errors);
    case 'query-param':
      return resolveQueryParamRule(base as QueryParamRule, resolver, context, errors);
  }
}

/**
 * Resolve all rules in a list. Convenience wrapper.
 */
export function resolveRules(rules: Rule[], resolver: VariableResolver, context?: ResolutionContext): Rule[] {
  return rules.map((rule) => resolveRule(rule, resolver, context));
}

function dedupeErrors(errors: ResolutionError[]): ResolutionError[] {
  const seen = new Set<string>();
  const out: ResolutionError[] = [];
  for (const e of errors) {
    if (seen.has(e.reference)) continue;
    seen.add(e.reference);
    out.push(e);
  }
  return out;
}

// ── Condition resolution ─────────────────────────────────────────

/**
 * Condition types whose `values` field is a LIST of independent
 * entries (one hostname per entry, one method per entry, …). For
 * these we expand a comma/newline-separated resolved string into
 * multiple entries so that a template variable carrying a list
 * (`MC2_DOMAINS = "a.com,b.com,c.com"`) round-trips into the right
 * shape — Chrome's `requestDomains` is `string[]`, and a single
 * `'a.com,b.com,c.com'` entry would be rejected as invalid.
 *
 * NOT in this set: `url-filter`, `url-regex`, header conditions,
 * `domain-type`. Those carry a single pattern / single value where
 * a comma is either nonsensical or could be part of a legitimate
 * pattern; splitting would silently corrupt the user's input.
 */
const LIST_CONDITION_TYPES: ReadonlySet<RuleCondition['type']> = new Set([
  'request-domains',
  'exclude-request-domains',
  'initiator-domains',
  'exclude-initiator-domains',
  'request-methods',
  'exclude-request-methods',
  'resource-types',
  'exclude-resource-types',
]);

function resolveConditions(
  conditions: RuleCondition[],
  resolver: VariableResolver,
  context: ResolutionContext | undefined,
  errors: ResolutionError[] | undefined,
): RuleCondition[] {
  return conditions.map((c) => {
    const resolved = resolveStrings(c.values, resolver, context, errors);
    // Mirror the editor's `[,\n]` split semantics post-resolution so a
    // template variable carrying a comma-separated list lands as
    // multiple entries instead of one literal string.
    const values = LIST_CONDITION_TYPES.has(c.type) ? expandListEntries(resolved) : resolved;
    return {
      ...c,
      values,
      ...(c.headerName ? { headerName: resolveString(c.headerName, resolver, context, errors) } : {}),
    };
  });
}

function expandListEntries(values: readonly string[]): string[] {
  const out: string[] = [];
  for (const entry of values) {
    for (const piece of entry.split(/[,\n]/)) {
      const trimmed = piece.trim();
      if (trimmed) out.push(trimmed);
    }
  }
  return out;
}

// ── Per-type resolvers ────────────────────────────────────────────

function resolveHeaderRule(
  rule: HeaderRule,
  resolver: VariableResolver,
  context: ResolutionContext | undefined,
  errors: ResolutionError[] | undefined,
): HeaderRule {
  const resolveMods = (mods: HeaderRule['action']['requestHeaders']) =>
    mods.map((m) => ({
      ...m,
      // Header names may contain `{{var}}` segments — resolve them
      // alongside `value` so the DNR builder receives a literal HTTP
      // token. Invalid resolutions are gated by `validateHeaderName`
      // in the builder and the rule is skipped.
      headerName: m.headerName ? resolveString(m.headerName, resolver, context, errors) : m.headerName,
      value: m.value ? resolveString(m.value, resolver, context, errors) : undefined,
      // Merge separator may also reference variables (rare but
      // symmetric). Resolve so the wire gets a literal byte sequence.
      ...(m.operation === 'merge' && m.mergeSeparator
        ? { mergeSeparator: resolveString(m.mergeSeparator, resolver, context, errors) }
        : {}),
    }));
  return {
    ...rule,
    action: {
      requestHeaders: resolveMods(rule.action.requestHeaders ?? []),
      responseHeaders: resolveMods(rule.action.responseHeaders ?? []),
    },
  };
}

function resolveRedirectRule(
  rule: RedirectRule,
  resolver: VariableResolver,
  context: ResolutionContext | undefined,
  errors: ResolutionError[] | undefined,
): RedirectRule {
  return {
    ...rule,
    action: {
      ...rule.action,
      redirectTo: resolveString(rule.action.redirectTo, resolver, context, errors),
    },
  };
}

function resolveBodyRule(
  rule: BodyRule,
  resolver: VariableResolver,
  context: ResolutionContext | undefined,
  errors: ResolutionError[] | undefined,
): BodyRule {
  return {
    ...rule,
    action: {
      ...rule.action,
      // Only resolve variables in static body content, not in dynamic JS code
      body:
        rule.action.bodyType === 'static'
          ? resolveString(rule.action.body, resolver, context, errors)
          : rule.action.body,
    },
  };
}

function resolveInjectRule(
  rule: InjectRule,
  resolver: VariableResolver,
  context: ResolutionContext | undefined,
  errors: ResolutionError[] | undefined,
): InjectRule {
  return {
    ...rule,
    action: {
      ...rule.action,
      code: resolveString(rule.action.code, resolver, context, errors),
    },
  };
}

function resolveMockRule(
  rule: MockRule,
  resolver: VariableResolver,
  context: ResolutionContext | undefined,
  errors: ResolutionError[] | undefined,
): MockRule {
  const resolvedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(rule.action.responseHeaders)) {
    resolvedHeaders[key] = resolveString(value, resolver, context, errors);
  }

  return {
    ...rule,
    action: {
      ...rule.action,
      responseBody: resolveString(rule.action.responseBody, resolver, context, errors),
      responseHeaders: resolvedHeaders,
    },
  };
}

function resolveQueryParamRule(
  rule: QueryParamRule,
  resolver: VariableResolver,
  context: ResolutionContext | undefined,
  errors: ResolutionError[] | undefined,
): QueryParamRule {
  return {
    ...rule,
    action: {
      ...rule.action,
      params: rule.action.params.map((entry) => ({
        ...entry,
        param: resolveString(entry.param, resolver, context, errors),
        value: entry.value ? resolveString(entry.value, resolver, context, errors) : undefined,
      })),
    },
  };
}

// ── String resolution helpers ─────────────────────────────────────

function resolveString(
  template: string,
  resolver: VariableResolver,
  context: ResolutionContext | undefined,
  errors: ResolutionError[] | undefined,
): string {
  const { result, errors: templateErrors } = resolver.resolveTemplate(template, context);
  if (errors && templateErrors.length > 0) {
    for (const err of templateErrors) errors.push(err);
  }
  return result;
}

function resolveStrings(
  templates: string[],
  resolver: VariableResolver,
  context: ResolutionContext | undefined,
  errors: ResolutionError[] | undefined,
): string[] {
  return templates.map((t) => resolveString(t, resolver, context, errors));
}
