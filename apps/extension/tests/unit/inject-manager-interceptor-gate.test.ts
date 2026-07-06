/**
 * Mock / body / delay install gate: these interceptors patch fetch/XHR
 * in-page and match the REQUEST url there, so they must install wherever
 * a matching request could ORIGINATE — gated only by initiator domains,
 * never by matching the page's own URL against the request conditions.
 *
 * Regression: a static mock scoped to `*://127.0.0.1:3000/echo/mocked*`
 * never intercepted from a playground page at
 * `/src/rules/response/index.html` because the old gate matched the PAGE url
 * against the request-URL condition (it failed) and skipped the inject —
 * so standard-mode mocking silently did nothing while CDP mode worked.
 * Same fix already shipped for header-merge / ws / sse.
 */

import type { DelayRule, InjectRule, RequestBodyRule, ResponseRule } from '@openheaders/core/types';
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
  injectScriptCspExempt: vi.fn(() => Promise.resolve()),
  canExecuteCspExempt: vi.fn(() => false),
  buildResponseInjection: vi.fn(),
  buildRequestBodyInjection: vi.fn(),
  buildDelayInjection: vi.fn(),
}));
const { injectScript, injectScriptCspExempt, canExecuteCspExempt, buildResponseInjection, buildRequestBodyInjection, buildDelayInjection } =
  spies;

vi.mock('@openheaders/rule-engine/inject', () => ({
  applyInjection: spies.applyInjection,
  injectScript: spies.injectScript,
  injectCSS: spies.injectCSS,
  injectScriptUrl: spies.injectScriptUrl,
  injectCSSUrl: spies.injectCSSUrl,
  injectScriptCspExempt: spies.injectScriptCspExempt,
  canExecuteCspExempt: spies.canExecuteCspExempt,
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
  compileTerminalBlockSources: vi.fn(() => []),
}));

import { __testInjectForUrl, __testPushInterceptorUpdate, updateScriptableRules } from '@/background/inject-manager';

const PLAYGROUND_PAGE = 'http://127.0.0.1:3000/src/rules/response/index.html';

function mockRule(overrides: Partial<ResponseRule> = {}): ResponseRule {
  return {
    schemaVersion: 5,
    uid: 'mk111111',
    path: 'rules/response',
    name: 'Mock echo',
    type: 'response',
    enabled: true,
    conditions: [{ uid: 'tcd00060', type: 'url-filter', values: ['*://127.0.0.1:3000/echo/mocked*'] }],
    action: {
      responseSource: 'mock',
      statusCode: 418,
      contentType: 'application/json',
      bodyType: 'static',
      responseBody: '{"oh":"mocked"}',
      responseHeaders: {},
      resourceType: 'rest',
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateScriptableRules([]);
});

describe('mock/body/delay interceptor install gate', () => {
  it('installs the mock on a page whose URL does NOT match the request conditions (the standard-mode bug)', async () => {
    const rule = mockRule();
    updateScriptableRules([rule]);
    await __testInjectForUrl(1, PLAYGROUND_PAGE);

    expect(buildResponseInjection).toHaveBeenCalledWith(rule, []);
    expect(buildResponseInjection).toHaveBeenCalledTimes(1);
  });

  it('honours initiator-domains: skips a page outside the allowed initiator', async () => {
    const rule = mockRule({
      conditions: [
        { uid: 'tcd00061', type: 'url-filter', values: ['*://127.0.0.1:3000/echo/mocked*'] },
        { uid: 'tcd00062', type: 'initiator-domains', values: ['app.openheaders.io'] },
      ],
    });
    updateScriptableRules([rule]);

    await __testInjectForUrl(1, PLAYGROUND_PAGE);
    expect(buildResponseInjection).not.toHaveBeenCalled();

    await __testInjectForUrl(1, 'https://app.openheaders.io/dashboard');
    expect(buildResponseInjection).toHaveBeenCalledTimes(1);
  });

  it('installs body and delay interceptors on a non-matching page too', async () => {
    const bodyRule: RequestBodyRule = {
      schemaVersion: 5,
      uid: 'bd111111',
      path: 'rules/body',
      name: 'Body',
      type: 'request-body',
      enabled: true,
      conditions: [{ uid: 'tcd00063', type: 'url-filter', values: ['*://127.0.0.1:3000/echo/mocked*'] }],
      action: { bodyType: 'static', requestBody: '{"x":1}', resourceType: 'rest' },
    };
    const delayRule: DelayRule = {
      schemaVersion: 5,
      uid: 'dl111111',
      path: 'rules/delay',
      name: 'Delay',
      type: 'delay',
      enabled: true,
      conditions: [{ uid: 'tcd00064', type: 'url-filter', values: ['*://127.0.0.1:3000/echo/mocked*'] }],
      action: { delayMs: 500 },
    };
    updateScriptableRules([bodyRule, delayRule]);
    await __testInjectForUrl(1, PLAYGROUND_PAGE);

    expect(buildRequestBodyInjection).toHaveBeenCalledWith(bodyRule, []);
    expect(buildDelayInjection).toHaveBeenCalledWith(delayRule, []);
  });

  it('pushes interceptor updates to open tabs: reset then re-inject, inject rules excluded', async () => {
    const injectRule: InjectRule = {
      schemaVersion: 5,
      uid: 'in222222',
      path: 'rules/inject',
      name: 'Inject',
      type: 'inject',
      enabled: true,
      conditions: [{ uid: 'tcd00066', type: 'url-filter', values: ['*://127.0.0.1:3000/*'] }],
      action: { injectType: 'script', source: 'code', code: 'void 0;', position: 'head' },
    };
    const rule = mockRule();
    // Seed the active set (this auto-push runs against the default tabs
    // mock, which returns undefined → no-op).
    updateScriptableRules([rule, injectRule]);
    spies.applyInjection.mockClear();
    spies.buildResponseInjection.mockClear();
    injectScript.mockClear();

    // Now an open tab exists — drive the push explicitly.
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: 7, url: 'http://127.0.0.1:3000/app' },
    ]);
    await __testPushInterceptorUpdate();

    // Reset fires first, then the interceptor re-injects.
    expect(spies.applyInjection).toHaveBeenCalledWith(7, undefined, 'oh-reset');
    expect(spies.buildResponseInjection).toHaveBeenCalledWith(rule, []);
    // Inject rules are navigation-only — never part of the push.
    expect(injectScript).not.toHaveBeenCalled();
  });

  it('inject rules still gate on the PAGE url (their conditions target pages)', async () => {
    const injectRule: InjectRule = {
      schemaVersion: 5,
      uid: 'in111111',
      path: 'rules/inject',
      name: 'Inject',
      type: 'inject',
      enabled: true,
      conditions: [{ uid: 'tcd00065', type: 'url-filter', values: ['*://app.openheaders.io/*'] }],
      action: { injectType: 'script', source: 'code', code: 'void 0;', position: 'head' },
    };
    updateScriptableRules([injectRule]);

    // Page URL does not match the inject rule's page condition → no inject.
    await __testInjectForUrl(1, PLAYGROUND_PAGE);
    expect(injectScript).not.toHaveBeenCalled();

    // Page URL matches → inject runs.
    await __testInjectForUrl(1, 'https://app.openheaders.io/');
    expect(injectScript).toHaveBeenCalledTimes(1);
  });

  function bypassCspInjectRule(): InjectRule {
    return {
      schemaVersion: 5,
      uid: 'cs111111',
      path: 'rules/inject',
      name: 'Bypass CSP inject',
      type: 'inject',
      enabled: true,
      conditions: [{ uid: 'tcd00067', type: 'url-filter', values: ['*://app.openheaders.io/*'] }],
      action: { injectType: 'script', source: 'code', code: 'window.__x = 1;', position: 'head', bypassCSP: true },
    };
  }

  it('routes a bypassCSP script through the CSP-exempt path when available', async () => {
    canExecuteCspExempt.mockReturnValue(true);
    updateScriptableRules([bypassCspInjectRule()]);
    await __testInjectForUrl(1, 'https://app.openheaders.io/');
    expect(injectScriptCspExempt).toHaveBeenCalledWith(1, 'window.__x = 1;', 'head');
    expect(injectScript).not.toHaveBeenCalled();
  });

  it('falls back to the <script>-tag path when the CSP-exempt API is unavailable', async () => {
    canExecuteCspExempt.mockReturnValue(false);
    updateScriptableRules([bypassCspInjectRule()]);
    await __testInjectForUrl(1, 'https://app.openheaders.io/');
    expect(injectScript).toHaveBeenCalledWith(1, 'window.__x = 1;', 'head');
    expect(injectScriptCspExempt).not.toHaveBeenCalled();
  });

  it('does NOT use the CSP-exempt path for a rule without bypassCSP', async () => {
    canExecuteCspExempt.mockReturnValue(true);
    const rule = bypassCspInjectRule();
    rule.action.bypassCSP = false;
    updateScriptableRules([rule]);
    await __testInjectForUrl(1, 'https://app.openheaders.io/');
    expect(injectScript).toHaveBeenCalledTimes(1);
    expect(injectScriptCspExempt).not.toHaveBeenCalled();
  });
});
