/**
 * Redirect DNR Builder — converts V5.RedirectRule into declarativeNetRequest rules.
 *
 * Maps conditions to DNR condition and RedirectAction.redirectTo to the redirect target.
 * One DNR rule per domain, or one rule if URL/path conditions are used.
 */

import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { formatUrlPattern } from '../modules/url-utils';
import type { DnrBuilder, DnrCondition, DnrRule } from './types';
import { buildDnrCondition } from './types';

export const redirectBuilder: DnrBuilder<V5.RedirectRule> = {
  ruleType: 'redirect',
  build(rule: V5.RedirectRule, startId: number): DnrRule[] {
    const { base, domains, useRegex, urlPattern } = buildDnrCondition(rule.conditions);
    const { action } = rule;

    if (domains.length === 0 && !urlPattern) {
      logger.debug('RedirectBuilder', `Skipping rule "${rule.name}" — no matching conditions`);
      return [];
    }

    if (!action.redirectTo?.trim()) {
      logger.debug('RedirectBuilder', `Skipping rule "${rule.name}" — empty redirect target`);
      return [];
    }

    const rules: DnrRule[] = [];
    let ruleId = startId;

    // Determine redirect type based on the target
    const redirect: DnrRule['action']['redirect'] = useRegex
      ? { regexSubstitution: action.redirectTo }
      : { url: action.redirectTo };

    if (urlPattern) {
      const condition: DnrCondition = { ...base };
      if (useRegex) {
        condition.regexFilter = urlPattern;
      } else {
        condition.urlFilter = urlPattern;
      }
      rules.push({ id: ruleId++, priority: 150, action: { type: 'redirect', redirect }, condition });
    } else {
      for (const domain of domains) {
        rules.push({
          id: ruleId++,
          priority: 150,
          action: { type: 'redirect', redirect },
          condition: { ...base, urlFilter: formatUrlPattern(domain) },
        });
      }
    }

    return rules;
  },
};
