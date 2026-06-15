/**
 * Rule resolver — applies VariableResolver to Rule fields.
 *
 * Resolves all {{VAR}} templates in rule string fields (conditions, values,
 * patterns, etc.) producing rules that are ready for wire transmission
 * or direct application.
 *
 * Resolution is context-aware: if a rule belongs to a specific collection,
 * collection-scoped variables are included in resolution.
 */

import type {
  AuthRule,
  BlockRule,
  BodyRule,
  DelayRule,
  HeaderRule,
  InjectRule,
  QueryParamRule,
  RedirectRule,
  ResolutionContext,
  ResponseRule,
  Rule,
  RuleCondition,
  SseRule,
  WsRule,
} from '../types';
import { isListShapedConditionType } from '../utils/condition-metadata';
import { applyDomainValueCleanup, summarizeDomainIssues, validateDomainValues } from '../utils/condition-validation';
import { buildPostResolveError, type ResolutionError, type VariableResolver } from './resolver';

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
    case 'response':
      return resolveResponseRule(base as ResponseRule, resolver, context, errors);
    case 'query-param':
      return resolveQueryParamRule(base as QueryParamRule, resolver, context, errors);
    case 'ws':
      return resolveWsRule(base as WsRule, resolver, context, errors);
    case 'sse':
      return resolveSseRule(base as SseRule, resolver, context, errors);
    case 'auth':
      return resolveAuthRule(base as AuthRule, resolver, context, errors);
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

// List-shaped condition types — see `isListShapedConditionType` in
// `condition-metadata.ts`. Single source of truth so editor / resolver
// / validator can never disagree about which rows split on `[,\n]`
// after resolution.

/**
 * Public helper for callers that need only the rule's CONDITIONS
 * resolved — the rule-applicability check in the inspector popover,
 * for instance, runs `getRuleMatchPatterns` against the resolved
 * conditions but doesn't care about the action's resolved shape.
 * Walking the full action via `resolveRule` is wasted work for that
 * code path; this entry point lets the caller skip it.
 *
 * Diagnostics: pass an `errors` collector to capture
 * `invalid-resolved-value` errors (post-resolve domain sanitization);
 * pass `undefined` for a silent best-effort resolve.
 */
export function resolveRuleConditions(
  conditions: RuleCondition[],
  resolver: VariableResolver,
  context?: ResolutionContext,
  errors?: ResolutionError[],
): RuleCondition[] {
  return resolveConditions(conditions, resolver, context, errors);
}

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
    const values = isListShapedConditionType(c.type) ? expandListEntries(resolved) : resolved;
    let condition: RuleCondition = {
      ...c,
      values,
      ...(c.headerName ? { headerName: resolveString(c.headerName, resolver, context, errors) } : {}),
    };
    // Post-resolution domain sanitization. The pre-resolve validator
    // (`validateDomainValues` called from the editor) skips template
    // values because it can't see the resolved shape. Once a template
    // expands to e.g. `https://api.foo.com/*` and lands in a
    // `requestDomains` slot, Chrome would reject the entire
    // `updateDynamicRules` batch atomically — leaving the prior
    // ruleset stuck in place with no rule-level error. We sanitize
    // here so the rule degrades gracefully: scheme/path/wildcard
    // strip out, salvageable hostnames survive, and the rule still
    // ships. Pre-resolve feedback already covers the user-typed case;
    // this is the safety net for variable-driven values.
    const domainIssues = validateDomainValues(condition);
    if (domainIssues.length > 0) {
      condition = applyDomainValueCleanup(condition, domainIssues);
      // Surface the sanitization back to the user via the same
      // resolution-errors channel that powers the SW status pill and the
      // editor's RuleResolutionBanner. Attribution: every `{{ref}}` that
      // appears in the original (pre-resolve, pre-list-split) values
      // gets one `invalid-resolved-value` error. We don't know which
      // specific reference contributed the bad characters — they could
      // mix — so blaming all referenced variables is the honest
      // signal. Dedup by reference is performed by the parent
      // `resolveRuleWithDiagnostics` callsite.
      if (errors && domainIssues.length > 0) {
        const env = resolver.getEnvSnapshot(context);
        const issueSummary = summarizeDomainIssues(domainIssues);
        const refsSeen = new Set<string>();
        for (const original of c.values) {
          for (const ref of resolver.extractVariableNames(original)) {
            if (refsSeen.has(ref)) continue;
            refsSeen.add(ref);
            errors.push(
              buildPostResolveError(
                ref,
                'invalid-resolved-value',
                env,
                `Variable resolved to a value Chrome rejects in this slot — ${issueSummary}. Use bare hostnames separated by commas.`,
              ),
            );
          }
        }
      }
    }
    return condition;
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

function resolveResponseRule(
  rule: ResponseRule,
  resolver: VariableResolver,
  context: ResolutionContext | undefined,
  errors: ResolutionError[] | undefined,
): ResponseRule {
  const resolvedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(rule.action.responseHeaders)) {
    resolvedHeaders[key] = resolveString(value, resolver, context, errors);
  }

  return {
    ...rule,
    action: {
      ...rule.action,
      // Only resolve variables in static body content, not in dynamic JS code.
      responseBody:
        rule.action.bodyType === 'static'
          ? resolveString(rule.action.responseBody, resolver, context, errors)
          : rule.action.responseBody,
      responseHeaders: resolvedHeaders,
    },
  };
}

function resolveWsRule(
  rule: WsRule,
  resolver: VariableResolver,
  context: ResolutionContext | undefined,
  errors: ResolutionError[] | undefined,
): WsRule {
  return {
    ...rule,
    action: {
      ...rule.action,
      ...(rule.action.payload ? { payload: resolveString(rule.action.payload, resolver, context, errors) } : {}),
      ...(rule.action.messageFilter
        ? {
            messageFilter: {
              ...rule.action.messageFilter,
              value: resolveString(rule.action.messageFilter.value, resolver, context, errors),
            },
          }
        : {}),
    },
  };
}

function resolveSseRule(
  rule: SseRule,
  resolver: VariableResolver,
  context: ResolutionContext | undefined,
  errors: ResolutionError[] | undefined,
): SseRule {
  return {
    ...rule,
    action: {
      ...rule.action,
      ...(rule.action.payload ? { payload: resolveString(rule.action.payload, resolver, context, errors) } : {}),
      ...(rule.action.eventName ? { eventName: resolveString(rule.action.eventName, resolver, context, errors) } : {}),
      ...(rule.action.messageFilter
        ? {
            messageFilter: {
              ...rule.action.messageFilter,
              value: resolveString(rule.action.messageFilter.value, resolver, context, errors),
            },
          }
        : {}),
    },
  };
}

function resolveAuthRule(
  rule: AuthRule,
  resolver: VariableResolver,
  context: ResolutionContext | undefined,
  errors: ResolutionError[] | undefined,
): AuthRule {
  return {
    ...rule,
    action: {
      ...rule.action,
      // Resolve credentials so a `{{vault.*}}` reference becomes the literal
      // value the challenge response needs; a typed literal passes through.
      username: resolveString(rule.action.username, resolver, context, errors),
      password: resolveString(rule.action.password, resolver, context, errors),
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
