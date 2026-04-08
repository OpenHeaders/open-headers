/**
 * Rule display utilities — shared by popup (RulesTable, ThisPageRules, TagManager)
 * and background (request-tracker).
 *
 * Provides structured action detail for compact [TAG] value display,
 * DNR priority constants, and human-readable operation tooltips.
 */

import type { HeaderRule, InjectRule, QueryParamRule, RedirectRule, Rule } from '../types/v5/rule';

// ── Action detail ────────────────────────────────────────────────

export interface ActionDetail {
  tag: string;
  tooltip: string;
  /** Direction line: "↑ Outgoing request" or "↓ Incoming response" (header rules only). */
  direction?: string;
  value: string;
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
      const dir = isResponse ? ' ↓' : ' ↑';
      const opMap: Record<string, string> = { override: 'OVERRIDE', add: 'ADD', remove: 'REMOVE' };
      const tag = `${opMap[operation] ?? operation.toUpperCase()}${dir}`;
      const tooltip = HEADER_OP_TOOLTIP[operation] ?? operation;
      const direction = isResponse ? '↓ Incoming response' : '↑ Outgoing request';
      if (operation === 'remove') return { tag, tooltip, direction, value: headerName || '' };
      const hr = rule as HeaderRule;
      const value = headerName ? `${headerName}: ${hr.staticValue || ''}` : hr.staticValue || '';
      return { tag, tooltip, direction, value };
    }
    case 'block':
      return { tag: 'BLOCK', tooltip: 'Prevents request from completing', value: '' };
    case 'redirect':
      return {
        tag: 'REDIRECT',
        tooltip: 'Redirects to a different URL',
        value: (rule as RedirectRule).action.redirectTo || '',
      };
    case 'query-param': {
      const count = (rule as QueryParamRule).action.params.length;
      return {
        tag: 'QUERY',
        tooltip: 'Modifies URL query parameters',
        value: `${count} param${count !== 1 ? 's' : ''}`,
      };
    }
    case 'inject': {
      const ir = rule as InjectRule;
      return {
        tag: ir.action.injectType === 'css' ? 'CSS' : 'JS',
        tooltip: ir.action.injectType === 'css' ? 'Injects stylesheet into page' : 'Injects JavaScript into page',
        value: ir.action.position,
      };
    }
    default:
      return { tag: rule.type.toUpperCase(), tooltip: rule.type, value: '' };
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
