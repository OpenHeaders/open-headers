/**
 * Block DNR Builder — converts V5.BlockRule into declarativeNetRequest rules.
 *
 * Chrome's DNR `block` action stops the request entirely (network error).
 * The BlockAction.statusCode field is informational — DNR does not support
 * returning a custom status code. One DNR rule per domain.
 */

import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { formatUrlPattern } from '../modules/url-utils';
import type { DnrBuilder, DnrRule } from './types';
import { ALL_RESOURCE_TYPES } from './types';

export const blockBuilder: DnrBuilder<V5.BlockRule> = {
  ruleType: 'block',
  build(rule: V5.BlockRule, startId: number): DnrRule[] {
    const { domains } = rule;

    if (domains.length === 0) {
      logger.debug('BlockBuilder', `Skipping rule "${rule.name}" — no domains`);
      return [];
    }

    const rules: DnrRule[] = [];
    let ruleId = startId;

    for (const domain of domains) {
      if (!domain?.trim()) continue;
      rules.push({
        id: ruleId++,
        priority: 200,
        action: { type: 'block' },
        condition: {
          urlFilter: formatUrlPattern(domain),
          resourceTypes: ALL_RESOURCE_TYPES,
        },
      });
    }

    return rules;
  },
};
