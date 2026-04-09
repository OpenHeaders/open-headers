/**
 * Rule display utilities — shared by popup (RulesTable, ThisPageRules, CollectionManager)
 * and background (request-tracker).
 *
 * Provides structured action detail for compact display in table Details columns,
 * DNR priority constants, and human-readable operation tooltips.
 */

import type { HeaderRule, InjectRule, QueryParamRule, RedirectRule, Rule } from '../types/v5/rule';

// ── Action detail ────────────────────────────────────────────────

export interface ActionDetail {
  /** Rule type for icon selection. */
  ruleType: string;
  /** Direction: 'request' | 'response' (header rules only). */
  direction?: 'request' | 'response';
  /** Operation for color coding (header: override/add/remove, query-param: mixed). */
  operation?: string;
  /** Primary label (header name, redirect URL, param count, inject type+position). */
  label: string;
  /** Secondary value (header value, empty for block, etc.). */
  value: string;
  /** Human-readable tooltip. */
  tooltip: string;
}

const HEADER_OP_TOOLTIP: Record<string, string> = {
  override: 'Replaces existing header value',
  add: 'Adds header if not present',
  remove: 'Removes header entirely',
};

/** Structured action detail for compact display in table Details columns. */
export function getActionDetail(rule: Rule): ActionDetail {
  switch (rule.type) {
    case 'header': {
      const { operation, headerName, isResponse } = (rule as HeaderRule).action;
      const hr = rule as HeaderRule;
      return {
        ruleType: 'header',
        direction: isResponse ? 'response' : 'request',
        operation,
        label: headerName || '',
        value: operation === 'remove' ? '' : hr.staticValue || '',
        tooltip: HEADER_OP_TOOLTIP[operation] ?? operation,
      };
    }
    case 'block':
      return {
        ruleType: 'block',
        label: '',
        value: '',
        tooltip: 'Prevents request from completing',
      };
    case 'redirect':
      return {
        ruleType: 'redirect',
        label: '',
        value: (rule as RedirectRule).action.redirectTo || '',
        tooltip: 'Redirects to a different URL',
      };
    case 'query-param': {
      const count = (rule as QueryParamRule).action.params.length;
      return {
        ruleType: 'query-param',
        label: `${count} param${count !== 1 ? 's' : ''}`,
        value: '',
        tooltip: 'Modifies URL query parameters',
      };
    }
    case 'inject': {
      const ir = rule as InjectRule;
      return {
        ruleType: 'inject',
        operation: ir.action.injectType,
        label: ir.action.injectType === 'css' ? 'CSS' : 'JS',
        value: ir.action.position,
        tooltip: ir.action.injectType === 'css' ? 'Injects stylesheet into page' : 'Injects JavaScript into page',
      };
    }
    default:
      return { ruleType: rule.type, label: '', value: '', tooltip: rule.type };
  }
}

// ── DNR priority ─────────────────────────────────────────────────

/** Chrome declarativeNetRequest priority by rule type. Higher = wins conflicts. */
export const DNR_PRIORITY: Record<string, number> = {
  header: 100,
  'query-param': 150,
  redirect: 150,
  block: 200,
  inject: 50,
};
