/**
 * Header DNR Builder — converts V5.HeaderRule into declarativeNetRequest rules.
 *
 * Maps 1:1 to Chrome's modifyHeaders action — multiple request AND response
 * header modifications in a single DNR rule. Response headers get two DNR
 * rules per domain (main_frame at higher priority, sub-resources at lower)
 * to ensure proper coverage.
 */

import type { V5 } from '@openheaders/core/types';
import { validateHeaderName } from '@utils/header-validator';
import { logger } from '@utils/logger';
import { normalizeHeaderName } from '@utils/utils';
import { formatUrlPattern } from '../modules/url-utils';
import { isValidHeaderValue, sanitizeHeaderValue } from '../rule-validator';
import type { DnrBuilder, DnrCondition, DnrHeaderModification, DnrRule } from './types';
import { ALL_RESOURCE_TYPES, buildDnrCondition, SUB_RESOURCE_TYPES } from './types';

export const headerBuilder: DnrBuilder<V5.HeaderRule> = {
  ruleType: 'header',
  build(rule: V5.HeaderRule, startId: number): DnrRule[] {
    const { base, domains, useRegex, urlPattern } = buildDnrCondition(rule.conditions);

    if (domains.length === 0 && !urlPattern) {
      logger.debug('HeaderBuilder', `Skipping rule "${rule.name}" — no matching conditions`);
      return [];
    }

    // Build DNR header modifications from our model
    const reqMods: DnrHeaderModification[] = [];
    const resMods: DnrHeaderModification[] = [];

    for (const mod of rule.action.requestHeaders ?? []) {
      const built = buildMod(mod, false, rule.name);
      if (built) reqMods.push(built);
    }
    for (const mod of rule.action.responseHeaders ?? []) {
      const built = buildMod(mod, true, rule.name);
      if (built) resMods.push(built);
    }

    if (reqMods.length === 0 && resMods.length === 0) {
      logger.debug('HeaderBuilder', `Skipping rule "${rule.name}" — no valid header modifications`);
      return [];
    }

    // Always add cache-busting headers for request modifications
    if (reqMods.length > 0) {
      reqMods.push(
        { header: 'Cache-Control', operation: 'set', value: 'no-cache, no-store, must-revalidate' },
        { header: 'Pragma', operation: 'set', value: 'no-cache' },
      );
    }

    const rules: DnrRule[] = [];
    let ruleId = startId;

    const buildForCondition = (condition: DnrCondition) => {
      // Request-only modifications
      if (reqMods.length > 0 && resMods.length === 0) {
        rules.push({
          id: ruleId++,
          priority: 100,
          action: { type: 'modifyHeaders', requestHeaders: reqMods },
          condition: { ...condition, resourceTypes: condition.resourceTypes ?? ALL_RESOURCE_TYPES },
        });
      }

      // Response-only modifications (two rules: main_frame high priority + sub-resources)
      if (resMods.length > 0 && reqMods.length === 0) {
        rules.push({
          id: ruleId++,
          priority: 1000,
          action: { type: 'modifyHeaders', responseHeaders: resMods },
          condition: {
            ...condition,
            resourceTypes: ['main_frame' as chrome.declarativeNetRequest.ResourceType],
          },
        });
        rules.push({
          id: ruleId++,
          priority: 950,
          action: { type: 'modifyHeaders', responseHeaders: resMods },
          condition: { ...condition, resourceTypes: SUB_RESOURCE_TYPES },
        });
      }

      // Both request AND response modifications
      if (reqMods.length > 0 && resMods.length > 0) {
        rules.push({
          id: ruleId++,
          priority: 1000,
          action: { type: 'modifyHeaders', requestHeaders: reqMods, responseHeaders: resMods },
          condition: {
            ...condition,
            resourceTypes: ['main_frame' as chrome.declarativeNetRequest.ResourceType],
          },
        });
        rules.push({
          id: ruleId++,
          priority: 950,
          action: { type: 'modifyHeaders', requestHeaders: reqMods, responseHeaders: resMods },
          condition: { ...condition, resourceTypes: SUB_RESOURCE_TYPES },
        });
      }
    };

    if (urlPattern) {
      const condition: DnrCondition = { ...base };
      if (useRegex) {
        condition.regexFilter = urlPattern;
      } else {
        condition.urlFilter = urlPattern;
      }
      buildForCondition(condition);
    } else {
      for (const domain of domains) {
        buildForCondition({ ...base, urlFilter: formatUrlPattern(domain) });
      }
    }

    return rules;
  },
};

function buildMod(mod: V5.HeaderModification, _isResponse: boolean, ruleName: string): DnrHeaderModification | null {
  const validation = validateHeaderName(mod.headerName, _isResponse);
  if (!validation.valid) {
    logger.debug('HeaderBuilder', `Skipping header "${mod.headerName}" in "${ruleName}" — ${validation.message}`);
    return null;
  }

  const headerName = validation.sanitized || normalizeHeaderName(mod.headerName);

  if (mod.operation === 'remove') {
    return { header: headerName, operation: 'remove', value: '' };
  }

  const rawValue = mod.value ?? '';
  if (!rawValue.trim()) {
    logger.debug('HeaderBuilder', `Skipping header "${mod.headerName}" in "${ruleName}" — empty value`);
    return null;
  }

  let headerValue = rawValue;
  if (!isValidHeaderValue(headerValue, headerName)) {
    headerValue = sanitizeHeaderValue(headerValue);
    if (!isValidHeaderValue(headerValue, headerName)) {
      logger.debug('HeaderBuilder', `Skipping header "${mod.headerName}" in "${ruleName}" — invalid value`);
      return null;
    }
  }

  const dnrOp = mod.operation === 'add' ? 'append' : 'set';
  return { header: headerName, operation: dnrOp, value: headerValue };
}
