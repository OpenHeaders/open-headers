/**
 * `deriveTabControlState` — the pure assembly of an in-scope tab's standing CDP
 * control state from its live rules plus the per-tab cache toggle, throttle
 * profile, and system overrides. The load-bearing property: the six planes —
 * network (`fetchPatterns`), delivery (`bootstrapScripts`), CSP-bypass
 * (`bypassCsp`), cache (`cacheDisabled`), conditions (`networkConditions`), and
 * overrides (`overrides`) — are INDEPENDENT, so the empty short-circuit gates on
 * ALL SIX being empty: a tab whose sole contribution is on any one plane (a lone
 * `ws` wrapper's bootstrap, an inject-`bypassCSP`, the cache toggle, a throttle
 * profile, or just a UA override) must not collapse to the EMPTY singleton.
 */

import type { InjectRule, ResponseRule, RuleCondition, WsRule } from '@openheaders/core/types';
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

/**
 * Inject rule with `bypassCSP` enabled → page-DOM, so it is NEITHER
 * Fetch-realizable NOR bootstrap-eligible (the CSP-bypass plane only).
 */
function injectBypassCspRule(): InjectRule {
  return {
    schemaVersion: 5,
    uid: 'in000001',
    path: 'rules/inject',
    name: 'Inject',
    type: 'inject',
    enabled: true,
    conditions: [urlFilter],
    action: {
      injectType: 'script',
      code: 'document.title = "oh";',
      source: 'code',
      position: 'head',
      bypassCSP: true,
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

  it('carries bypassCsp for an inject-bypassCSP-only tab (the third-plane early-return trap)', () => {
    const state = deriveTabControlState([injectBypassCspRule()]);
    // Neither other plane contributes — inject is page-DOM.
    expect(state.fetchPatterns).toEqual([]);
    expect(state.bootstrapScripts).toEqual([]);
    // …yet the tab is NOT the EMPTY singleton: bypassCsp is its sole plane.
    expect(state.bypassCsp).toBe(true);
    expect(state).not.toBe(EMPTY_TAB_CONTROL_STATE);
  });

  it('does not bypass CSP when the inject rule omits bypassCSP (all three planes empty → EMPTY)', () => {
    const rule = injectBypassCspRule();
    const without: InjectRule = { ...rule, action: { ...rule.action, bypassCSP: false } };
    expect(deriveTabControlState([without])).toBe(EMPTY_TAB_CONTROL_STATE);
  });

  it('leaves bypassCsp false on a non-empty state with no inject-bypassCSP rule', () => {
    expect(deriveTabControlState([responseRule()]).bypassCsp).toBe(false);
  });

  it('carries cacheDisabled for a cache-only tab (the fourth-plane early-return trap)', () => {
    const state = deriveTabControlState([], { cacheDisabled: true });
    // No rules → the three rule-derived planes are empty.
    expect(state.fetchPatterns).toEqual([]);
    expect(state.bootstrapScripts).toEqual([]);
    expect(state.bypassCsp).toBe(false);
    // …yet the tab is NOT the EMPTY singleton: cacheDisabled is its sole plane.
    expect(state.cacheDisabled).toBe(true);
    expect(state).not.toBe(EMPTY_TAB_CONTROL_STATE);
  });

  it('stays EMPTY when cache is off and no rule contributes', () => {
    expect(deriveTabControlState([], { cacheDisabled: false })).toBe(EMPTY_TAB_CONTROL_STATE);
  });

  it('carries cacheDisabled alongside a non-empty rule-derived state', () => {
    const state = deriveTabControlState([responseRule()], { cacheDisabled: true });
    expect(state.fetchPatterns).toEqual([{ urlPattern: '*://api.openheaders.io/*' }]);
    expect(state.cacheDisabled).toBe(true);
  });

  it('leaves cacheDisabled false on a non-empty state with no cache toggle', () => {
    expect(deriveTabControlState([responseRule()]).cacheDisabled).toBe(false);
  });

  const slow3g = {
    offline: false,
    latencyMs: 2000,
    downloadThroughputBps: 50000,
    uploadThroughputBps: 50000,
  } as const;

  it('carries networkConditions for a throttle-only tab (the fifth-plane early-return trap)', () => {
    const state = deriveTabControlState([], { networkConditions: slow3g });
    // No rules + no other control → the four other planes are empty/false.
    expect(state.fetchPatterns).toEqual([]);
    expect(state.bootstrapScripts).toEqual([]);
    expect(state.bypassCsp).toBe(false);
    expect(state.cacheDisabled).toBe(false);
    // …yet the tab is NOT the EMPTY singleton: the throttle is its sole plane,
    // and throttle has NO banner-free fallback, so losing it would be silent.
    expect(state.networkConditions).toEqual(slow3g);
    expect(state).not.toBe(EMPTY_TAB_CONTROL_STATE);
  });

  it('stays EMPTY when networkConditions is null and no rule contributes', () => {
    expect(deriveTabControlState([], { networkConditions: null })).toBe(EMPTY_TAB_CONTROL_STATE);
  });

  it('carries networkConditions alongside a non-empty rule-derived state', () => {
    const state = deriveTabControlState([responseRule()], { networkConditions: slow3g });
    expect(state.fetchPatterns).toEqual([{ urlPattern: '*://api.openheaders.io/*' }]);
    expect(state.networkConditions).toEqual(slow3g);
  });

  it('leaves networkConditions null on a non-empty state with no throttle', () => {
    expect(deriveTabControlState([responseRule()]).networkConditions).toBeNull();
  });

  const uaOverride = { userAgent: 'Test-Agent/1.0 (openheaders.io)' } as const;

  it('carries overrides for a UA-override-only tab (the sixth-plane early-return trap)', () => {
    const state = deriveTabControlState([], { overrides: uaOverride });
    // No rules + no other control → the five other planes are empty/false/null.
    expect(state.fetchPatterns).toEqual([]);
    expect(state.bootstrapScripts).toEqual([]);
    expect(state.bypassCsp).toBe(false);
    expect(state.cacheDisabled).toBe(false);
    expect(state.networkConditions).toBeNull();
    // …yet the tab is NOT the EMPTY singleton: the override is its sole plane,
    // and overrides have NO banner-free fallback, so losing it would be silent.
    expect(state.overrides).toEqual(uaOverride);
    expect(state).not.toBe(EMPTY_TAB_CONTROL_STATE);
  });

  it('stays EMPTY when overrides is null and no rule contributes', () => {
    expect(deriveTabControlState([], { overrides: null })).toBe(EMPTY_TAB_CONTROL_STATE);
  });

  it('carries overrides alongside a non-empty rule-derived state', () => {
    const state = deriveTabControlState([responseRule()], { overrides: uaOverride });
    expect(state.fetchPatterns).toEqual([{ urlPattern: '*://api.openheaders.io/*' }]);
    expect(state.overrides).toEqual(uaOverride);
  });

  it('leaves overrides null on a non-empty state with no override', () => {
    expect(deriveTabControlState([responseRule()]).overrides).toBeNull();
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
