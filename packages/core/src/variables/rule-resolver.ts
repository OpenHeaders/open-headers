/**
 * Rule resolver — applies VariableResolver to V5.Rule fields.
 *
 * Resolves all {{VAR}} templates in rule string fields (domains, values,
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
} from '../types/v5';
import type { VariableResolver } from './resolver';

// ── Single-rule resolution ────────────────────────────────────────

/**
 * Resolve all {{VAR}} templates in a rule's string fields.
 * Returns a new rule object with all templates interpolated.
 * Unresolved variables are left as-is in the output.
 */
export function resolveRule(rule: Rule, resolver: VariableResolver, context?: ResolutionContext): Rule {
  const resolvedDomains = resolveStrings(rule.domains, resolver, context);
  const resolvedUrlPatterns = rule.urlPatterns ? resolveStrings(rule.urlPatterns, resolver, context) : undefined;

  const base = {
    ...rule,
    domains: resolvedDomains,
    ...(resolvedUrlPatterns ? { urlPatterns: resolvedUrlPatterns } : {}),
  };

  switch (rule.type) {
    case 'header':
      return resolveHeaderRule(base as HeaderRule, resolver, context);
    case 'redirect':
      return resolveRedirectRule(base as RedirectRule, resolver, context);
    case 'body':
      return resolveBodyRule(base as BodyRule, resolver, context);
    case 'inject':
      return resolveInjectRule(base as InjectRule, resolver, context);
    case 'block':
      return resolveBlockRule(base as BlockRule, resolver, context);
    case 'delay':
      return base as DelayRule;
    case 'mock':
      return resolveMockRule(base as MockRule, resolver, context);
    case 'query-param':
      return resolveQueryParamRule(base as QueryParamRule, resolver, context);
  }
}

/**
 * Resolve all rules in a list. Convenience wrapper.
 */
export function resolveRules(rules: Rule[], resolver: VariableResolver, context?: ResolutionContext): Rule[] {
  return rules.map((rule) => resolveRule(rule, resolver, context));
}

// ── Per-type resolvers ────────────────────────────────────────────

function resolveHeaderRule(rule: HeaderRule, resolver: VariableResolver, context?: ResolutionContext): HeaderRule {
  return {
    ...rule,
    staticValue: rule.staticValue ? resolveString(rule.staticValue, resolver, context) : undefined,
  };
}

function resolveRedirectRule(
  rule: RedirectRule,
  resolver: VariableResolver,
  context?: ResolutionContext,
): RedirectRule {
  return {
    ...rule,
    action: {
      ...rule.action,
      matchPattern: resolveString(rule.action.matchPattern, resolver, context),
      redirectTo: resolveString(rule.action.redirectTo, resolver, context),
    },
  };
}

function resolveBodyRule(rule: BodyRule, resolver: VariableResolver, context?: ResolutionContext): BodyRule {
  return {
    ...rule,
    action: {
      ...rule.action,
      matchPattern: resolveString(rule.action.matchPattern, resolver, context),
      replaceWith: resolveString(rule.action.replaceWith, resolver, context),
    },
  };
}

function resolveInjectRule(rule: InjectRule, resolver: VariableResolver, context?: ResolutionContext): InjectRule {
  return {
    ...rule,
    action: {
      ...rule.action,
      code: resolveString(rule.action.code, resolver, context),
    },
  };
}

function resolveBlockRule(rule: BlockRule, resolver: VariableResolver, context?: ResolutionContext): BlockRule {
  return {
    ...rule,
    action: {
      ...rule.action,
      responseBody: rule.action.responseBody
        ? resolveString(rule.action.responseBody, resolver, context)
        : undefined,
    },
  };
}

function resolveMockRule(rule: MockRule, resolver: VariableResolver, context?: ResolutionContext): MockRule {
  const resolvedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(rule.action.responseHeaders)) {
    resolvedHeaders[key] = resolveString(value, resolver, context);
  }

  return {
    ...rule,
    action: {
      ...rule.action,
      responseBody: resolveString(rule.action.responseBody, resolver, context),
      responseHeaders: resolvedHeaders,
    },
  };
}

function resolveQueryParamRule(
  rule: QueryParamRule,
  resolver: VariableResolver,
  context?: ResolutionContext,
): QueryParamRule {
  return {
    ...rule,
    action: {
      ...rule.action,
      params: rule.action.params.map((entry) => ({
        ...entry,
        param: resolveString(entry.param, resolver, context),
        value: entry.value ? resolveString(entry.value, resolver, context) : undefined,
      })),
    },
  };
}

// ── String resolution helpers ─────────────────────────────────────

function resolveString(template: string, resolver: VariableResolver, context?: ResolutionContext): string {
  return resolver.resolveTemplate(template, context).result;
}

function resolveStrings(templates: string[], resolver: VariableResolver, context?: ResolutionContext): string[] {
  return templates.map((t) => resolveString(t, resolver, context));
}
