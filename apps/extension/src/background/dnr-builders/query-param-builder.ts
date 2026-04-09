/**
 * Query Param DNR Builder — converts V5.QueryParamRule into declarativeNetRequest rules.
 *
 * Uses DNR redirect action with transform.queryTransform to add, override,
 * or remove URL query parameters. One DNR rule per domain.
 */

import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { formatUrlPattern } from '../modules/url-utils';
import type { DnrBuilder, DnrRedirect, DnrRule } from './types';
import { ALL_RESOURCE_TYPES, extractDomains } from './types';

export const queryParamBuilder: DnrBuilder<V5.QueryParamRule> = {
  ruleType: 'query-param',
  build(rule: V5.QueryParamRule, startId: number): DnrRule[] {
    const domains = extractDomains(rule);
    const { action } = rule;

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
      logger.debug('QueryParamBuilder', `Skipping rule "${rule.name}" — no valid param operations`);
      return [];
    }

    const rules: DnrRule[] = [];
    let ruleId = startId;

    for (const domain of domains) {
      if (removeAll) {
        // Remove all — strips entire query string. Other operations ignored.
        rules.push({
          id: ruleId++,
          priority: 150,
          action: {
            type: 'redirect',
            redirect: { transform: { query: '' } },
          },
          condition: {
            urlFilter: formatUrlPattern(domain),
            resourceTypes: ALL_RESOURCE_TYPES,
          },
        });
      } else {
        // Add/replace/remove specific params
        const queryTransform: NonNullable<DnrRedirect['transform']>['queryTransform'] = {};
        if (addOrReplaceParams.length > 0) queryTransform.addOrReplaceParams = addOrReplaceParams;
        if (removeParams.length > 0) queryTransform.removeParams = removeParams;

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
    }

    return rules;
  },
};
