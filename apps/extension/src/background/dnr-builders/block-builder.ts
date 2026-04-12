/**
 * Block compiler — converts V5.BlockRule into a CompilationPlan.
 *
 * Chrome's DNR `block` action stops the request entirely (network error).
 * One DNR rule per domain, or one rule if URL/path conditions are used.
 */

import type { V5 } from '@openheaders/core/types';
import { formatUrlPattern } from '@openheaders/core/utils';
import { logger } from '@utils/logger';
import type { CompilationPlan, CompilerContext, DnrCondition, DnrRule, RuleCompiler } from './types';
import { ALL_RESOURCE_TYPES, buildDnrCondition, resolveResourceTypes, stripResourceTypeFields } from './types';

export const blockCompiler: RuleCompiler<V5.BlockRule> = {
  ruleType: 'block',
  compile(rule: V5.BlockRule, ctx: CompilerContext): CompilationPlan {
    const { base, domains, useRegex, urlPattern } = buildDnrCondition(rule.conditions);

    if (domains.length === 0 && !urlPattern) {
      logger.debug('BlockCompiler', `Skipping rule "${rule.name}" — no matching conditions`);
      return {};
    }

    const resourceTypes = resolveResourceTypes(ALL_RESOURCE_TYPES, base.resourceTypes, base.excludedResourceTypes);
    if (!resourceTypes) {
      logger.debug('BlockCompiler', `Skipping rule "${rule.name}" — resource-type filter excludes everything`);
      return {};
    }
    const cleanBase = stripResourceTypeFields(base);

    const rules: DnrRule[] = [];

    if (urlPattern) {
      const condition: DnrCondition = { ...cleanBase, resourceTypes };
      if (useRegex) condition.regexFilter = urlPattern;
      else condition.urlFilter = urlPattern;
      rules.push({ id: ctx.allocateId(), priority: 200, action: { type: 'block' }, condition });
    } else {
      for (const domain of domains) {
        rules.push({
          id: ctx.allocateId(),
          priority: 200,
          action: { type: 'block' },
          condition: { ...cleanBase, urlFilter: formatUrlPattern(domain), resourceTypes },
        });
      }
    }

    return { dynamicRules: rules };
  },
};
