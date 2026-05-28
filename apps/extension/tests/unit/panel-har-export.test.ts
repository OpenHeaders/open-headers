import type { Page } from '@openheaders/core/page-stream';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { buildHar, serializeHar, suggestHarFilename } from '@openheaders/ui/panel/data/har-export';
import type { InspectorRowWithFires } from '@openheaders/ui/panel/data/inspector-row-projection';
import { describe, expect, it, vi } from 'vitest';

function row(url: string, idx = 0, overrides: Partial<RequestLifecycle> = {}): InspectorRowWithFires {
  const startedAtMs = idx * 100;
  const har: InspectorHarEntry = {
    startedDateTime: `2026-04-16T00:00:${String(idx).padStart(2, '0')}.000Z`,
    request: { method: 'GET', url, headers: [], queryString: [] },
    response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: 'text/plain' } },
  } as InspectorHarEntry;
  const lc: RequestLifecycle = {
    tabId: 1,
    requestId: `r-${idx}-${url}`,
    url,
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs,
    hopStartedAtMs: startedAtMs,
    completedAtMs: startedAtMs + 50,
    statusCode: 200,
    har: [har],
    harBodyByHop: [],
    ...overrides,
  };
  return { lifecycle: lc, displayId: idx + 1, consolidatedRetryOf: [], fires: [] };
}

describe('buildHar', () => {
  it('emits a valid HAR 1.2 envelope with the provided rows', () => {
    const rows = [row('https://api.openheaders.io/a'), row('https://api.openheaders.io/b', 1)];
    const doc = buildHar(rows);
    expect(doc.log.version).toBe('1.2');
    expect(doc.log.creator.name).toBe('Open Headers DevTools');
    expect(doc.log.pages).toEqual([]);
    expect(doc.log.entries).toHaveLength(2);
    expect(doc.log.entries[0].request?.url).toBe('https://api.openheaders.io/a');
  });

  it('produces an empty entries array when no rows are given', () => {
    const doc = buildHar([]);
    expect(doc.log.entries).toEqual([]);
  });

  it('omits rows whose lifecycle has no HAR shell yet (pending placeholders)', () => {
    const ok = row('https://api.openheaders.io/a');
    const pendingPlaceholder = row('https://blocked.openheaders.io/b', 1, {
      phase: 'pending',
      har: [],
      statusCode: undefined,
    });
    const doc = buildHar([ok, pendingPlaceholder]);
    expect(doc.log.entries).toHaveLength(1);
    expect(doc.log.entries[0].request?.url).toBe('https://api.openheaders.io/a');
  });

  it('walks redirect hops in ascending order', () => {
    const url = 'https://openheaders.io/a';
    const hop0: InspectorHarEntry = {
      startedDateTime: '2026-04-16T00:00:00.000Z',
      request: { method: 'GET', url, headers: [], queryString: [] },
      response: { status: 301, statusText: 'Moved', headers: [], content: { size: 0, mimeType: '' } },
    } as InspectorHarEntry;
    const hop1: InspectorHarEntry = {
      startedDateTime: '2026-04-16T00:00:00.100Z',
      request: { method: 'GET', url: 'https://openheaders.io/b', headers: [], queryString: [] },
      response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: '' } },
    } as InspectorHarEntry;
    const lc: RequestLifecycle = {
      tabId: 1,
      requestId: 'redir',
      url: 'https://openheaders.io/b',
      method: 'GET',
      resourceType: 'document',
      phase: 'completed',
      redirectHopCount: 1,
      redirectHops: [],
      startedAtMs: 0,
      hopStartedAtMs: 100,
      completedAtMs: 150,
      statusCode: 200,
      har: [hop0, hop1],
      harBodyByHop: [],
    };
    const r: InspectorRowWithFires = { lifecycle: lc, displayId: 1, consolidatedRetryOf: [], fires: [] };
    const doc = buildHar([r]);
    expect(doc.log.entries).toHaveLength(2);
    expect(doc.log.entries[0].response?.status).toBe(301);
    expect(doc.log.entries[1].response?.status).toBe(200);
  });

  it('emits referenced pages with pageref on each entry', () => {
    const pageStartedAtMs = 0;
    const pages: Page[] = [
      { id: 'page-1', startedAtMs: pageStartedAtMs, url: 'https://openheaders.io/', dclMs: 100, loadMs: 200 },
    ];
    const r = row('https://openheaders.io/a', 1);
    const doc = buildHar([r], pages);
    expect(doc.log.pages).toHaveLength(1);
    expect(doc.log.pages[0].id).toBe('page-1');
    expect(doc.log.entries[0].pageref).toBe('page-1');
  });
});

describe('serializeHar', () => {
  it('round-trips through JSON.parse', () => {
    const rows = [row('https://api.openheaders.io/x')];
    const json = serializeHar(rows);
    const parsed = JSON.parse(json);
    expect(parsed.log.version).toBe('1.2');
    expect(parsed.log.entries).toHaveLength(1);
  });

  it('uses 2-space indentation', () => {
    const json = serializeHar([]);
    expect(json).toContain('\n  "log"');
  });
});

describe('suggestHarFilename', () => {
  it('falls back to "network" when no rows are available', () => {
    expect(suggestHarFilename([])).toMatch(/^network-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.har$/);
  });

  it('uses the first parseable hostname', () => {
    vi.setSystemTime(new Date('2026-04-16T19:35:00.000Z'));
    const name = suggestHarFilename([row('https://api.openheaders.io/y')]);
    expect(name).toMatch(/^api\.openheaders\.io-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.har$/);
    vi.useRealTimers();
  });

  it('skips unparseable urls to find a host', () => {
    const name = suggestHarFilename([row('not-a-url'), row('https://app.openheaders.io/x', 1)]);
    expect(name).toMatch(/^app\.openheaders\.io-/);
  });
});
