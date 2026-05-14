import { DEFAULT_FILTER_CONFIG, type FilterConfig } from '@openheaders/ui/panel/data/filter-engine';
import {
  buildSearchableText,
  lineMatches,
  runSearch,
  type SearchGroup,
  type SearchProgress,
  scanEntry,
} from '@openheaders/ui/panel/data/search-engine';
import type { InspectorRequest } from '@openheaders/ui/panel/data/types';
import { describe, expect, it } from 'vitest';
import type { InspectorHarEntry } from '@/background/modules/devtools-inspector-port';

function makeRequest(opts: {
  id?: string;
  url?: string;
  method?: string;
  statusCode?: number;
  responseBody?: string;
  requestHeaders?: Array<{ name: string; value: string }>;
  responseHeaders?: Array<{ name: string; value: string }>;
  displayId?: number;
}): InspectorRequest {
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
  };
  return {
    id: opts.id ?? url,
    harEntry: har,
    method: opts.method ?? 'GET',
    url,
    timestamp: 0,
    statusCode: opts.statusCode ?? 200,
    responseBody: opts.responseBody,
    fires: [],
    arrivalIndex: 0,
    displayId: opts.displayId ?? 1,
  };
}

describe('buildSearchableText', () => {
  it('always includes a General section with URL + method/status', () => {
    const parts = buildSearchableText(
      makeRequest({ url: 'https://api.openheaders.io/x', method: 'POST', statusCode: 201 }),
    );
    const general = parts.find((p) => p.section === 'General');
    expect(general?.text).toContain('https://api.openheaders.io/x');
    expect(general?.text).toContain('POST 201');
  });

  it('includes response body as a "Response" section when present', () => {
    const parts = buildSearchableText(makeRequest({ responseBody: '{"foo":"bar"}' }));
    expect(parts.find((p) => p.section === 'Response')?.text).toBe('{"foo":"bar"}');
  });

  it('omits empty response body sections', () => {
    const parts = buildSearchableText(makeRequest({ responseBody: '' }));
    expect(parts.some((p) => p.section === 'Response')).toBe(false);
  });
});

describe('lineMatches', () => {
  const cfg = (over: Partial<FilterConfig> = {}) => ({ ...DEFAULT_FILTER_CONFIG, ...over });

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

describe('scanEntry', () => {
  it('returns null when no section matches', () => {
    const req = makeRequest({ responseBody: 'lorem ipsum' });
    expect(scanEntry(req, 'nonexistent', DEFAULT_FILTER_CONFIG)).toBeNull();
  });

  it('reports matches grouped under the originating section', () => {
    const req = makeRequest({
      responseHeaders: [{ name: 'X-Auth', value: 'secret' }],
      responseBody: '{"auth":"secret"}',
    });
    const group = scanEntry(req, 'secret', DEFAULT_FILTER_CONFIG);
    expect(group).not.toBeNull();
    const sections = new Set(group?.matches.map((m) => m.section));
    expect(sections.has('Response Headers')).toBe(true);
    expect(sections.has('Response')).toBe(true);
  });

  it('caps matches per entry to prevent runaway on huge bodies', () => {
    const hugeBody = Array.from({ length: 10_000 }, (_, i) => `line-${i}-needle`).join('\n');
    const req = makeRequest({ responseBody: hugeBody });
    const group = scanEntry(req, 'needle', DEFAULT_FILTER_CONFIG);
    expect(group?.matches.length).toBeLessThanOrEqual(500);
  });

  it('emits 1-based line and column coordinates for each match', () => {
    // The UI shows `L:C` next to body matches — the engine is the
    // only place both are computed, so the contract lives here.
    //   line 1 col 1 : "alpha"
    //   line 2 col 7 : "needle" (after "before ")
    //   line 3 col 4 : "xxxneedle" starts at col 4
    const body = 'alpha\nbefore needle\nxxxneedle end';
    const req = makeRequest({ responseBody: body });
    const group = scanEntry(req, 'needle', DEFAULT_FILTER_CONFIG);
    const responseMatches = group?.matches.filter((m) => m.section === 'Response') ?? [];
    expect(responseMatches).toHaveLength(2);
    expect(responseMatches[0]).toMatchObject({ lineNumber: 2, column: 8 });
    expect(responseMatches[1]).toMatchObject({ lineNumber: 3, column: 4 });
  });

  it('emits a section-local sectionIndex so the viewer can scroll to the Nth occurrence', () => {
    // Regression guard for the "clicking match #5 scrolls to match #1"
    // bug: the viewer looks up the N-th occurrence in the body via
    // match.sectionIndex. Must be 0-based and contiguous per section,
    // reset across sections.
    const body = Array.from({ length: 5 }, () => 'needle').join(' X ');
    const req = makeRequest({
      responseHeaders: [
        { name: 'X-A', value: 'needle' },
        { name: 'X-B', value: 'needle' },
      ],
      responseBody: body,
    });
    const group = scanEntry(req, 'needle', DEFAULT_FILTER_CONFIG);
    expect(group).not.toBeNull();

    const responseHeaderMatches = group?.matches.filter((m) => m.section === 'Response Headers') ?? [];
    expect(responseHeaderMatches.map((m) => m.sectionIndex)).toEqual([0, 1]);

    const responseBodyMatches = group?.matches.filter((m) => m.section === 'Response') ?? [];
    expect(responseBodyMatches.map((m) => m.sectionIndex)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('runSearch — perf / correctness invariants', () => {
  it('completes quickly on large no-match bodies (native regex scan)', async () => {
    // Synthesize 20 entries each carrying 500KB of text. If the
    // scanner is doing .split('\n') + .includes per line the scan
    // will take 1s+. With regex.exec the whole pass must finish in
    // well under a second on any reasonable hardware.
    const LARGE_BODY = 'x'.repeat(500_000);
    const entries: InspectorRequest[] = Array.from({ length: 20 }, (_, i) =>
      makeRequest({ id: `e-${i}`, responseBody: LARGE_BODY }),
    );
    const ctrl = new AbortController();
    const started = performance.now();
    await runSearch(entries, 'missing-token', DEFAULT_FILTER_CONFIG, ctrl.signal, {
      onGroup: () => {},
      onProgress: () => {},
      onDone: () => {},
    });
    expect(performance.now() - started).toBeLessThan(500);
  });

  it('completes quickly on a single-line multi-MB body with many matches', async () => {
    // Regression guard for the freeze at 75/423: a minified bundle
    // (one line, no newlines) with many matches used to trigger
    // per-match slices of the ENTIRE body in resolveLineInfo —
    // 500 × (MB-scale allocations) stalled the main thread for
    // seconds. With windowed slicing the whole scan must finish well
    // under 1s.
    const LINE = `${'x'.repeat(1000)}wat${'y'.repeat(1000)}`.repeat(2000); // ~4 MB, 2000 "wat" matches
    const ctrl = new AbortController();
    let groupMatches = 0;
    const started = performance.now();
    await runSearch([makeRequest({ id: 'minified', responseBody: LINE })], 'wat', DEFAULT_FILTER_CONFIG, ctrl.signal, {
      onGroup: (g) => {
        groupMatches = g.matches.length;
      },
      onProgress: () => {},
      onDone: () => {},
    });
    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(1000);
    // Capped at MAX_MATCHES_PER_ENTRY (500) — not 2000.
    expect(groupMatches).toBe(500);
  });

  it('windows lineText around the match for long lines', async () => {
    // On a one-line body the match should appear in the lineText,
    // surrounded by context on both sides — never the whole megabyte
    // line and never a slice that excludes the match.
    const prefix = 'a'.repeat(5000);
    const suffix = 'b'.repeat(5000);
    const body = `${prefix}NEEDLE${suffix}`;
    let captured: SearchGroup | null = null;
    const ctrl = new AbortController();
    await runSearch(
      [makeRequest({ id: 'long-line', responseBody: body })],
      'NEEDLE',
      DEFAULT_FILTER_CONFIG,
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
    // If the user hits Cancel during a huge scan, the run must stop
    // promptly — not plough through every remaining entry. We queue
    // 200 entries, abort after the first `onProgress`, and assert we
    // didn't reach the last one.
    const body = 'x'.repeat(200_000);
    const entries: InspectorRequest[] = Array.from({ length: 200 }, (_, i) =>
      makeRequest({ id: `e-${i}`, displayId: i + 1, responseBody: body }),
    );
    const ctrl = new AbortController();
    let lastReportedDone = 0;
    await runSearch(entries, 'missing', DEFAULT_FILTER_CONFIG, ctrl.signal, {
      onGroup: () => {},
      onProgress: (p) => {
        lastReportedDone = p.done;
        if (p.done >= 3) ctrl.abort();
      },
      onDone: () => {},
    });
    expect(lastReportedDone).toBeLessThan(entries.length);
  });

  it('reports progress monotonically and never stalls', async () => {
    // Regression guard for the "stuck at N/M" freeze: progress must
    // advance monotonically with `currentDisplayId` pointing at the
    // entry being scanned, and must reach `done === total` by end.
    const entries: InspectorRequest[] = Array.from({ length: 50 }, (_, i) =>
      makeRequest({ id: `e-${i}`, displayId: i + 1, responseBody: 'nothing to see here' }),
    );
    const progress: Array<{ done: number; currentDisplayId: number | null | undefined }> = [];
    const ctrl = new AbortController();
    await runSearch(entries, 'missing', DEFAULT_FILTER_CONFIG, ctrl.signal, {
      onGroup: () => {},
      onProgress: (p) => {
        progress.push({ done: p.done, currentDisplayId: p.currentDisplayId });
      },
      onDone: () => {},
    });
    expect(progress.length).toBeGreaterThan(0);
    // Monotonically non-decreasing done counter.
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i].done).toBeGreaterThanOrEqual(progress[i - 1].done);
    }
    // First beat is pre-scan of entry #1.
    expect(progress[0]).toEqual({ done: 0, currentDisplayId: 1 });
    // Last beat is post-scan of final entry: counter at 50, no current.
    const last = progress[progress.length - 1];
    expect(last.done).toBe(50);
    expect(last.currentDisplayId).toBe(null);
  });

  it('yields mid-entry so one huge body cannot monopolise the main thread', async () => {
    // Regression guard for the "stuck at #2 (Response)" freeze: a
    // multi-MB body with dense matches used to lock the main thread
    // for seconds because findPositions + resolveLineInfo were
    // synchronous. The time-sliced scanner must emit progress beats
    // DURING the scan (not just before and after), proving the main
    // thread returned to the event loop mid-entry.
    const body = `${'x'.repeat(10_000)}crypto${'y'.repeat(10_000)}`.repeat(500); // ~10 MB, 500 "crypto"
    const entries: InspectorRequest[] = [makeRequest({ id: 'big', displayId: 1, responseBody: body })];
    const ticksWithSectionProgress: number[] = [];
    const ctrl = new AbortController();
    await runSearch(entries, 'crypto', DEFAULT_FILTER_CONFIG, ctrl.signal, {
      onGroup: () => {},
      onProgress: (p) => {
        if (p.sectionTotal != null && p.sectionScanned != null && p.sectionTotal > 0) {
          ticksWithSectionProgress.push(p.sectionScanned);
        }
      },
      onDone: () => {},
    });
    // Expect more than just the initial and final section ticks — the
    // scanner must have yielded at least once mid-scan, producing at
    // least one tick with `0 < scanned < total`.
    const midscan = ticksWithSectionProgress.filter((s, i, arr) => i > 0 && s > 0 && s < arr[arr.length - 1]);
    expect(midscan.length).toBeGreaterThan(0);
  });

  it('still returns correct matches when the body has many hits', async () => {
    const needle = 'needle';
    const body = Array.from({ length: 100 }, (_, i) => `prefix-${i}-${needle}-suffix`).join('\n');
    const ctrl = new AbortController();
    let total = 0;
    await runSearch([makeRequest({ id: 'x', responseBody: body })], needle, DEFAULT_FILTER_CONFIG, ctrl.signal, {
      onGroup: (g) => {
        total += g.matches.length;
      },
      onProgress: () => {},
      onDone: () => {},
    });
    expect(total).toBe(100);
  });
});

describe('runSearch', () => {
  it('streams results via onGroup and calls onDone with totals', async () => {
    const entries: InspectorRequest[] = [
      makeRequest({ id: 'a', responseBody: 'hello world' }),
      makeRequest({ id: 'b', responseBody: 'nothing here' }),
      makeRequest({ id: 'c', responseBody: 'hello again' }),
    ];
    const groups: SearchGroup[] = [];
    const doneRef: { value: SearchProgress | null } = { value: null };
    const ctrl = new AbortController();
    await runSearch(entries, 'hello', DEFAULT_FILTER_CONFIG, ctrl.signal, {
      onGroup: (g) => groups.push(g),
      onProgress: () => {},
      onDone: (p) => {
        doneRef.value = p;
      },
    });
    expect(groups.map((g) => g.entryId).sort()).toEqual(['a', 'c']);
    expect(doneRef.value).not.toBeNull();
    expect(doneRef.value?.done).toBe(3);
    expect(doneRef.value?.total).toBe(3);
  });

  it('stops yielding results after abort', async () => {
    const entries: InspectorRequest[] = Array.from({ length: 100 }, (_, i) =>
      makeRequest({ id: `e-${i}`, responseBody: 'target' }),
    );
    const groups: SearchGroup[] = [];
    let done = false;
    const ctrl = new AbortController();
    ctrl.abort();
    await runSearch(entries, 'target', DEFAULT_FILTER_CONFIG, ctrl.signal, {
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
