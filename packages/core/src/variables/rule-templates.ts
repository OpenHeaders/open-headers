/**
 * Rule template-string collector — mirrors `rule-resolver`'s walker
 * structure, but yields every templatable string in a rule instead of
 * resolving them.
 *
 * Used by the DNR compile pipeline to answer "which live variables does
 * this rule consume?" BEFORE resolution has substituted the literals.
 * Consumers scan the returned strings with
 * `@openheaders/core/live/template-scan` and map live-var names back to
 * their backing workflows to avoid the self-reference feedback loop
 * (a rule injecting `Authorization: {{live.token}}` must not fire on
 * the chain fetches that PRODUCE `live.token`).
 *
 * The walker must stay in lock-step with `rule-resolver.walkRule`.
 * Every string the resolver touches is a string templates can live in;
 * any field this walker misses means the rule-compile dependency graph
 * is incomplete. Invariant enforced by the unit tests in
 * `packages/core/tests/variables/rule-templates.test.ts` — they compare
 * the walker's output against the resolver's touched-string count.
 */

import type { Rule } from '../types';

/**
 * Collect every templatable string in a rule. Returns strings in
 * walker order (conditions first, then per-type action fields) so
 * callers that care about position (e.g. error surfaces) can align.
 *
 * `undefined` / empty-string fields are omitted — `scanTemplateReferences`
 * would yield no refs for them anyway, and skipping avoids allocating a
 * scanner for a no-op case.
 */
export function collectRuleTemplateStrings(rule: Rule): string[] {
  const out: string[] = [];

  for (const cond of rule.conditions) {
    for (const v of cond.values) {
      if (v) out.push(v);
    }
    if (cond.headerName) out.push(cond.headerName);
  }

  switch (rule.type) {
    case 'header': {
      for (const mod of rule.action.requestHeaders ?? []) {
        if (mod.value) out.push(mod.value);
      }
      for (const mod of rule.action.responseHeaders ?? []) {
        if (mod.value) out.push(mod.value);
      }
      break;
    }
    case 'redirect':
      if (rule.action.redirectTo) out.push(rule.action.redirectTo);
      break;
    case 'request-body':
      // Dynamic JS bodies are NOT templated — the resolver skips them
      // and so must this walker. Only `static` body content is a
      // candidate for {{VAR}} substitution.
      if (rule.action.bodyType === 'static' && rule.action.requestBody) {
        out.push(rule.action.requestBody);
      }
      break;
    case 'inject':
      if (rule.action.code) out.push(rule.action.code);
      break;
    case 'block':
      // No user-templated string fields on block actions.
      break;
    case 'delay':
      // Delay rules have no user-templated string fields today.
      break;
    case 'response':
      // Dynamic JS bodies are NOT templated — the resolver skips them, so
      // this walker must too. Only `static` response content is a {{VAR}}
      // candidate. Response headers are always literal values, regardless.
      if (rule.action.bodyType === 'static' && rule.action.responseBody) {
        out.push(rule.action.responseBody);
      }
      for (const value of Object.values(rule.action.responseHeaders)) {
        if (value) out.push(value);
      }
      break;
    case 'query-param':
      for (const entry of rule.action.params) {
        if (entry.param) out.push(entry.param);
        if (entry.value) out.push(entry.value);
      }
      break;
    case 'ws':
      if (rule.action.payload) out.push(rule.action.payload);
      if (rule.action.messageFilter?.value) out.push(rule.action.messageFilter.value);
      break;
    case 'sse':
      if (rule.action.payload) out.push(rule.action.payload);
      if (rule.action.messageFilter?.value) out.push(rule.action.messageFilter.value);
      if (rule.action.eventName) out.push(rule.action.eventName);
      break;
    case 'auth':
      // Credentials are template-resolvable so the real secret can live in
      // the vault (`{{vault.*}}`) rather than plaintext on the rule.
      if (rule.action.username) out.push(rule.action.username);
      if (rule.action.password) out.push(rule.action.password);
      break;
  }

  return out;
}
