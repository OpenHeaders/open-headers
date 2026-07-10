/**
 * Header-merge install gate: the in-page interceptor installs wherever a
 * matching request could originate, NOT only on pages whose own URL
 * matches the rule's URL conditions — those conditions target REQUEST
 * urls and are matched in-page. The only legitimate page-level gate is
 * the initiator-domain rows: a page's fetch/XHR requests carry its
 * origin as initiator.
 *
 * Regression for the S42 engine finding: an endpoint-scoped merge rule
 * (`*://127.0.0.1:3000/api/secure/echo?cell=r5*`) never injected on any
 * page because the old gate matched the PAGE url against request-URL
 * conditions.
 */

import type { HeaderRule, RuleCondition } from '@openheaders/core/types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { __testExtractHeaderMergeEntry, __testShouldInstallForPage } from '@/background/inject-manager';

function makeMergeRule(conditions: RuleCondition[], overrides: Partial<HeaderRule> = {}): HeaderRule {
  return {
    schemaVersion: 5,
    uid: 'hm111111',
    path: 'rules/merge',
    name: 'Merge rule',
    type: 'header',
    enabled: true,
    conditions,
    action: {
      requestHeaders: [{ uid: 'thm00020', operation: 'merge', headerName: 'X-OH-Merge', value: 'extra' }],
      responseHeaders: [],
    },
    ...overrides,
  };
}

function entryFor(conditions: RuleCondition[]) {
  const entry = __testExtractHeaderMergeEntry(makeMergeRule(conditions));
  expect(entry).not.toBeNull();
  return entry!;
}

describe('extractHeaderMergeEntry — initiator-domain rows', () => {
  it('collects initiator-domains and exclude-initiator-domains values', () => {
    const entry = entryFor([
      { uid: 'tcd00040', type: 'url-filter', values: ['*://api.openheaders.io/*'] },
      { uid: 'tcd00041', type: 'initiator-domains', values: ['openheaders.io', ' app.openheaders.dev '] },
      { uid: 'tcd00042', type: 'exclude-initiator-domains', values: ['internal.openheaders.io'] },
    ]);
    expect(entry.initiatorDomains).toEqual(['openheaders.io', 'app.openheaders.dev']);
    expect(entry.excludedInitiatorDomains).toEqual(['internal.openheaders.io']);
  });

  it('leaves both lists empty when no initiator rows exist', () => {
    const entry = entryFor([{ uid: 'tcd00043', type: 'url-filter', values: ['*://api.openheaders.io/*'] }]);
    expect(entry.initiatorDomains).toEqual([]);
    expect(entry.excludedInitiatorDomains).toEqual([]);
  });
});

describe('shouldInstallMergeForPage', () => {
  it('installs on a page whose URL does NOT match the request-URL conditions (the S42 finding)', () => {
    const entry = entryFor([
      { uid: 'tcd00044', type: 'url-filter', values: ['*://127.0.0.1:3000/api/secure/echo?cell=r5*'] },
    ]);
    expect(__testShouldInstallForPage(entry, 'http://127.0.0.1:3000/auth/dashboard.html')).toBe(true);
    expect(__testShouldInstallForPage(entry, 'https://openheaders.io/')).toBe(true);
  });

  it('never installs for an entry with no URL conditions (matches no request)', () => {
    const entry = entryFor([{ uid: 'tcd00045', type: 'request-methods', values: ['GET'] }]);
    expect(__testShouldInstallForPage(entry, 'https://openheaders.io/')).toBe(false);
  });

  it('gates on initiator-domains when present (domain + subdomains)', () => {
    const entry = entryFor([
      { uid: 'tcd00046', type: 'url-filter', values: ['*://api.openheaders.io/*'] },
      { uid: 'tcd00047', type: 'initiator-domains', values: ['openheaders.io'] },
    ]);
    expect(__testShouldInstallForPage(entry, 'https://openheaders.io/app')).toBe(true);
    expect(__testShouldInstallForPage(entry, 'https://dash.openheaders.io/')).toBe(true);
    expect(__testShouldInstallForPage(entry, 'https://openheaders.dev/')).toBe(false);
  });

  it('skips pages on the exclude-initiator-domains list', () => {
    const entry = entryFor([
      { uid: 'tcd00048', type: 'url-filter', values: ['*://api.openheaders.io/*'] },
      { uid: 'tcd00049', type: 'exclude-initiator-domains', values: ['internal.openheaders.io'] },
    ]);
    expect(__testShouldInstallForPage(entry, 'https://internal.openheaders.io/tools')).toBe(false);
    expect(__testShouldInstallForPage(entry, 'https://openheaders.io/')).toBe(true);
  });

  it('applies exclude before include when both are present', () => {
    const entry = entryFor([
      { uid: 'tcd00050', type: 'url-filter', values: ['*://api.openheaders.io/*'] },
      { uid: 'tcd00051', type: 'initiator-domains', values: ['openheaders.io'] },
      { uid: 'tcd00052', type: 'exclude-initiator-domains', values: ['staging.openheaders.io'] },
    ]);
    expect(__testShouldInstallForPage(entry, 'https://staging.openheaders.io/')).toBe(false);
    expect(__testShouldInstallForPage(entry, 'https://app.openheaders.io/')).toBe(true);
  });

  it('treats an unparseable page URL as no-host: initiator-gated rules skip, ungated rules install', () => {
    const gated = entryFor([
      { uid: 'tcd00053', type: 'url-filter', values: ['*://api.openheaders.io/*'] },
      { uid: 'tcd00054', type: 'initiator-domains', values: ['openheaders.io'] },
    ]);
    const ungated = entryFor([{ uid: 'tcd00055', type: 'url-filter', values: ['*://api.openheaders.io/*'] }]);
    expect(__testShouldInstallForPage(gated, 'not a url')).toBe(false);
    expect(__testShouldInstallForPage(ungated, 'not a url')).toBe(true);
  });
});
