/**
 * Redirect DNR Builder — converts V5.RedirectRule into declarativeNetRequest rules.
 *
 * Maps RedirectAction.matchPattern to a DNR urlFilter condition and
 * RedirectAction.redirectTo to a redirect URL. One DNR rule per domain.
 *
 * If matchPattern contains regex syntax, uses regexFilter instead of urlFilter.
 */

import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { formatUrlPattern } from '../modules/url-utils';
import type { DnrBuilder, DnrRule } from './types';
import { ALL_RESOURCE_TYPES, extractDomains } from './types';

/** Characters that indicate a regex pattern (beyond simple wildcards). */
const REGEX_INDICATORS = /[()[\]{}+?|^$\\]/;

export const redirectBuilder: DnrBuilder<V5.RedirectRule> = {
  ruleType: 'redirect',
  build(rule: V5.RedirectRule, startId: number): DnrRule[] {
    const domains = extractDomains(rule);
    const { action } = rule;

    if (domains.length === 0) {
      logger.debug('RedirectBuilder', `Skipping rule "${rule.name}" — no domains`);
      return [];
    }

    if (!action.redirectTo?.trim()) {
      logger.debug('RedirectBuilder', `Skipping rule "${rule.name}" — empty redirect target`);
      return [];
    }

    const rules: DnrRule[] = [];
    let ruleId = startId;
    const isRegex = REGEX_INDICATORS.test(action.matchPattern);

    for (const domain of domains) {
      const condition: DnrRule['condition'] = {
        resourceTypes: ALL_RESOURCE_TYPES,
      };

      if (isRegex) {
        condition.regexFilter = action.matchPattern;
      } else if (action.matchPattern?.trim()) {
        condition.urlFilter = formatUrlPattern(action.matchPattern);
      } else {
        condition.urlFilter = formatUrlPattern(domain);
      }

      const redirect: DnrRule['action']['redirect'] = isRegex
        ? { regexSubstitution: action.redirectTo }
        : { url: action.redirectTo };

      rules.push({
        id: ruleId++,
        priority: 150,
        action: { type: 'redirect', redirect },
        condition,
      });
    }

    return rules;
  },
};
