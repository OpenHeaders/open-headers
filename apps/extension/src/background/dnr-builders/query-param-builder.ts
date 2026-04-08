/**
 * Query Param DNR Builder — converts V5.QueryParamRule into declarativeNetRequest rules.
 *
 * Uses DNR redirect action with transform.queryTransform to add, override,
 * or remove URL query parameters. One DNR rule per domain.
 */

import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { formatUrlPattern } from '../modules/url-utils';
import type { DnrBuilder, DnrRule, DnrRedirect } from './types';
import { ALL_RESOURCE_TYPES } from './types';

export const queryParamBuilder: DnrBuilder<V5.QueryParamRule> = {
  ruleType: 'query-param',
  build(rule: V5.QueryParamRule, startId: number): DnrRule[] {
    const { domains, action } = rule;

    if (domains.length === 0) {
      logger.debug('QueryParamBuilder', `Skipping rule "${rule.name}" — no domains`);
      return [];
    }

    if (action.params.length === 0) {
      logger.debug('QueryParamBuilder', `Skipping rule "${rule.name}" — no params`);
      return [];
    }

    // Build the queryTransform from param entries
    const addOrReplaceParams: Array<{ key: string; value: string; replaceOnly?: boolean }> = [];
    const removeParams: string[] = [];

    for (const entry of action.params) {
      if (!entry.param?.trim()) continue;

      switch (entry.operation) {
        case 'add':
          addOrReplaceParams.push({ key: entry.param, value: entry.value ?? '' });
          break;
        case 'override':
          addOrReplaceParams.push({ key: entry.param, value: entry.value ?? '', replaceOnly: true });
          break;
        case 'remove':
          removeParams.push(entry.param);
          break;
      }
    }

    if (addOrReplaceParams.length === 0 && removeParams.length === 0) {
      logger.debug('QueryParamBuilder', `Skipping rule "${rule.name}" — no valid param operations`);
      return [];
    }

    const queryTransform: NonNullable<DnrRedirect['transform']>['queryTransform'] = {};
    if (addOrReplaceParams.length > 0) queryTransform.addOrReplaceParams = addOrReplaceParams;
    if (removeParams.length > 0) queryTransform.removeParams = removeParams;

    const rules: DnrRule[] = [];
    let ruleId = startId;

    for (const domain of domains) {
      if (!domain?.trim()) continue;
      rules.push({
        id: ruleId++,
        priority: 150,
        action: {
          type: 'redirect',
          redirect: { transform: { queryTransform } },
        },
        condition: {
          urlFilter: formatUrlPattern(domain),
          resourceTypes: ALL_RESOURCE_TYPES,
        },
      });
    }

    return rules;
  },
};
