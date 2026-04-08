/**
 * Header Manager — builds declarativeNetRequest rules from V5 resolved rules.
 *
 * Receives pre-resolved V5.Rule[] (no {{VAR}} templates) and converts
 * header rules into chrome.declarativeNetRequest dynamic rules.
 *
 * Currently handles HeaderRule only. Other rule types (redirect, block, etc.)
 * will be added as the extension gains support for them.
 */
declare const browser: typeof chrome | undefined;

import type { V5 } from '@openheaders/core/types';
import { declarativeNetRequest } from '@utils/browser-api';
import { validateHeaderName } from '@utils/header-validator';
import { logger } from '@utils/logger';
import { normalizeHeaderName } from '@utils/utils';
import type { HeaderDnrRule } from '@/types/header';
import { formatUrlPattern } from './modules/url-utils';
import { isValidHeaderValue, sanitizeHeaderValue } from './rule-validator';

// ── Cached state ──────────────────────────────────────────────────

let isPaused = false;
let disabledTagGroups: Set<string> = new Set();

export function setRulesPaused(paused: boolean): void {
  isPaused = paused;
}

export function setDisabledTagGroups(groups: string[]): void {
  disabledTagGroups = new Set(groups);
}

export function getDisabledTagGroups(): string[] {
  return [...disabledTagGroups];
}

export function initPauseState(): void {
  const browserAPI = (typeof browser !== 'undefined' ? browser : chrome) as typeof chrome;
  browserAPI.storage.sync.get(['isRulesExecutionPaused'], (result: Record<string, unknown>) => {
    isPaused = (result.isRulesExecutionPaused as boolean) || false;
  });
  browserAPI.storage.local.get(['disabledTagGroups'], (result: Record<string, unknown>) => {
    const groups = result.disabledTagGroups as string[] | undefined;
    if (Array.isArray(groups)) {
      disabledTagGroups = new Set(groups);
    }
  });
}

// ── Main update function ──────────────────────────────────────────

/**
 * Build and apply declarativeNetRequest rules from V5 header rules.
 */
export function updateNetworkRules(rules: V5.Rule[]): void {
  if (isPaused) {
    logger.info('HeaderManager', 'Rules execution is paused, clearing all active rules');
    clearAllDnrRules();
    return;
  }

  const headerRules = rules.filter((r): r is V5.HeaderRule => r.type === 'header');
  const dnrRules: HeaderDnrRule[] = [];
  let ruleId = 1;

  for (const rule of headerRules) {
    if (!rule.enabled) continue;

    // Check tag groups
    const tagGroup = rule.tags[0] || '__no_tag__';
    if (disabledTagGroups.has(tagGroup)) continue;

    const newRules = buildDnrRulesForHeader(rule, ruleId);
    dnrRules.push(...newRules);
    ruleId += newRules.length;
  }

  applyDnrRules(dnrRules);
}

// ── DNR rule building ─────────────────────────────────────────────

function buildDnrRulesForHeader(rule: V5.HeaderRule, startId: number): HeaderDnrRule[] {
  const { action, staticValue, domains } = rule;

  // Validate header name
  const validation = validateHeaderName(action.headerName, action.isResponse);
  if (!validation.valid) {
    logger.debug('HeaderManager', `Skipping rule "${rule.name}" — invalid header: ${validation.message}`);
    return [];
  }

  if (domains.length === 0) {
    logger.debug('HeaderManager', `Skipping rule "${rule.name}" — no domains`);
    return [];
  }

  const headerName = validation.sanitized || normalizeHeaderName(action.headerName);

  // For 'remove' operation, no value needed
  if (action.operation === 'remove') {
    return buildRemoveHeaderRules(headerName, domains, action.isResponse, startId);
  }

  // For 'add' / 'override', value is required
  const rawValue = staticValue ?? '';
  if (!rawValue.trim()) {
    logger.debug('HeaderManager', `Skipping rule "${rule.name}" — empty value`);
    return [];
  }

  let headerValue = rawValue;
  if (!isValidHeaderValue(headerValue, headerName)) {
    headerValue = sanitizeHeaderValue(headerValue);
    if (!isValidHeaderValue(headerValue, headerName)) {
      logger.debug('HeaderManager', `Skipping rule "${rule.name}" — invalid value after sanitization`);
      return [];
    }
  }

  if (action.isResponse) {
    return buildResponseHeaderRules(headerName, headerValue, action.operation, domains, startId);
  }
  return buildRequestHeaderRules(headerName, headerValue, action.operation, domains, startId);
}

// ── Request header rules ──────────────────────────────────────────

const ALL_RESOURCE_TYPES: chrome.declarativeNetRequest.ResourceType[] = [
  'main_frame',
  'sub_frame',
  'stylesheet',
  'script',
  'image',
  'font',
  'object',
  'xmlhttprequest',
  'websocket',
  'other',
] as chrome.declarativeNetRequest.ResourceType[];

function buildRequestHeaderRules(
  headerName: string,
  headerValue: string,
  operation: V5.HeaderOperation,
  domains: string[],
  startId: number,
): HeaderDnrRule[] {
  const rules: HeaderDnrRule[] = [];
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

// ── Response header rules ─────────────────────────────────────────

const SUB_RESOURCE_TYPES: chrome.declarativeNetRequest.ResourceType[] = [
  'sub_frame',
  'stylesheet',
  'script',
  'image',
  'font',
  'xmlhttprequest',
  'websocket',
  'other',
] as chrome.declarativeNetRequest.ResourceType[];

function buildResponseHeaderRules(
  headerName: string,
  headerValue: string,
  operation: V5.HeaderOperation,
  domains: string[],
  startId: number,
): HeaderDnrRule[] {
  const rules: HeaderDnrRule[] = [];
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

// ── Remove header rules ───────────────────────────────────────────

function buildRemoveHeaderRules(
  headerName: string,
  domains: string[],
  isResponse: boolean,
  startId: number,
): HeaderDnrRule[] {
  const rules: HeaderDnrRule[] = [];
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

// ── DNR rule application ──────────────────────────────────────────

function applyDnrRules(newRules: HeaderDnrRule[]): void {
  declarativeNetRequest!
    .getDynamicRules()
    .then((existingRules) => {
      const removeRuleIds = existingRules.map((r) => r.id);
      return declarativeNetRequest!.updateDynamicRules({
        removeRuleIds,
        addRules: newRules,
      });
    })
    .then(() => {
      logger.info('HeaderManager', `Applied ${newRules.length} DNR rules`);
    })
    .catch((e: Error) => {
      logger.error('HeaderManager', 'Error updating rules:', e.message || 'Unknown error');
    });
}

function clearAllDnrRules(): void {
  declarativeNetRequest!
    .getDynamicRules()
    .then((existingRules) => {
      const removeIds = existingRules.map((r) => r.id);
      return declarativeNetRequest!.updateDynamicRules({ removeRuleIds: removeIds, addRules: [] });
    })
    .then(() => {
      logger.debug('HeaderManager', 'All rules cleared (paused)');
    });
}
