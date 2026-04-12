/**
 * Query Param compiler — converts V5.QueryParamRule into a CompilationPlan.
 *
 * Uses DNR redirect action with transform.queryTransform to add, override,
 * or remove URL query parameters. One DNR rule per domain.
 */

import type { V5 } from '@openheaders/core/types';
import { formatUrlPattern } from '@openheaders/core/utils';
import { logger } from '@utils/logger';
import type { CompilationPlan, CompilerContext, DnrCondition, DnrRedirect, DnrRule, RuleCompiler } from './types';
import { ALL_RESOURCE_TYPES, buildDnrCondition, resolveResourceTypes, stripResourceTypeFields } from './types';

export const queryParamCompiler: RuleCompiler<V5.QueryParamRule> = {
  ruleType: 'query-param',
  compile(rule: V5.QueryParamRule, ctx: CompilerContext): CompilationPlan {
    const { base, domains, useRegex, urlPattern } = buildDnrCondition(rule.conditions);
    const { action } = rule;

    if (domains.length === 0 && !urlPattern) {
      logger.debug('QueryParamCompiler', `Skipping rule "${rule.name}" — no matching conditions`);
      return {};
    }

    if (action.params.length === 0) {
      logger.debug('QueryParamCompiler', `Skipping rule "${rule.name}" — no params`);
      return {};
    }

    const addOrReplaceParams: Array<{ key: string; value: string; replaceOnly?: boolean }> = [];
    const removeParams: string[] = [];
    let removeAll = false;

    for (const entry of action.params) {
      switch (entry.operation) {
        case 'remove-all':
          removeAll = true;
          break;
        case 'add':
          if (!entry.param?.trim()) continue;
          addOrReplaceParams.push({ key: entry.param, value: entry.value ?? '' });
          break;
        case 'override':
          if (!entry.param?.trim()) continue;
          addOrReplaceParams.push({ key: entry.param, value: entry.value ?? '', replaceOnly: true });
          break;
        case 'remove':
          if (!entry.param?.trim()) continue;
          removeParams.push(entry.param);
          break;
      }
    }

    if (addOrReplaceParams.length === 0 && removeParams.length === 0 && !removeAll) {
      logger.debug('QueryParamCompiler', `Skipping rule "${rule.name}" — no valid param operations`);
      return {};
    }

    const resourceTypes = resolveResourceTypes(ALL_RESOURCE_TYPES, base.resourceTypes, base.excludedResourceTypes);
    if (!resourceTypes) {
      logger.debug('QueryParamCompiler', `Skipping rule "${rule.name}" — resource-type filter excludes everything`);
      return {};
    }
    const cleanBase = stripResourceTypeFields(base);

    const redirect: DnrRule['action']['redirect'] = removeAll
      ? { transform: { query: '' } }
      : (() => {
          const queryTransform: NonNullable<DnrRedirect['transform']>['queryTransform'] = {};
          if (addOrReplaceParams.length > 0) queryTransform.addOrReplaceParams = addOrReplaceParams;
          if (removeParams.length > 0) queryTransform.removeParams = removeParams;
          return { transform: { queryTransform } };
        })();

    const rules: DnrRule[] = [];

    if (urlPattern) {
      const condition: DnrCondition = { ...cleanBase, resourceTypes };
      if (useRegex) condition.regexFilter = urlPattern;
      else condition.urlFilter = urlPattern;
      rules.push({ id: ctx.allocateId(), priority: 150, action: { type: 'redirect', redirect }, condition });
    } else {
      for (const domain of domains) {
        rules.push({
          id: ctx.allocateId(),
          priority: 150,
          action: { type: 'redirect', redirect },
          condition: { ...cleanBase, urlFilter: formatUrlPattern(domain), resourceTypes },
        });
      }
    }

    return { dynamicRules: rules };
  },
};
