/**
 * Block DNR Builder — converts V5.BlockRule into declarativeNetRequest rules.
 *
 * Chrome's DNR `block` action stops the request entirely (network error).
 * One DNR rule per domain, or one rule if URL/path conditions are used.
 */

import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { formatUrlPattern } from '../modules/url-utils';
import type { DnrBuilder, DnrCondition, DnrRule } from './types';
import { buildDnrCondition } from './types';

export const blockBuilder: DnrBuilder<V5.BlockRule> = {
  ruleType: 'block',
  build(rule: V5.BlockRule, startId: number): DnrRule[] {
    const { base, domains, useRegex, urlPattern } = buildDnrCondition(rule.conditions);

    if (domains.length === 0 && !urlPattern) {
      logger.debug('BlockBuilder', `Skipping rule "${rule.name}" — no matching conditions`);
      return [];
    }

    const rules: DnrRule[] = [];
    let ruleId = startId;

    if (urlPattern) {
      // URL/path condition — single rule
      const condition: DnrCondition = { ...base };
      if (useRegex) {
        condition.regexFilter = urlPattern;
      } else {
        condition.urlFilter = urlPattern;
      }
      rules.push({ id: ruleId++, priority: 200, action: { type: 'block' }, condition });
    } else {
      // Per-domain rules
      for (const domain of domains) {
        rules.push({
          id: ruleId++,
          priority: 200,
          action: { type: 'block' },
          condition: { ...base, urlFilter: formatUrlPattern(domain) },
        });
      }
    }

    return rules;
  },
};
