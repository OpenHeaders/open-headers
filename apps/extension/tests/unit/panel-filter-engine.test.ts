import { DEFAULT_FILTER_CONFIG, passesRowFilters } from '@openheaders/ui/panel/data/filter-engine';
import type { InspectorRequest } from '@openheaders/ui/panel/data/types';
import { describe, expect, it } from 'vitest';
import type { InspectorHarEntry } from '@/background/modules/devtools-inspector-port';

function req(url: string, overrides: Partial<InspectorRequest> = {}): InspectorRequest {
  const har: InspectorHarEntry = {
    startedDateTime: '2026-04-16T00:00:00.000Z',
    request: { method: 'GET', url, headers: [], queryString: [] },
    response: {
      status: overrides.statusCode ?? 200,
      statusText: overrides.statusText ?? 'OK',
      headers: [],
      content: { size: 0, mimeType: 'text/plain' },
    },
  };
  return {
    id: url,
    harEntry: har,
    method: 'GET',
    url,
    timestamp: 0,
    fires: [],
    arrivalIndex: 0,
    displayId: 1,
    ...overrides,
  };
}

describe('passesRowFilters', () => {
  it('passes everything by default', () => {
    expect(passesRowFilters(req('https://api.openheaders.io/v2/config'), DEFAULT_FILTER_CONFIG)).toBe(true);
    expect(passesRowFilters(req('data:text/plain;base64,aGk='), DEFAULT_FILTER_CONFIG)).toBe(true);
  });

  it('hideDataUrls hides data: URLs', () => {
    const cfg = { ...DEFAULT_FILTER_CONFIG, hideDataUrls: true };
    expect(passesRowFilters(req('data:text/plain;base64,aGk='), cfg)).toBe(false);
    expect(passesRowFilters(req('https://api.openheaders.io/x'), cfg)).toBe(true);
  });

  it('hideDataUrls hides blob: URLs', () => {
    const cfg = { ...DEFAULT_FILTER_CONFIG, hideDataUrls: true };
    expect(passesRowFilters(req('blob:https://app.openheaders.io/abc'), cfg)).toBe(false);
  });

  it('onlyThirdParty is a no-op until pageOrigin is known', () => {
    // Until we know the page's own origin we can't decide what's
    // third-party. Rather than hiding everything, behave as if the
    // filter isn't set.
    const cfg = { ...DEFAULT_FILTER_CONFIG, onlyThirdParty: true, pageOrigin: null };
    expect(passesRowFilters(req('https://third.example.com/x'), cfg)).toBe(true);
    expect(passesRowFilters(req('https://app.openheaders.io/x'), cfg)).toBe(true);
  });

  it('onlyThirdParty shows only cross-origin requests (matches Chrome)', () => {
    const cfg = { ...DEFAULT_FILTER_CONFIG, onlyThirdParty: true, pageOrigin: 'https://app.openheaders.io' };
    expect(passesRowFilters(req('https://analytics.example.com/t'), cfg)).toBe(true);
    expect(passesRowFilters(req('https://app.openheaders.io/v2/config'), cfg)).toBe(false);
  });

  it('treats different subdomains as third-party (origin is scheme+host+port)', () => {
    const cfg = { ...DEFAULT_FILTER_CONFIG, onlyThirdParty: true, pageOrigin: 'https://app.openheaders.io' };
    expect(passesRowFilters(req('https://api.openheaders.io/v2/config'), cfg)).toBe(true);
    expect(passesRowFilters(req('https://app.openheaders.io/v2/config'), cfg)).toBe(false);
  });

  it('onlyBlockedRequests restricts the list to blocked requests', () => {
    const cfg = { ...DEFAULT_FILTER_CONFIG, onlyBlockedRequests: true };
    const blocked = req('https://api.openheaders.io/x', { statusCode: 0, statusText: 'net::ERR_BLOCKED_BY_CLIENT' });
    const ok = req('https://api.openheaders.io/y', { statusCode: 200, statusText: 'OK' });
    expect(passesRowFilters(blocked, cfg)).toBe(true);
    expect(passesRowFilters(ok, cfg)).toBe(false);
  });

  it('hideExtensionUrls hides extension-scheme URLs', () => {
    const cfg = { ...DEFAULT_FILTER_CONFIG, hideExtensionUrls: true };
    expect(passesRowFilters(req('chrome-extension://abcd/foo.js'), cfg)).toBe(false);
    expect(passesRowFilters(req('moz-extension://abcd/foo.js'), cfg)).toBe(false);
    expect(passesRowFilters(req('safari-web-extension://abcd/foo.js'), cfg)).toBe(false);
    expect(passesRowFilters(req('https://api.openheaders.io/x'), cfg)).toBe(true);
  });

  it('combines hideDataUrls and onlyThirdParty correctly', () => {
    const cfg = {
      ...DEFAULT_FILTER_CONFIG,
      hideDataUrls: true,
      onlyThirdParty: true,
      pageOrigin: 'https://app.openheaders.io',
    };
    expect(passesRowFilters(req('data:text/plain,hi'), cfg)).toBe(false); // data URL
    expect(passesRowFilters(req('https://app.openheaders.io/x'), cfg)).toBe(false); // same origin
    expect(passesRowFilters(req('https://api.openheaders.io/x'), cfg)).toBe(true); // third-party, not data
  });

  it('returns true when url is unparseable and pageOrigin is set', () => {
    // Defensive: `new URL(e.url)` throws for malformed URLs; passesRowFilters
    // must not crash and must not silently hide the row.
    const cfg = { ...DEFAULT_FILTER_CONFIG, onlyThirdParty: true, pageOrigin: 'https://app.openheaders.io' };
    expect(passesRowFilters(req('not-a-url'), cfg)).toBe(true);
  });
});
