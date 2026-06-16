/**
 * D4 precedence law — one mechanism per rule per request (fire-uniqueness).
 *
 * When a tab is under CDP control, its realizable debug-tier `response` /
 * `request-body` rules are realized by CDP `Fetch` EXCLUSIVELY: the
 * page-context interceptor is suppressed for them, so the request reaches the
 * network where CDP fulfils / rewrites it (visible in the Network panel) and
 * the rule fires exactly once — never on both the injection plane and the
 * Fetch plane.
 *
 * The named regression this gate catches: a static `request-body` rule on an
 * in-scope tab that matches a page `xhr` would otherwise be rewritten by the
 * in-page wrapper AND re-rewritten by CDP, double-firing. The other half of
 * the partition (CDP DOES act on these rules) is pinned by the
 * `cdp-fetch-reaction` tests; here we prove injection yields.
 *
 * Suppression is exactly `isFetchRealizableNow`: a `network`-source STATIC
 * response (D2b-1's Response-stage round-trip) and a `mock`+dynamic response
 * (D2b-2a's isolated-world eval) are both realizable now, so each joins the
 * suppressed set automatically — the predicate is the single gate, so widening
 * it extends suppression with no inject-manager change. What still stays on the
 * injection plane: a `network`+dynamic response or a dynamic `request-body`
 * (host can't eval those bodies yet — D2b-2b/c), a `delay`, or an `xhr`-only
 * response (not debug-tier at all) — CDP can't own them, so suppressing them
 * would silently disable the rule.
 */

import type { DelayRule, RequestBodyRule, ResponseRule } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/background/modules/test-runner', () => ({
  getTestScopeForTab: vi.fn(() => null),
  isRuleUnderTest: vi.fn(() => false),
}));

const spies = vi.hoisted(() => ({
  applyInjection: vi.fn(() => Promise.resolve()),
  injectScript: vi.fn(() => Promise.resolve()),
  injectCSS: vi.fn(() => Promise.resolve()),
  injectScriptUrl: vi.fn(() => Promise.resolve()),
  injectCSSUrl: vi.fn(() => Promise.resolve()),
  buildResponseInjection: vi.fn(),
  buildRequestBodyInjection: vi.fn(),
  buildDelayInjection: vi.fn(),
}));
const { buildResponseInjection, buildRequestBodyInjection, buildDelayInjection } = spies;

vi.mock('@openheaders/rule-engine/inject', () => ({
  applyInjection: spies.applyInjection,
  injectScript: spies.injectScript,
  injectCSS: spies.injectCSS,
  injectScriptUrl: spies.injectScriptUrl,
  injectCSSUrl: spies.injectCSSUrl,
}));

vi.mock('@openheaders/rule-engine/content-scripts', () => ({
  buildResponseInjection: spies.buildResponseInjection,
  buildRequestBodyInjection: spies.buildRequestBodyInjection,
  buildDelayInjection: spies.buildDelayInjection,
  buildHeaderMergeInjection: vi.fn(),
  buildWsInjection: vi.fn(),
  buildSseInjection: vi.fn(),
  buildSetupInjection: vi.fn(),
  buildResetInjection: vi.fn(),
}));

import { __testInjectForUrl, setCdpControlQuery, updateScriptableRules } from '@/background/inject-manager';

const PAGE = 'https://app.openheaders.io/dashboard';
const CDP_TAB = 7;
const PLAIN_TAB = 8;

/** A static `request-body` rule with no resource-types condition → debug-tier
 *  + realizable now. */
function requestBodyRule(overrides: Partial<RequestBodyRule> = {}): RequestBodyRule {
  return {
    schemaVersion: 5,
    uid: 'rb111111',
    path: 'rules/request-body',
    name: 'Body',
    type: 'request-body',
    enabled: true,
    conditions: [{ uid: 'tcd00060', type: 'url-filter', values: ['*://api.openheaders.io/*'] }],
    action: { bodyType: 'static', requestBody: '{"x":1}', resourceType: 'rest' },
    ...overrides,
  };
}

/** A static `response` rule with no resource-types condition → debug-tier +
 *  realizable now (source defaults to mock). */
function responseRule(action: Partial<ResponseRule['action']> = {}): ResponseRule {
  return {
    schemaVersion: 5,
    uid: 'rs111111',
    path: 'rules/response',
    name: 'Response',
    type: 'response',
    enabled: true,
    conditions: [{ uid: 'tcd00061', type: 'url-filter', values: ['*://api.openheaders.io/*'] }],
    action: {
      responseSource: 'mock',
      statusCode: 418,
      contentType: 'application/json',
      bodyType: 'static',
      responseBody: '{"oh":"mocked"}',
      responseHeaders: {},
      resourceType: 'rest',
      ...action,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateScriptableRules([]);
  setCdpControlQuery((tabId) => tabId === CDP_TAB);
});

describe('D4 precedence — CDP owns realizable debug-tier rules exclusively', () => {
  it('suppresses a static request-body interceptor on a CDP-controlled tab (the double-fire case)', async () => {
    updateScriptableRules([requestBodyRule()]);

    await __testInjectForUrl(CDP_TAB, PAGE);
    expect(buildRequestBodyInjection).not.toHaveBeenCalled();
  });

  it('still installs the same request-body interceptor on a tab NOT under CDP control', async () => {
    const rule = requestBodyRule();
    updateScriptableRules([rule]);

    await __testInjectForUrl(PLAIN_TAB, PAGE);
    expect(buildRequestBodyInjection).toHaveBeenCalledWith(rule);
    expect(buildRequestBodyInjection).toHaveBeenCalledTimes(1);
  });

  it('suppresses a static mock response interceptor on a CDP-controlled tab', async () => {
    updateScriptableRules([responseRule()]);

    await __testInjectForUrl(CDP_TAB, PAGE);
    expect(buildResponseInjection).not.toHaveBeenCalled();
  });

  it('suppresses a static network-source response on a CDP-controlled tab (D2b-1 — now realizable)', async () => {
    updateScriptableRules([responseRule({ responseSource: 'network' })]);

    await __testInjectForUrl(CDP_TAB, PAGE);
    expect(buildResponseInjection).not.toHaveBeenCalled();
  });

  it('suppresses a mock+dynamic response on a CDP-controlled tab (D2b-2a — now realizable)', async () => {
    updateScriptableRules([responseRule({ bodyType: 'dynamic', responseBody: 'function buildResponse(){return {}}' })]);

    await __testInjectForUrl(CDP_TAB, PAGE);
    expect(buildResponseInjection).not.toHaveBeenCalled();
  });

  it('keeps a dynamic network-source response on injection even under CDP control (not realizable now)', async () => {
    const rule = responseRule({ responseSource: 'network', bodyType: 'dynamic', responseBody: 'return response;' });
    updateScriptableRules([rule]);

    await __testInjectForUrl(CDP_TAB, PAGE);
    expect(buildResponseInjection).toHaveBeenCalledWith(rule);
  });

  it('keeps a dynamic request-body on injection even under CDP control (not realizable now)', async () => {
    const rule = requestBodyRule({
      action: { bodyType: 'dynamic', requestBody: 'return body;', resourceType: 'rest' },
    });
    updateScriptableRules([rule]);

    await __testInjectForUrl(CDP_TAB, PAGE);
    expect(buildRequestBodyInjection).toHaveBeenCalledWith(rule);
  });

  it('keeps a delay interceptor on injection even under CDP control (not Fetch-capable)', async () => {
    const rule: DelayRule = {
      schemaVersion: 5,
      uid: 'dl111111',
      path: 'rules/delay',
      name: 'Delay',
      type: 'delay',
      enabled: true,
      conditions: [{ uid: 'tcd00062', type: 'url-filter', values: ['*://api.openheaders.io/*'] }],
      action: { delayMs: 250 },
    };
    updateScriptableRules([rule]);

    await __testInjectForUrl(CDP_TAB, PAGE);
    expect(buildDelayInjection).toHaveBeenCalledWith(rule);
  });

  it('keeps an xhr-only response on injection even under CDP control (not debug-tier)', async () => {
    const rule = responseRule();
    rule.conditions = [...rule.conditions, { uid: 'tcd00063', type: 'resource-types', values: ['xhr'] }];
    updateScriptableRules([rule]);

    await __testInjectForUrl(CDP_TAB, PAGE);
    expect(buildResponseInjection).toHaveBeenCalledWith(rule);
  });
});
