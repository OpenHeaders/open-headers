/**
 * Block compiler — converts BlockRule into a CompilationPlan.
 *
 * Chrome's DNR `block` action stops the request entirely (network error).
 * One DNR rule per domain, or one rule if URL/path conditions are used.
 */

import type { BlockRule } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import type { CompilationPlan, CompilerContext, DnrCondition, DnrRule, RuleCompiler } from './types';
import { buildDnrCondition, resolveResourceTypes, stripResourceTypeFields } from './types';

export const blockCompiler: RuleCompiler<BlockRule> = {
  ruleType: 'block',
  compile(rule: BlockRule, ctx: CompilerContext): CompilationPlan {
    const { base, domains, useRegex, urlPattern } = buildDnrCondition(rule.conditions);

    if (domains.length === 0 && !urlPattern) {
      logger.debug('BlockCompiler', `Skipping rule "${rule.name}" — no matching conditions`);
      return {};
    }

    const resourceTypes = resolveResourceTypes(ctx.settings.resourceVocabulary.all, base.resourceTypes, base.excludedResourceTypes);
    if (!resourceTypes) {
      logger.debug('BlockCompiler', `Skipping rule "${rule.name}" — resource-type filter excludes everything`);
      return {};
    }
    const cleanBase = stripResourceTypeFields(base);

    // Single DNR rule. `cleanBase` already carries `requestDomains` from
    // the request-domains row when present; URL pattern lives in its own
    // slot and Chrome AND's it with the domain list — matching the
    // editor's "rows combine with AND" contract.
    const condition: DnrCondition = { ...cleanBase, resourceTypes };
    if (urlPattern) {
      if (useRegex) condition.regexFilter = urlPattern;
      else condition.urlFilter = urlPattern;
    }

    const rules: DnrRule[] = [
      { id: ctx.allocateId(), priority: 200, action: { type: 'block' }, condition },
    ];

    return { dynamicRules: rules };
  },
};
