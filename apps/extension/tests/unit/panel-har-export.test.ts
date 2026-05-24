import { buildHar, serializeHar, suggestHarFilename } from '@openheaders/ui/panel/data/har-export';
import type { InspectorRequest } from '@openheaders/ui/panel/data/types';
import { describe, expect, it, vi } from 'vitest';
import type { InspectorHarEntry } from '@/background/modules/devtools-inspector-port';

function req(url: string, idx = 0): InspectorRequest {
  const har: InspectorHarEntry = {
    startedDateTime: `2026-04-16T00:00:${String(idx).padStart(2, '0')}.000Z`,
    request: { method: 'GET', url, headers: [], queryString: [] },
    response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: 'text/plain' } },
  };
  return {
    id: `${idx}-${url}`,
    harEntry: har,
    method: 'GET',
    url,
    timestamp: Date.parse(har.startedDateTime),
    fires: [],
    arrivalIndex: idx,
    displayId: idx + 1,
  };
}

describe('buildHar', () => {
  it('emits a valid HAR 1.2 envelope with the provided entries', () => {
    const entries = [req('https://api.openheaders.io/a'), req('https://api.openheaders.io/b', 1)];
    const doc = buildHar(entries);
    expect(doc.log.version).toBe('1.2');
    expect(doc.log.creator.name).toBe('Open Headers DevTools');
    expect(doc.log.pages).toEqual([]);
    expect(doc.log.entries).toHaveLength(2);
    expect(doc.log.entries[0]).toBe(entries[0].harEntry);
  });

  it('produces an empty entries array when no entries are given', () => {
    const doc = buildHar([]);
    expect(doc.log.entries).toEqual([]);
  });

  it('omits rows representing webRequest errors (no real HAR)', () => {
    const ok = req('https://api.openheaders.io/a');
    const errored: InspectorRequest = {
      ...req('https://blocked.openheaders.io/b', 1),
      statusCode: 0,
      statusText: 'net::ERR_BLOCKED_BY_CLIENT',
      error: { code: 'net::ERR_BLOCKED_BY_CLIENT', reason: 'blocked' },
    };
    const doc = buildHar([ok, errored]);
    expect(doc.log.entries).toHaveLength(1);
    expect(doc.log.entries[0].request?.url).toBe('https://api.openheaders.io/a');
  });
});

describe('serializeHar', () => {
  it('round-trips through JSON.parse', () => {
    const entries = [req('https://api.openheaders.io/x')];
    const json = serializeHar(entries);
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
  it('falls back to "network" when no entries are available', () => {
    expect(suggestHarFilename([])).toMatch(/^network-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.har$/);
  });

  it('uses the first parseable hostname', () => {
    vi.setSystemTime(new Date('2026-04-16T19:35:00.000Z'));
    const name = suggestHarFilename([req('https://api.openheaders.io/y')]);
    expect(name).toMatch(/^api\.openheaders\.io-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.har$/);
    vi.useRealTimers();
  });

  it('skips unparseable urls to find a host', () => {
    const name = suggestHarFilename([req('not-a-url'), req('https://app.openheaders.io/x', 1)]);
    expect(name).toMatch(/^app\.openheaders\.io-/);
  });
});
