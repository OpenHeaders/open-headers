import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarBody, InspectorHarEntry } from '@openheaders/core/types';
import type { InspectorRow } from '@openheaders/ui/panel/data/inspector-facet';
import { buildSearchableText, projectNetworkDoc } from '@openheaders/ui/panel/data/search/network-search-docs';
import type { SearchDoc } from '@openheaders/ui/panel/data/search/search-doc';
import {
  lineMatches,
  runSearch,
  type SearchGroup,
  type SearchProgress,
  scanDoc,
} from '@openheaders/ui/panel/data/search/search-engine';
import { DEFAULT_TEXT_MATCH_CONFIG, type TextMatchConfig } from '@openheaders/ui/panel/data/text-match';
import { describe, expect, it } from 'vitest';

function makeRow(opts: {
  id?: string;
  url?: string;
  method?: string;
  statusCode?: number;
  responseBody?: string;
  requestHeaders?: Array<{ name: string; value: string }>;
  responseHeaders?: Array<{ name: string; value: string }>;
  displayId?: number;
}): InspectorRow {
  const url = opts.url ?? 'https://api.openheaders.io/v2/config';
  const har: InspectorHarEntry = {
    startedDateTime: '2026-04-16T00:00:00.000Z',
    request: {
      method: opts.method ?? 'GET',
      url,
      headers: opts.requestHeaders ?? [],
      queryString: [],
    },
    response: {
      status: opts.statusCode ?? 200,
      statusText: 'OK',
      headers: opts.responseHeaders ?? [],
      content: { size: 0, mimeType: 'application/json' },
    },
  } as InspectorHarEntry;
  const harBodyByHop: (InspectorHarBody | null)[] = [];
  if (opts.responseBody !== undefined) {
    harBodyByHop[0] = {
      method: opts.method ?? 'GET',
      url,
      startedDateTime: '2026-04-16T00:00:00.000Z',
      content: opts.responseBody,
      encoding: '',
    };
  }
  const lc: RequestLifecycle = {
    tabId: 1,
    requestId: opts.id ?? url,
    url,
    method: opts.method ?? 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 0,
    hopStartedAtMs: 0,
    statusCode: opts.statusCode ?? 200,
    har: [har],
    harBodyByHop,
  };
  return { lifecycle: lc, displayId: opts.displayId ?? 1, consolidatedRetryOf: [] };
}

function makeDoc(opts: Parameters<typeof makeRow>[0]): SearchDoc {
  return projectNetworkDoc(makeRow(opts));
}

function docsOf(rows: readonly InspectorRow[]): SearchDoc[] {
  return rows.map(projectNetworkDoc);
}

describe('buildSearchableText', () => {
  it('always includes a General section with URL + method/status', () => {
    const parts = buildSearchableText(
      makeRow({ url: 'https://api.openheaders.io/x', method: 'POST', statusCode: 201 }),
    );
    const general = parts.find((p) => p.name === 'General');
    expect(general?.text).toContain('https://api.openheaders.io/x');
    expect(general?.text).toContain('POST 201');
  });

  it('includes response body as a "Response" section when present', () => {
    const parts = buildSearchableText(makeRow({ responseBody: '{"foo":"bar"}' }));
    expect(parts.find((p) => p.name === 'Response')?.text).toBe('{"foo":"bar"}');
  });

  it('omits empty response body sections', () => {
    const parts = buildSearchableText(makeRow({ responseBody: '' }));
    expect(parts.some((p) => p.name === 'Response')).toBe(false);
  });
});

describe('projectNetworkDoc', () => {
  it('projects identity, target, and label fields from the row', () => {
    const doc = projectNetworkDoc(makeRow({ id: 'req-1', url: 'https://openheaders.io/assets/app.js', displayId: 7 }));
    expect(doc.docId).toBe('net:req-1');
    expect(doc.source).toBe('network');
    expect(doc.target).toEqual({ kind: 'request', requestId: 'req-1' });
    expect(doc.displayId).toBe(7);
    expect(doc.filename).toBe('app.js');
    expect(doc.origin).toBe('openheaders.io/assets/app.js');
  });
});

describe('lineMatches', () => {
  const cfg = (over: Partial<TextMatchConfig> = {}) => ({ ...DEFAULT_TEXT_MATCH_CONFIG, ...over });

  it('matches substring case-insensitively by default', () => {
    expect(lineMatches('Accept: application/json', 'JSON', cfg())).toBe(true);
  });

  it('respects matchCase', () => {
    expect(lineMatches('Accept: application/json', 'JSON', cfg({ matchCase: true }))).toBe(false);
    expect(lineMatches('Accept: application/json', 'json', cfg({ matchCase: true }))).toBe(true);
  });

  it('respects wholeWord', () => {
    expect(lineMatches('foobar', 'foo', cfg({ wholeWord: true }))).toBe(false);
    expect(lineMatches('foo bar', 'foo', cfg({ wholeWord: true }))).toBe(true);
  });

  it('uses regex under regexMode', () => {
    expect(lineMatches('abc123', 'abc\\d+', cfg({ regexMode: true }))).toBe(true);
  });

  it('treats invalid regex as non-matching under regexMode', () => {
    expect(lineMatches('abc', '(unbalanced', cfg({ regexMode: true }))).toBe(false);
  });
});

describe('scanDoc', () => {
  it('returns null when no section matches', () => {
    const doc = makeDoc({ responseBody: 'lorem ipsum' });
    expect(scanDoc(doc, 'nonexistent', DEFAULT_TEXT_MATCH_CONFIG)).toBeNull();
  });

  it('reports matches grouped under the originating section', () => {
    const doc = makeDoc({
      responseHeaders: [{ name: 'X-Auth', value: 'secret' }],
      responseBody: '{"auth":"secret"}',
    });
    const group = scanDoc(doc, 'secret', DEFAULT_TEXT_MATCH_CONFIG);
    expect(group).not.toBeNull();
    const sections = new Set(group?.matches.map((m) => m.section));
    expect(sections.has('Response Headers')).toBe(true);
    expect(sections.has('Response')).toBe(true);
  });

  it('caps matches per doc to prevent runaway on huge bodies', () => {
    const hugeBody = Array.from({ length: 10_000 }, (_, i) => `line-${i}-needle`).join('\n');
    const doc = makeDoc({ responseBody: hugeBody });
    const group = scanDoc(doc, 'needle', DEFAULT_TEXT_MATCH_CONFIG);
    expect(group?.matches.length).toBeLessThanOrEqual(500);
  });

  it('emits 1-based line and column coordinates for each match', () => {
    const body = 'alpha\nbefore needle\nxxxneedle end';
    const doc = makeDoc({ responseBody: body });
    const group = scanDoc(doc, 'needle', DEFAULT_TEXT_MATCH_CONFIG);
    const responseMatches = group?.matches.filter((m) => m.section === 'Response') ?? [];
    expect(responseMatches).toHaveLength(2);
    expect(responseMatches[0]).toMatchObject({ lineNumber: 2, column: 8 });
    expect(responseMatches[1]).toMatchObject({ lineNumber: 3, column: 4 });
  });

  it('emits a section-local sectionIndex so the viewer can scroll to the Nth occurrence', () => {
    const body = Array.from({ length: 5 }, () => 'needle').join(' X ');
    const doc = makeDoc({
      responseHeaders: [
        { name: 'X-A', value: 'needle' },
        { name: 'X-B', value: 'needle' },
      ],
      responseBody: body,
    });
    const group = scanDoc(doc, 'needle', DEFAULT_TEXT_MATCH_CONFIG);
    expect(group).not.toBeNull();

    const responseHeaderMatches = group?.matches.filter((m) => m.section === 'Response Headers') ?? [];
    expect(responseHeaderMatches.map((m) => m.sectionIndex)).toEqual([0, 1]);

    const responseBodyMatches = group?.matches.filter((m) => m.section === 'Response') ?? [];
    expect(responseBodyMatches.map((m) => m.sectionIndex)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('runSearch — perf / correctness invariants', () => {
  it('completes quickly on large no-match bodies (native regex scan)', async () => {
    const LARGE_BODY = 'x'.repeat(500_000);
    const docs = docsOf(Array.from({ length: 20 }, (_, i) => makeRow({ id: `e-${i}`, responseBody: LARGE_BODY })));
    const ctrl = new AbortController();
    const started = performance.now();
    await runSearch(docs, 'missing-token', DEFAULT_TEXT_MATCH_CONFIG, ctrl.signal, {
      onGroup: () => {},
      onProgress: () => {},
      onDone: () => {},
    });
    expect(performance.now() - started).toBeLessThan(500);
  });

  it('completes quickly on a single-line multi-MB body with many matches', async () => {
    const LINE = `${'x'.repeat(1000)}wat${'y'.repeat(1000)}`.repeat(2000);
    const ctrl = new AbortController();
    let groupMatches = 0;
    const started = performance.now();
    await runSearch(
      docsOf([makeRow({ id: 'minified', responseBody: LINE })]),
      'wat',
      DEFAULT_TEXT_MATCH_CONFIG,
      ctrl.signal,
      {
        onGroup: (g) => {
          groupMatches = g.matches.length;
        },
        onProgress: () => {},
        onDone: () => {},
      },
    );
    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(1000);
    expect(groupMatches).toBe(500);
  });

  it('windows lineText around the match for long lines', async () => {
    const prefix = 'a'.repeat(5000);
    const suffix = 'b'.repeat(5000);
    const body = `${prefix}NEEDLE${suffix}`;
    let captured: SearchGroup | null = null;
    const ctrl = new AbortController();
    await runSearch(
      docsOf([makeRow({ id: 'long-line', responseBody: body })]),
      'NEEDLE',
      DEFAULT_TEXT_MATCH_CONFIG,
      ctrl.signal,
      {
        onGroup: (g) => {
          captured = g;
        },
        onProgress: () => {},
        onDone: () => {},
      },
    );
    expect(captured).not.toBeNull();
    const match = (captured as unknown as SearchGroup).matches[0];
    expect(match.lineText.length).toBeLessThanOrEqual(400);
    expect(match.lineText).toContain('NEEDLE');
  });

  it('aborts mid-scan when the signal is cancelled', async () => {
    const body = 'x'.repeat(200_000);
    const docs = docsOf(
      Array.from({ length: 200 }, (_, i) => makeRow({ id: `e-${i}`, displayId: i + 1, responseBody: body })),
    );
    const ctrl = new AbortController();
    let lastReportedDone = 0;
    await runSearch(docs, 'missing', DEFAULT_TEXT_MATCH_CONFIG, ctrl.signal, {
      onGroup: () => {},
      onProgress: (p) => {
        lastReportedDone = p.done;
        if (p.done >= 3) ctrl.abort();
      },
      onDone: () => {},
    });
    expect(lastReportedDone).toBeLessThan(docs.length);
  });

  it('reports progress monotonically and never stalls', async () => {
    const docs = docsOf(
      Array.from({ length: 50 }, (_, i) =>
        makeRow({ id: `e-${i}`, displayId: i + 1, responseBody: 'nothing to see here' }),
      ),
    );
    const progress: Array<{ done: number; current: string | null | undefined }> = [];
    const ctrl = new AbortController();
    await runSearch(docs, 'missing', DEFAULT_TEXT_MATCH_CONFIG, ctrl.signal, {
      onGroup: () => {},
      onProgress: (p) => {
        progress.push({ done: p.done, current: p.current });
      },
      onDone: () => {},
    });
    expect(progress.length).toBeGreaterThan(0);
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i].done).toBeGreaterThanOrEqual(progress[i - 1].done);
    }
    expect(progress[0]).toEqual({ done: 0, current: '#1' });
    const last = progress[progress.length - 1];
    expect(last.done).toBe(50);
    expect(last.current).toBe(null);
  });

  it('yields mid-doc so one huge body cannot monopolise the main thread', async () => {
    const body = `${'x'.repeat(10_000)}crypto${'y'.repeat(10_000)}`.repeat(500);
    const docs = docsOf([makeRow({ id: 'big', displayId: 1, responseBody: body })]);
    const ticksWithSectionProgress: number[] = [];
    const ctrl = new AbortController();
    await runSearch(docs, 'crypto', DEFAULT_TEXT_MATCH_CONFIG, ctrl.signal, {
      onGroup: () => {},
      onProgress: (p) => {
        if (p.sectionTotal != null && p.sectionScanned != null && p.sectionTotal > 0) {
          ticksWithSectionProgress.push(p.sectionScanned);
        }
      },
      onDone: () => {},
    });
    const midscan = ticksWithSectionProgress.filter((s, i, arr) => i > 0 && s > 0 && s < arr[arr.length - 1]);
    expect(midscan.length).toBeGreaterThan(0);
  });

  it('still returns correct matches when the body has many hits', async () => {
    const needle = 'needle';
    const body = Array.from({ length: 100 }, (_, i) => `prefix-${i}-${needle}-suffix`).join('\n');
    const ctrl = new AbortController();
    let total = 0;
    await runSearch(
      docsOf([makeRow({ id: 'x', responseBody: body })]),
      needle,
      DEFAULT_TEXT_MATCH_CONFIG,
      ctrl.signal,
      {
        onGroup: (g) => {
          total += g.matches.length;
        },
        onProgress: () => {},
        onDone: () => {},
      },
    );
    expect(total).toBe(100);
  });

  it('stops at the global match cap and reports truncated', async () => {
    // 25 docs × 500-per-doc cap = 12,500 potential matches > 10,000 cap.
    const body = Array.from({ length: 600 }, (_, i) => `row-${i} needle`).join('\n');
    const docs = docsOf(Array.from({ length: 25 }, (_, i) => makeRow({ id: `e-${i}`, responseBody: body })));
    const ctrl = new AbortController();
    let streamed = 0;
    let final: SearchProgress | null = null;
    await runSearch(docs, 'needle', DEFAULT_TEXT_MATCH_CONFIG, ctrl.signal, {
      onGroup: (g) => {
        streamed += g.matches.length;
      },
      onProgress: () => {},
      onDone: (p) => {
        final = p;
      },
    });
    expect(streamed).toBeLessThanOrEqual(10_000);
    expect((final as unknown as SearchProgress).truncated).toBe(true);
    expect((final as unknown as SearchProgress).done).toBeLessThan(docs.length);
  });
});

describe('runSearch', () => {
  it('streams results via onGroup and calls onDone with totals', async () => {
    const docs = docsOf([
      makeRow({ id: 'a', responseBody: 'hello world' }),
      makeRow({ id: 'b', responseBody: 'nothing here' }),
      makeRow({ id: 'c', responseBody: 'hello again' }),
    ]);
    const groups: SearchGroup[] = [];
    const doneRef: { value: SearchProgress | null } = { value: null };
    const ctrl = new AbortController();
    await runSearch(docs, 'hello', DEFAULT_TEXT_MATCH_CONFIG, ctrl.signal, {
      onGroup: (g) => groups.push(g),
      onProgress: () => {},
      onDone: (p) => {
        doneRef.value = p;
      },
    });
    expect(groups.map((g) => g.docId).sort()).toEqual(['net:a', 'net:c']);
    expect(doneRef.value).not.toBeNull();
    expect(doneRef.value?.done).toBe(3);
    expect(doneRef.value?.total).toBe(3);
  });

  it('stops yielding results after abort', async () => {
    const docs = docsOf(Array.from({ length: 100 }, (_, i) => makeRow({ id: `e-${i}`, responseBody: 'target' })));
    const groups: SearchGroup[] = [];
    let done = false;
    const ctrl = new AbortController();
    ctrl.abort();
    await runSearch(docs, 'target', DEFAULT_TEXT_MATCH_CONFIG, ctrl.signal, {
      onGroup: (g) => groups.push(g),
      onProgress: () => {},
      onDone: () => {
        done = true;
      },
    });
    expect(groups.length).toBe(0);
    expect(done).toBe(false);
  });
});
