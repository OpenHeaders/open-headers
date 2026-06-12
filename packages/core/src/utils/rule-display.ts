/**
 * Rule display utilities — shared by popup (RulesTable, ThisPageRules, CollectionManager)
 * and background (request-tracker).
 *
 * Provides structured action detail for compact display in table Details columns,
 * DNR priority constants, and human-readable operation tooltips.
 */

import type {
  BodyRule,
  DelayRule,
  HeaderRule,
  InjectRule,
  MockRule,
  QueryParamRule,
  RedirectRule,
  Rule,
  SseRule,
  WsRule,
} from '../types/rule';

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
  /** Individual items for multi-item rules (header mods, query params). */
  items?: string[];
}

const HEADER_OP_TOOLTIP: Record<string, Record<string, string>> = {
  override: {
    request: 'Sets outgoing header, replacing if already present',
    response: 'Sets incoming header, replacing if already present',
  },
  add: {
    request: 'Adds outgoing header only when not already present',
    response: 'Adds incoming header only when not already present',
  },
  remove: {
    request: 'Removes outgoing header from the request',
    response: 'Removes incoming header from the response',
  },
};

/** Structured action detail for compact display in table Details columns. */
export function getActionDetail(rule: Rule): ActionDetail {
  switch (rule.type) {
    case 'header': {
      const hr = rule as HeaderRule;
      const reqCount = hr.action.requestHeaders?.length ?? 0;
      const resCount = hr.action.responseHeaders?.length ?? 0;
      const allMods = [...(hr.action.requestHeaders ?? []), ...(hr.action.responseHeaders ?? [])];
      const first = allMods[0];
      const dir = resCount > 0 && reqCount === 0 ? 'response' : reqCount > 0 && resCount === 0 ? 'request' : undefined;
      const total = allMods.length;
      return {
        ruleType: 'header',
        direction: dir,
        operation: first?.operation,
        label: total === 1 ? first?.headerName || '' : `${total} headers`,
        value: total === 1 && first?.operation !== 'remove' ? first?.value || '' : '',
        tooltip:
          total === 1 && first
            ? (HEADER_OP_TOOLTIP[first.operation]?.[dir ?? 'request'] ?? first.operation)
            : `${reqCount} request + ${resCount} response header modifications`,
        items:
          total > 1
            ? allMods.map((m) => {
                const op = m.operation.charAt(0).toUpperCase() + m.operation.slice(1);
                return m.operation === 'remove' ? `${op} ${m.headerName}` : `${op} ${m.headerName}: ${m.value ?? ''}`;
              })
            : undefined,
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
      const qp = rule as QueryParamRule;
      const count = qp.action.params.length;
      return {
        ruleType: 'query-param',
        label: `${count} param${count !== 1 ? 's' : ''}`,
        value: '',
        tooltip: 'Modifies URL query parameters',
        items:
          count > 1
            ? qp.action.params.map((p) => {
                const op = p.operation.charAt(0).toUpperCase() + p.operation.slice(1);
                return p.operation === 'remove' || p.operation === 'remove-all'
                  ? `${op} ${p.param}`
                  : `${op} ${p.param}=${p.value ?? ''}`;
              })
            : undefined,
      };
    }
    case 'inject': {
      const ir = rule as InjectRule;
      return {
        ruleType: 'inject',
        operation: ir.action.injectType,
        label: ir.action.injectType === 'css' ? 'CSS' : 'JS',
        value: ir.action.position ?? '',
        tooltip: ir.action.injectType === 'css' ? 'Injects stylesheet into page' : 'Injects JavaScript into page',
      };
    }
    case 'delay':
      return {
        ruleType: 'delay',
        label: `${(rule as DelayRule).action.delayMs}ms`,
        value: '',
        tooltip: 'Delays network requests (fetch/XHR)',
      };
    case 'body': {
      const br = rule as BodyRule;
      return {
        ruleType: 'body',
        direction: 'request' as const,
        operation: br.action.bodyType,
        label: br.action.resourceType === 'graphql' ? 'GraphQL' : 'REST',
        value: br.action.bodyType === 'dynamic' ? 'JS function' : '',
        tooltip: 'Modifies request body (fetch/XHR)',
      };
    }
    case 'mock': {
      const mr = rule as MockRule;
      const mockFormat = mr.action.resourceType === 'graphql' ? 'GraphQL' : 'REST';
      return {
        ruleType: 'mock',
        direction: 'response' as const,
        operation: mr.action.bodyType,
        label: `${mr.action.statusCode} ${mockFormat}`,
        value: mr.action.contentType || '',
        tooltip: 'Overrides API response (fetch/XHR)',
      };
    }
    case 'ws': {
      const wr = rule as WsRule;
      const op = wr.action.operation;
      return {
        ruleType: 'ws',
        direction: wr.action.direction === 'send' ? 'request' : 'response',
        operation: op,
        label: `${op.charAt(0).toUpperCase()}${op.slice(1)} ${wr.action.direction === 'send' ? 'outgoing' : 'incoming'}`,
        value: wr.action.messageFilter?.value ?? '',
        tooltip:
          op === 'drop'
            ? 'Drops matching WebSocket messages (page)'
            : op === 'inject'
              ? 'Injects a WebSocket message (page)'
              : 'Rewrites WebSocket messages (page)',
      };
    }
    case 'sse': {
      const sr = rule as SseRule;
      const op = sr.action.operation;
      return {
        ruleType: 'sse',
        direction: 'response' as const,
        operation: op,
        label: sr.action.eventName ? `${op} "${sr.action.eventName}"` : op,
        value: sr.action.messageFilter?.value ?? '',
        tooltip:
          op === 'drop'
            ? 'Drops matching server-sent events (page)'
            : op === 'inject'
              ? 'Injects a server-sent event (page)'
              : 'Rewrites server-sent events (page)',
      };
    }
    default: {
      const _exhaustive: never = rule;
      return { ruleType: (rule as Rule).type, label: '', value: '', tooltip: (rule as Rule).type };
    }
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
