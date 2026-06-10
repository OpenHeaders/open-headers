/**
 * Query Param compiler — converts QueryParamRule into a CompilationPlan.
 *
 * Uses DNR redirect action with transform.queryTransform to add, override,
 * or remove URL query parameters. One DNR rule per domain.
 */

import type { QueryParamRule } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import type { CompilationPlan, CompilerContext, DnrCondition, DnrRedirect, DnrRule, RuleCompiler } from './types';
import { buildDnrCondition, resolveResourceTypes, stripResourceTypeFields } from './types';

export const queryParamCompiler: RuleCompiler<QueryParamRule> = {
  ruleType: 'query-param',
  compile(rule: QueryParamRule, ctx: CompilerContext): CompilationPlan {
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
          // `addOrReplaceParams` without `replaceOnly` — adds when missing,
          // overwrites when present. Editor labels this "ADD / REPLACE".
          addOrReplaceParams.push({ key: entry.param, value: entry.value ?? '' });
          break;
        case 'override':
          if (!entry.param?.trim()) continue;
          // `addOrReplaceParams` with `replaceOnly: true` — updates only when
          // the param is already present; leaves the URL untouched otherwise.
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

    const resourceTypes = resolveResourceTypes(ctx.settings.resourceVocabulary.all, base.resourceTypes, base.excludedResourceTypes);
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

    // Single DNR rule. `cleanBase` already carries `requestDomains` from
    // the request-domains row when present.
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
