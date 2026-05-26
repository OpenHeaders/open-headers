import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { DEFAULT_FILTER_CONFIG, passesRowFilters } from '@openheaders/ui/panel/data/filter-engine';
import { describe, expect, it } from 'vitest';

function lifecycle(url: string, overrides: Partial<RequestLifecycle> = {}): RequestLifecycle {
  const har: InspectorHarEntry = {
    startedDateTime: '2026-04-16T00:00:00.000Z',
    request: { method: 'GET', url, headers: [], queryString: [] },
    response: {
      status: overrides.statusCode ?? 200,
      statusText: overrides.statusText ?? 'OK',
      headers: [],
      content: { size: 0, mimeType: 'text/plain' },
    },
  } as InspectorHarEntry;
  return {
    tabId: 1,
    requestId: url,
    url,
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 0,
    hopStartedAtMs: 0,
    statusCode: 200,
    har: new Map([[0, har]]),
    harBodyByHop: new Map(),
    ...overrides,
  };
}

describe('passesRowFilters', () => {
  it('passes everything by default', () => {
    expect(passesRowFilters(lifecycle('https://api.openheaders.io/v2/config'), DEFAULT_FILTER_CONFIG)).toBe(true);
    expect(passesRowFilters(lifecycle('data:text/plain;base64,aGk='), DEFAULT_FILTER_CONFIG)).toBe(true);
  });

  it('hideDataUrls hides data: URLs', () => {
    const cfg = { ...DEFAULT_FILTER_CONFIG, hideDataUrls: true };
    expect(passesRowFilters(lifecycle('data:text/plain;base64,aGk='), cfg)).toBe(false);
    expect(passesRowFilters(lifecycle('https://api.openheaders.io/x'), cfg)).toBe(true);
  });

  it('hideDataUrls hides blob: URLs', () => {
    const cfg = { ...DEFAULT_FILTER_CONFIG, hideDataUrls: true };
    expect(passesRowFilters(lifecycle('blob:https://app.openheaders.io/abc'), cfg)).toBe(false);
  });

  it('onlyThirdParty is a no-op until pageOrigin is known', () => {
    const cfg = { ...DEFAULT_FILTER_CONFIG, onlyThirdParty: true, pageOrigin: null };
    expect(passesRowFilters(lifecycle('https://third.example.com/x'), cfg)).toBe(true);
    expect(passesRowFilters(lifecycle('https://app.openheaders.io/x'), cfg)).toBe(true);
  });

  it('onlyThirdParty shows only cross-origin requests', () => {
    const cfg = { ...DEFAULT_FILTER_CONFIG, onlyThirdParty: true, pageOrigin: 'https://app.openheaders.io' };
    expect(passesRowFilters(lifecycle('https://analytics.example.com/t'), cfg)).toBe(true);
    expect(passesRowFilters(lifecycle('https://app.openheaders.io/v2/config'), cfg)).toBe(false);
  });

  it('treats different subdomains as third-party (origin is scheme+host+port)', () => {
    const cfg = { ...DEFAULT_FILTER_CONFIG, onlyThirdParty: true, pageOrigin: 'https://app.openheaders.io' };
    expect(passesRowFilters(lifecycle('https://api.openheaders.io/v2/config'), cfg)).toBe(true);
    expect(passesRowFilters(lifecycle('https://app.openheaders.io/v2/config'), cfg)).toBe(false);
  });

  it('onlyBlockedRequests restricts the list to blocked requests', () => {
    const cfg = { ...DEFAULT_FILTER_CONFIG, onlyBlockedRequests: true };
    const blocked = lifecycle('https://api.openheaders.io/x', {
      statusCode: 0,
      statusText: 'net::ERR_BLOCKED_BY_CLIENT',
    });
    const ok = lifecycle('https://api.openheaders.io/y', { statusCode: 200, statusText: 'OK' });
    expect(passesRowFilters(blocked, cfg)).toBe(true);
    expect(passesRowFilters(ok, cfg)).toBe(false);
  });

  it('hideExtensionUrls hides extension-scheme URLs', () => {
    const cfg = { ...DEFAULT_FILTER_CONFIG, hideExtensionUrls: true };
    expect(passesRowFilters(lifecycle('chrome-extension://abcd/foo.js'), cfg)).toBe(false);
    expect(passesRowFilters(lifecycle('moz-extension://abcd/foo.js'), cfg)).toBe(false);
    expect(passesRowFilters(lifecycle('safari-web-extension://abcd/foo.js'), cfg)).toBe(false);
    expect(passesRowFilters(lifecycle('https://api.openheaders.io/x'), cfg)).toBe(true);
  });

  it('combines hideDataUrls and onlyThirdParty correctly', () => {
    const cfg = {
      ...DEFAULT_FILTER_CONFIG,
      hideDataUrls: true,
      onlyThirdParty: true,
      pageOrigin: 'https://app.openheaders.io',
    };
    expect(passesRowFilters(lifecycle('data:text/plain,hi'), cfg)).toBe(false);
    expect(passesRowFilters(lifecycle('https://app.openheaders.io/x'), cfg)).toBe(false);
    expect(passesRowFilters(lifecycle('https://api.openheaders.io/x'), cfg)).toBe(true);
  });

  it('returns true when url is unparseable and pageOrigin is set', () => {
    const cfg = { ...DEFAULT_FILTER_CONFIG, onlyThirdParty: true, pageOrigin: 'https://app.openheaders.io' };
    expect(passesRowFilters(lifecycle('not-a-url'), cfg)).toBe(true);
  });
});
