/**
 * Header DNR Builder — converts V5.HeaderRule into declarativeNetRequest rules.
 *
 * Supports add/override/remove operations for both request and response headers.
 * Response headers get two DNR rules per domain (main_frame at higher priority,
 * sub-resources at lower priority) to ensure proper coverage.
 */

import type { V5 } from '@openheaders/core/types';
import { validateHeaderName } from '@utils/header-validator';
import { logger } from '@utils/logger';
import { normalizeHeaderName } from '@utils/utils';
import { isValidHeaderValue, sanitizeHeaderValue } from '../rule-validator';
import { formatUrlPattern } from '../modules/url-utils';
import type { DnrBuilder, DnrRule } from './types';
import { ALL_RESOURCE_TYPES, SUB_RESOURCE_TYPES } from './types';

// ── Builder ──────────────────────────────────────────────────────

export const headerBuilder: DnrBuilder<V5.HeaderRule> = {
  ruleType: 'header',
  build(rule: V5.HeaderRule, startId: number): DnrRule[] {
    return buildDnrRulesForHeader(rule, startId);
  },
};

// ── DNR rule building ────────────────────────────────────────────

function buildDnrRulesForHeader(rule: V5.HeaderRule, startId: number): DnrRule[] {
  const { action, staticValue, domains } = rule;

  const validation = validateHeaderName(action.headerName, action.isResponse);
  if (!validation.valid) {
    logger.debug('HeaderBuilder', `Skipping rule "${rule.name}" — invalid header: ${validation.message}`);
    return [];
  }

  if (domains.length === 0) {
    logger.debug('HeaderBuilder', `Skipping rule "${rule.name}" — no domains`);
    return [];
  }

  const headerName = validation.sanitized || normalizeHeaderName(action.headerName);

  if (action.operation === 'remove') {
    return buildRemoveHeaderRules(headerName, domains, action.isResponse, startId);
  }

  const rawValue = staticValue ?? '';
  if (!rawValue.trim()) {
    logger.debug('HeaderBuilder', `Skipping rule "${rule.name}" — empty value`);
    return [];
  }

  let headerValue = rawValue;
  if (!isValidHeaderValue(headerValue, headerName)) {
    headerValue = sanitizeHeaderValue(headerValue);
    if (!isValidHeaderValue(headerValue, headerName)) {
      logger.debug('HeaderBuilder', `Skipping rule "${rule.name}" — invalid value after sanitization`);
      return [];
    }
  }

  if (action.isResponse) {
    return buildResponseHeaderRules(headerName, headerValue, action.operation, domains, startId);
  }
  return buildRequestHeaderRules(headerName, headerValue, action.operation, domains, startId);
}

// ── Request header rules ─────────────────────────────────────────

function buildRequestHeaderRules(
  headerName: string,
  headerValue: string,
  operation: V5.HeaderOperation,
  domains: string[],
  startId: number,
): DnrRule[] {
  const rules: DnrRule[] = [];
  let ruleId = startId;
  const dnrOp = operation === 'add' ? 'append' : 'set';

  for (const domain of domains) {
    if (!domain?.trim()) continue;
    rules.push({
      id: ruleId++,
      priority: 100,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: headerName, operation: dnrOp, value: headerValue },
          { header: 'Cache-Control', operation: 'set', value: 'no-cache, no-store, must-revalidate' },
          { header: 'Pragma', operation: 'set', value: 'no-cache' },
        ],
      },
      condition: {
        urlFilter: formatUrlPattern(domain),
        resourceTypes: ALL_RESOURCE_TYPES,
      },
    });
  }

  return rules;
}

// ── Response header rules ────────────────────────────────────────

function buildResponseHeaderRules(
  headerName: string,
  headerValue: string,
  operation: V5.HeaderOperation,
  domains: string[],
  startId: number,
): DnrRule[] {
  const rules: DnrRule[] = [];
  let ruleId = startId;
  const dnrOp = operation === 'add' ? 'append' : 'set';

  for (const domain of domains) {
    if (!domain?.trim()) continue;
    const urlFilter = formatUrlPattern(domain);

    // Main frame — higher priority
    rules.push({
      id: ruleId++,
      priority: 1000,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [{ header: headerName, operation: dnrOp, value: headerValue }],
      },
      condition: {
        urlFilter,
        resourceTypes: ['main_frame' as chrome.declarativeNetRequest.ResourceType],
      },
    });

    // Sub-resources — lower priority
    rules.push({
      id: ruleId++,
      priority: 950,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [{ header: headerName, operation: dnrOp, value: headerValue }],
      },
      condition: {
        urlFilter,
        resourceTypes: SUB_RESOURCE_TYPES,
      },
    });
  }

  return rules;
}

// ── Remove header rules ──────────────────────────────────────────

function buildRemoveHeaderRules(
  headerName: string,
  domains: string[],
  isResponse: boolean,
  startId: number,
): DnrRule[] {
  const rules: DnrRule[] = [];
  let ruleId = startId;

  for (const domain of domains) {
    if (!domain?.trim()) continue;

    const modification = { header: headerName, operation: 'remove' as const, value: '' };
    const urlFilter = formatUrlPattern(domain);

    if (isResponse) {
      rules.push({
        id: ruleId++,
        priority: 1000,
        action: { type: 'modifyHeaders', responseHeaders: [modification] },
        condition: {
          urlFilter,
          resourceTypes: ['main_frame' as chrome.declarativeNetRequest.ResourceType],
        },
      });
      rules.push({
        id: ruleId++,
        priority: 950,
        action: { type: 'modifyHeaders', responseHeaders: [modification] },
        condition: { urlFilter, resourceTypes: SUB_RESOURCE_TYPES },
      });
    } else {
      rules.push({
        id: ruleId++,
        priority: 100,
        action: { type: 'modifyHeaders', requestHeaders: [modification] },
        condition: { urlFilter, resourceTypes: ALL_RESOURCE_TYPES },
      });
    }
  }

  return rules;
}
