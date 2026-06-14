/**
 * Mock / body / delay install gate: these interceptors patch fetch/XHR
 * in-page and match the REQUEST url there, so they must install wherever
 * a matching request could ORIGINATE — gated only by initiator domains,
 * never by matching the page's own URL against the request conditions.
 *
 * Regression: a static mock scoped to `*://127.0.0.1:3000/echo/mocked*`
 * never intercepted from a playground page at
 * `/src/rules/mock/index.html` because the old gate matched the PAGE url
 * against the request-URL condition (it failed) and skipped the inject —
 * so standard-mode mocking silently did nothing while CDP mode worked.
 * Same fix already shipped for header-merge / ws / sse.
 */

import type { BodyRule, DelayRule, InjectRule, MockRule } from '@openheaders/core/types';
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
  buildMockInjection: vi.fn(),
  buildBodyInjection: vi.fn(),
  buildDelayInjection: vi.fn(),
}));
const { applyInjection, injectScript, buildMockInjection, buildBodyInjection, buildDelayInjection } = spies;

vi.mock('@openheaders/rule-engine/inject', () => ({
  applyInjection: spies.applyInjection,
  injectScript: spies.injectScript,
  injectCSS: spies.injectCSS,
  injectScriptUrl: spies.injectScriptUrl,
  injectCSSUrl: spies.injectCSSUrl,
}));

vi.mock('@openheaders/rule-engine/content-scripts', () => ({
  buildMockInjection: spies.buildMockInjection,
  buildBodyInjection: spies.buildBodyInjection,
  buildDelayInjection: spies.buildDelayInjection,
  buildHeaderMergeInjection: vi.fn(),
  buildWsInjection: vi.fn(),
  buildSseInjection: vi.fn(),
}));

import { __testInjectForUrl, updateScriptableRules } from '@/background/inject-manager';

const PLAYGROUND_PAGE = 'http://127.0.0.1:3000/src/rules/mock/index.html';

function mockRule(overrides: Partial<MockRule> = {}): MockRule {
  return {
    schemaVersion: 5,
    uid: 'mk111111',
    path: 'rules/mock',
    name: 'Mock echo',
    type: 'mock',
    enabled: true,
    conditions: [{ uid: 'tcd00060', type: 'url-filter', values: ['*://127.0.0.1:3000/echo/mocked*'] }],
    action: {
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

    expect(buildMockInjection).toHaveBeenCalledWith(rule);
    expect(applyInjection).toHaveBeenCalledTimes(1);
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
    expect(applyInjection).not.toHaveBeenCalled();

    await __testInjectForUrl(1, 'https://app.openheaders.io/dashboard');
    expect(applyInjection).toHaveBeenCalledTimes(1);
  });

  it('installs body and delay interceptors on a non-matching page too', async () => {
    const bodyRule: BodyRule = {
      schemaVersion: 5,
      uid: 'bd111111',
      path: 'rules/body',
      name: 'Body',
      type: 'body',
      enabled: true,
      conditions: [{ uid: 'tcd00063', type: 'url-filter', values: ['*://127.0.0.1:3000/echo/mocked*'] }],
      action: { bodyType: 'static', body: '{"x":1}', resourceType: 'rest' },
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

    expect(buildBodyInjection).toHaveBeenCalledWith(bodyRule);
    expect(buildDelayInjection).toHaveBeenCalledWith(delayRule);
    expect(applyInjection).toHaveBeenCalledTimes(2);
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
});
