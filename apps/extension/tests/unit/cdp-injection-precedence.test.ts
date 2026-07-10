/**
 * D4a / E1b precedence law — one delivery per rule per request (fire-uniqueness).
 *
 * When a tab is under CDP control, every rule it owns is delivered on EXACTLY
 * ONE plane, never two — so the rule fires once, not on both the page-context
 * interceptor and the CDP plane. Two precedence axes split on the single
 * `isFetchRealizableNow` partition line:
 *
 *   - MODIFICATION (D4a): a realizable debug-tier `response` / `request-body`
 *     is realized at the NETWORK layer (CDP `Fetch`, visible in the Network
 *     panel); the `onCommitted` wrapper is suppressed for it.
 *   - DELIVERY (E1b): the COMPLEMENT — the residual, page-independent wrappers
 *     (`isBootstrapEligible`: `delay`, `ws`/`sse`, header-merge, an `xhr`-only
 *     response) — is delivered BEFORE page scripts via a CDP document-bootstrap
 *     script; the `onCommitted` wrapper is suppressed for it on the FRESH
 *     document so it installs once.
 *
 * The named regression D4a catches: a static `request-body` on an in-scope tab
 * matching a page `xhr` would otherwise be rewritten by the in-page wrapper AND
 * re-rewritten by CDP, double-firing. E1b adds: a `delay` would otherwise be
 * installed by BOTH the bootstrap and `onCommitted`, double-installing.
 *
 * Two delivery carve-outs stay on the `onCommitted` path even under CDP control:
 * an initiator-domain-gated wrapper (a page-origin gate a bootstrap script,
 * which persists across navigations, cannot enforce), and ANY wrapper on the
 * current-document refresh path (a bootstrap reaches only FUTURE documents, so
 * the current page's wrappers must still install — an arming tab never loses
 * them mid-page). Both are proven below.
 */

import type { DelayRule, RequestBodyRule, ResponseRule } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
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
  compileTerminalBlockSources: vi.fn(() => []),
}));

import {
  __testInjectForUrl,
  __testRefreshInterceptorsForTab,
  setCdpControlQuery,
  updateScriptableRules,
} from '@/background/inject-manager';

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

/** A delay rule — never Fetch-capable, so a residual wrapper (bootstrap-eligible
 *  unless initiator-gated). */
function delayRule(overrides: Partial<DelayRule> = {}): DelayRule {
  return {
    schemaVersion: 5,
    uid: 'dl111111',
    path: 'rules/delay',
    name: 'Delay',
    type: 'delay',
    enabled: true,
    conditions: [{ uid: 'tcd00062', type: 'url-filter', values: ['*://api.openheaders.io/*'] }],
    action: { delayMs: 250 },
    ...overrides,
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
    expect(buildRequestBodyInjection).toHaveBeenCalledWith(rule, []);
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

  it('suppresses a network+dynamic response on a CDP-controlled tab (D2b-2b — now realizable)', async () => {
    const rule = responseRule({
      responseSource: 'network',
      bodyType: 'dynamic',
      responseBody: 'function modifyResponse(a){return a.response}',
    });
    updateScriptableRules([rule]);

    await __testInjectForUrl(CDP_TAB, PAGE);
    expect(buildResponseInjection).not.toHaveBeenCalled();
  });

  it('suppresses a dynamic request-body on a CDP-controlled tab (D2b-2c — now realizable)', async () => {
    const rule = requestBodyRule({
      action: {
        bodyType: 'dynamic',
        requestBody: 'function modifyRequestBody(a){return a.body}',
        resourceType: 'rest',
      },
    });
    updateScriptableRules([rule]);

    await __testInjectForUrl(CDP_TAB, PAGE);
    expect(buildRequestBodyInjection).not.toHaveBeenCalled();
  });

  it('suppresses a delay wrapper on the fresh document under CDP control (E1b — bootstrap delivers it)', async () => {
    updateScriptableRules([delayRule()]);

    await __testInjectForUrl(CDP_TAB, PAGE);
    expect(buildDelayInjection).not.toHaveBeenCalled();
  });

  it('suppresses an xhr-only response on the fresh document under CDP control (E1b — residual wrapper)', async () => {
    const rule = responseRule();
    rule.conditions = [...rule.conditions, { uid: 'tcd00063', type: 'resource-types', values: ['xhr'] }];
    updateScriptableRules([rule]);

    await __testInjectForUrl(CDP_TAB, PAGE);
    expect(buildResponseInjection).not.toHaveBeenCalled();
  });

  it('keeps an initiator-domain-gated delay on injection (a page-origin gate bootstrap cannot enforce)', async () => {
    const rule = delayRule({
      conditions: [
        { uid: 'tcd00064', type: 'url-filter', values: ['*://api.openheaders.io/*'] },
        { uid: 'tcd00065', type: 'initiator-domains', values: ['app.openheaders.io'] },
      ],
    });
    updateScriptableRules([rule]);

    await __testInjectForUrl(CDP_TAB, PAGE);
    expect(buildDelayInjection).toHaveBeenCalledWith(rule, []);
  });

  // X1: a debug-tier `response`/`request-body` carrying a condition NO Fetch
  // stage can evaluate (initiator-domains, domain-type) is declined by the CDP
  // reaction resolvers (they pass it through). Suppressing its injection too
  // would realize it NOWHERE on an in-scope tab — yet it worked over page xhr
  // while out of scope. `isCdpEvaluable` keeps such a rule on injection.

  it('keeps an initiator-domain-gated debug-tier response on injection (CDP cannot evaluate the initiator gate)', async () => {
    const rule = responseRule();
    rule.conditions = [
      ...rule.conditions,
      { uid: 'tcd00066', type: 'initiator-domains', values: ['app.openheaders.io'] },
    ];
    updateScriptableRules([rule]);

    await __testInjectForUrl(CDP_TAB, PAGE);
    expect(buildResponseInjection).toHaveBeenCalledWith(rule, []);
  });

  it('keeps a domain-type-gated debug-tier response on injection (no Fetch stage evaluates domain-type)', async () => {
    const rule = responseRule();
    rule.conditions = [...rule.conditions, { uid: 'tcd00067', type: 'domain-type', values: ['thirdParty'] }];
    updateScriptableRules([rule]);

    await __testInjectForUrl(CDP_TAB, PAGE);
    expect(buildResponseInjection).toHaveBeenCalledWith(rule, []);
  });

  it('still installs the delay wrapper on injection on the same tab NOT under CDP control', async () => {
    const rule = delayRule();
    updateScriptableRules([rule]);

    await __testInjectForUrl(PLAIN_TAB, PAGE);
    expect(buildDelayInjection).toHaveBeenCalledWith(rule, []);
  });

  it('re-installs the delay wrapper on the CURRENT document refresh under CDP control (no mid-page loss)', async () => {
    const rule = delayRule();
    updateScriptableRules([rule]);
    (chrome.tabs.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: CDP_TAB, url: PAGE });

    // The scope-change / live-edit refresh acts on the already-loaded document,
    // which a bootstrap script never reached — so the residual wrapper installs
    // here even though the fresh-document path suppresses it.
    await __testRefreshInterceptorsForTab(CDP_TAB);
    expect(buildDelayInjection).toHaveBeenCalledWith(rule, []);
  });
});
