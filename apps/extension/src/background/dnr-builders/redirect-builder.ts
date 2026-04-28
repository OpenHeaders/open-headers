/**
 * Redirect compiler — converts V5.RedirectRule into a CompilationPlan.
 *
 * Maps conditions to DNR condition and RedirectAction.redirectTo to the
 * redirect target. One DNR rule per domain, or one rule if URL/path
 * conditions are used.
 */

import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import type { CompilationPlan, CompilerContext, DnrCondition, DnrRule, RuleCompiler } from './types';
import { ALL_RESOURCE_TYPES, buildDnrCondition, resolveResourceTypes, stripResourceTypeFields } from './types';

export const redirectCompiler: RuleCompiler<V5.RedirectRule> = {
  ruleType: 'redirect',
  compile(rule: V5.RedirectRule, ctx: CompilerContext): CompilationPlan {
    const { base, domains, useRegex, urlPattern } = buildDnrCondition(rule.conditions);
    const { action } = rule;

    if (domains.length === 0 && !urlPattern) {
      logger.debug('RedirectCompiler', `Skipping rule "${rule.name}" — no matching conditions`);
      return {};
    }

    if (!action.redirectTo?.trim()) {
      logger.debug('RedirectCompiler', `Skipping rule "${rule.name}" — empty redirect target`);
      return {};
    }

    const resourceTypes = resolveResourceTypes(ALL_RESOURCE_TYPES, base.resourceTypes, base.excludedResourceTypes);
    if (!resourceTypes) {
      logger.debug('RedirectCompiler', `Skipping rule "${rule.name}" — resource-type filter excludes everything`);
      return {};
    }
    const cleanBase = stripResourceTypeFields(base);

    const redirect: DnrRule['action']['redirect'] = useRegex
      ? { regexSubstitution: action.redirectTo }
      : { url: action.redirectTo };

    // Single DNR rule. `cleanBase` already carries `requestDomains` from
    // the request-domains row when present; URL pattern coexists in its
    // own slot under Chrome's AND semantics.
    const condition: DnrCondition = { ...cleanBase, resourceTypes };
    if (urlPattern) {
      if (useRegex) condition.regexFilter = urlPattern;
      else condition.urlFilter = urlPattern;
    }

    const rules: DnrRule[] = [
      { id: ctx.allocateId(), priority: 150, action: { type: 'redirect', redirect }, condition },
    ];

    return { dynamicRules: rules };
  },
};
