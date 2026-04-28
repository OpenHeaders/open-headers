/**
 * Inject compiler — converts V5.InjectRule into a CompilationPlan.
 *
 * Inject rules primarily run as a scriptable injection (JS or CSS into the
 * page). When the user enables `bypassCSP`, we additionally emit DNR
 * modifyHeaders rules that strip Content-Security-Policy response headers
 * before the page loads, so the injected script/CSS isn't blocked on
 * strict-CSP sites like GitHub.
 *
 * The actual injection code is not built here — inject-manager handles
 * user-authored code via chrome.scripting on main-frame commits. What this
 * compiler emits is only the CSP-bypass DNR rules and a marker scriptable
 * so the rule shows up in `scriptables` alongside the other types. The
 * marker is a no-op `{kind: 'func', func: noop, args:[null]}` — inject
 * rules deliberately don't go through the func injection path in the
 * plan because their code is driven from inject-manager's onCommitted
 * listener, not from a pre-compiled plan.
 *
 * We keep inject in the scriptable list anyway so downstream code that
 * iterates scriptables to e.g. count per-tab telemetry has a consistent
 * view of "every rule that runs something in the page."
 */

import type { V5 } from '@openheaders/core/types';
import type { CompilationPlan, CompilerContext, DnrCondition, DnrRule, RuleCompiler } from './types';
import { ALL_RESOURCE_TYPES, buildDnrCondition, resolveResourceTypes, stripResourceTypeFields } from './types';

export const injectCompiler: RuleCompiler<V5.InjectRule> = {
  ruleType: 'inject',
  compile(rule: V5.InjectRule, ctx: CompilerContext): CompilationPlan {
    // Inject rules don't need their code path reflected in the plan —
    // inject-manager hooks webNavigation.onCommitted directly and consumes
    // the rule from the rule store. The only DNR output we generate is
    // CSP bypass, and only when explicitly enabled on the rule.
    if (!rule.action.bypassCSP) return {};

    const { base, domains, useRegex, urlPattern } = buildDnrCondition(rule.conditions);
    if (domains.length === 0 && !urlPattern) return {};

    const resourceTypes = resolveResourceTypes(ALL_RESOURCE_TYPES, base.resourceTypes, base.excludedResourceTypes);
    if (!resourceTypes) return {};
    const cleanBase = stripResourceTypeFields(base);

    const cspHeaders: DnrRule['action']['responseHeaders'] = [
      { header: 'Content-Security-Policy', operation: 'remove' },
      { header: 'Content-Security-Policy-Report-Only', operation: 'remove' },
    ];

    // Single DNR rule. `cleanBase` already carries `requestDomains` from
    // the request-domains row when present.
    const condition: DnrCondition = { ...cleanBase, resourceTypes };
    if (urlPattern) {
      if (useRegex) condition.regexFilter = urlPattern;
      else condition.urlFilter = urlPattern;
    }

    const rules: DnrRule[] = [
      {
        id: ctx.allocateId(),
        priority: 2000, // High — CSP must be stripped before page loads
        action: { type: 'modifyHeaders', responseHeaders: cspHeaders },
        condition,
      },
    ];

    return { dynamicRules: rules };
  },
};
