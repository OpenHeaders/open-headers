/**
 * `deriveTabControlState` — the pure assembly of an in-scope tab's standing CDP
 * control state from its live rules. The load-bearing property (Phase E1b gate
 * 3): the network plane (`fetchPatterns`) and the delivery plane
 * (`bootstrapScripts`) are INDEPENDENT, so the empty short-circuit gates on
 * BOTH being empty — a wrapper-only tab (e.g. a lone `ws` rule) must still
 * carry its bootstrap even though it has no Fetch patterns.
 */

import type { ResponseRule, RuleCondition, WsRule } from '@openheaders/core/types';
import { EMPTY_TAB_CONTROL_STATE } from '@openheaders/oracle/correlator-cdp';
import { describe, expect, it } from 'vitest';

import { deriveTabControlState } from '@/background/correlator-host/derive-tab-control-state';

const urlFilter: RuleCondition = { uid: 'cnd-uf', type: 'url-filter', values: ['*://api.openheaders.io/*'] };

function wsRule(): WsRule {
  return {
    schemaVersion: 5,
    uid: 'ws000001',
    path: 'rules/ws',
    name: 'Socket',
    type: 'ws',
    enabled: true,
    conditions: [urlFilter],
    action: { operation: 'modify', direction: 'send', payload: 'hi', injectTrigger: 'open' },
  };
}

/** Unrestricted response → debug-tier → Fetch-realizable (network plane). */
function responseRule(): ResponseRule {
  return {
    schemaVersion: 5,
    uid: 'rs000001',
    path: 'rules/response',
    name: 'Mock',
    type: 'response',
    enabled: true,
    conditions: [urlFilter],
    action: {
      responseSource: 'mock',
      statusCode: 418,
      contentType: 'application/json',
      bodyType: 'static',
      responseBody: '{"oh":"mocked"}',
      responseHeaders: {},
      resourceType: 'rest',
    },
  };
}

describe('deriveTabControlState', () => {
  it('is EMPTY when neither plane contributes', () => {
    expect(deriveTabControlState([])).toBe(EMPTY_TAB_CONTROL_STATE);
  });

  it('carries bootstrap scripts with NO fetch patterns for a wrapper-only tab (the early-return trap)', () => {
    const state = deriveTabControlState([wsRule()]);
    expect(state.fetchPatterns).toEqual([]);
    expect(state.bootstrapScripts.map((s) => s.key)).toEqual(['oh-setup', 'ws:ws000001']);
    // Not the EMPTY singleton — the lone ws rule produced a non-empty state.
    expect(state).not.toBe(EMPTY_TAB_CONTROL_STATE);
  });

  it('carries fetch patterns with NO bootstrap scripts for a realizable-only tab', () => {
    const state = deriveTabControlState([responseRule()]);
    expect(state.fetchPatterns).toEqual([{ urlPattern: '*://api.openheaders.io/*' }]);
    expect(state.bootstrapScripts).toEqual([]);
  });

  it('carries BOTH planes for a tab with a realizable rule and a residual wrapper', () => {
    const state = deriveTabControlState([responseRule(), wsRule()]);
    expect(state.fetchPatterns).toEqual([{ urlPattern: '*://api.openheaders.io/*' }]);
    expect(state.bootstrapScripts.map((s) => s.key)).toEqual(['oh-setup', 'ws:ws000001']);
  });

  it('opts into auth-challenge interception only when an auth rule is in scope', () => {
    expect(deriveTabControlState([wsRule()]).fetchHandleAuthRequests).toBe(false);
    const auth = {
      schemaVersion: 5 as const,
      uid: 'au000001',
      path: 'rules/auth',
      name: 'Auth',
      type: 'auth' as const,
      enabled: true,
      conditions: [urlFilter],
      action: { username: 'u', password: 'p' },
    };
    expect(deriveTabControlState([auth]).fetchHandleAuthRequests).toBe(true);
  });
});
