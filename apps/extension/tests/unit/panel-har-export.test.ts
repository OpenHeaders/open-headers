import type { Page } from '@openheaders/core/page-stream';
import type { RedirectHop, RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { buildHar, serializeHar, suggestHarFilename } from '@openheaders/ui/panel/data/har-export';
import { buildInspectorRows } from '@openheaders/ui/panel/data/inspector-facet';
import { attachFiresToRows, type InspectorRowWithFires } from '@openheaders/ui/panel/data/inspector-row-projection';
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

/** A 1-redirect lifecycle (301 → 200): final-hop row, two-hop `har`. */
function redirectLifecycleRow(): InspectorRowWithFires {
  const src = 'https://openheaders.io/a';
  const dest = 'https://openheaders.io/b';
  const hop0: InspectorHarEntry = {
    startedDateTime: '2026-04-16T00:00:00.000Z',
    request: { method: 'GET', url: src, headers: [], queryString: [] },
    response: { status: 301, statusText: 'Moved', headers: [], content: { size: 0, mimeType: '' } },
  } as InspectorHarEntry;
  const hop1: InspectorHarEntry = {
    startedDateTime: '2026-04-16T00:00:00.100Z',
    request: { method: 'GET', url: dest, headers: [], queryString: [] },
    response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: '' } },
  } as InspectorHarEntry;
  const hop: RedirectHop = { sourceUrl: src, redirectUrl: dest, statusCode: 301, timestampMs: 50 };
  const lc: RequestLifecycle = {
    tabId: 1,
    requestId: 'redir',
    url: dest,
    method: 'GET',
    resourceType: 'document',
    phase: 'completed',
    redirectHopCount: 1,
    redirectHops: [hop],
    startedAtMs: 0,
    hopStartedAtMs: 100,
    completedAtMs: 150,
    statusCode: 200,
    har: [hop0, hop1],
    harBodyByHop: [],
  };
  return { lifecycle: lc, displayId: 1, consolidatedRetryOf: [], fires: [] };
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

  it('exports one entry per row — a real redirect-final row carries only its current hop', () => {
    // Redirect chains are un-folded into per-hop rows upstream
    // (`buildInspectorRows`); the real lifecycle is the final-hop row, so on
    // its own it exports just the destination (200), not the 301 leg.
    const r = redirectLifecycleRow();
    const doc = buildHar([r]);
    expect(doc.log.entries).toHaveLength(1);
    expect(doc.log.entries[0].response?.status).toBe(200);
  });

  it('exports both legs once when the redirect chain is expanded into rows', () => {
    // The full panel path: a redirect lifecycle → [301 synthetic, 200 real]
    // rows → buildHar emits each row's current hop, so both legs appear once.
    const lc = redirectLifecycleRow().lifecycle;
    const rows = attachFiresToRows(buildInspectorRows([lc]), []).rows;
    const doc = buildHar(rows);
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

  it('stamps the page ref on the document request that starts just before its page', () => {
    // The page's start is the document request's queue-adjusted start, so that
    // defining request begins marginally earlier — it must still bind to page-1.
    const pages: Page[] = [{ id: 'page-1', startedAtMs: 5, url: 'https://openheaders.io/', dclMs: 100, loadMs: 200 }];
    const doc = row('https://openheaders.io/', 0, { resourceType: 'document', startedAtMs: 0 });
    const out = buildHar([doc], pages);
    expect(out.log.pages).toHaveLength(1);
    expect(out.log.entries[0].pageref).toBe('page-1');
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
