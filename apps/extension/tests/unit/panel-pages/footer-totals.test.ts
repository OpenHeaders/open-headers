/**
 * Footer byte/count totals — `computeFooterTotals` / `computeFooterSubset`.
 *
 * The status bar reads these for "N requests · X transferred · Y resources".
 * They are built from the shared `display*Bytes` helpers, so an in-flight row
 * contributes its running bytes (live by construction), a finished row its
 * authoritative HAR figure, and a cache hit / pre-first-byte row nothing.
 * Under a filter the bar shows `subset / total`; the subset is the SAME helper
 * over the filtered set, so it grows live as a passing row streams — and a
 * filter that hides nothing reports no subset at all (browser count parity).
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { matchesPanelFilters } from '@openheaders/ui/panel/components/traffic/row-filter';
import { DEFAULT_FILTER_CONFIG, type FilterConfig, parseFilter } from '@openheaders/ui/panel/data/filter-engine';
import type { InspectorRowWithFires } from '@openheaders/ui/panel/data/inspector-row-projection';
import { computeFooterSubset, computeFooterTotals } from '@openheaders/ui/panel/data/panel-data-projection';
import { describe, expect, it } from 'vitest';

function har(overrides: { transferSize?: number; bodySize?: number; contentSize?: number } = {}): InspectorHarEntry {
  const { transferSize, bodySize, contentSize } = overrides;
  return {
    startedDateTime: new Date(0).toISOString(),
    time: 0,
    request: { method: 'GET', url: 'https://openheaders.io/x', headers: [], queryString: [] },
    response: {
      status: 200,
      statusText: 'OK',
      headers: [],
      content: { size: contentSize ?? 0, mimeType: 'text/plain' },
      bodySize: bodySize ?? -1,
      ...(transferSize != null ? { _transferSize: transferSize } : {}),
    },
    timings: { blocked: 0, dns: 0, connect: 0, send: 0, wait: 0, receive: 0 },
  } as InspectorHarEntry;
}

function lifecycle(overrides: Partial<RequestLifecycle> = {}): RequestLifecycle {
  return {
    tabId: 1,
    requestId: 'req',
    url: 'https://openheaders.io/x',
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'pending',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 1_000,
    hopStartedAtMs: 1_000,
    har: [],
    harBodyByHop: [],
    ...overrides,
  };
}

function row(id: string, lc: RequestLifecycle): InspectorRowWithFires {
  return { lifecycle: { ...lc, requestId: id }, displayId: 1, consolidatedRetryOf: [], fires: [] };
}

/** A finished row whose authoritative HAR carries the wire/decoded bytes. */
function finished(
  id: string,
  transferSize: number,
  contentSize: number,
  extra: Partial<RequestLifecycle> = {},
): InspectorRowWithFires {
  return row(
    id,
    lifecycle({ phase: 'completed', completedAtMs: 1_500, har: [har({ transferSize, contentSize })], ...extra }),
  );
}

/** An in-flight row carrying running progress counters (CDP per-chunk). */
function streaming(
  id: string,
  transferredSoFar: number,
  receivedSoFar: number,
  extra: Partial<RequestLifecycle> = {},
): InspectorRowWithFires {
  return row(
    id,
    lifecycle({
      phase: 'headers-received',
      lastActivityAtMs: 1_400,
      bytesTransferredSoFar: transferredSoFar,
      bytesReceivedSoFar: receivedSoFar,
      ...extra,
    }),
  );
}

describe('computeFooterTotals', () => {
  it('counts rows and sums finished HAR bytes', () => {
    const totals = computeFooterTotals([finished('a', 1024, 2048), finished('b', 512, 256)]);
    expect(totals.requestCount).toBe(2);
    expect(totals.totalBytesTransferred).toBe(1024 + 512);
    expect(totals.totalResourceSize).toBe(2048 + 256);
  });

  it('includes a running in-flight row by its live progress counters', () => {
    const totals = computeFooterTotals([streaming('a', 300, 700)]);
    expect(totals.totalBytesTransferred).toBe(300);
    expect(totals.totalResourceSize).toBe(700);
  });

  it('counts a cache hit toward resources but not transferred (no wire bytes)', () => {
    // Finished, decoded body present, but nothing transferred over the wire.
    const cached = finished('a', 0, 4096);
    const totals = computeFooterTotals([cached]);
    expect(totals.totalBytesTransferred).toBe(0);
    expect(totals.totalResourceSize).toBe(4096);
  });

  it('contributes nothing for a pending row before the first byte', () => {
    const totals = computeFooterTotals([row('a', lifecycle())]);
    expect(totals.requestCount).toBe(1);
    expect(totals.totalBytesTransferred).toBe(0);
    expect(totals.totalResourceSize).toBe(0);
  });

  it('mixes finished, streaming, cached and pending in one pass', () => {
    const totals = computeFooterTotals([
      finished('a', 1000, 1000),
      streaming('b', 200, 400),
      finished('c', 0, 800), // cached
      row('d', lifecycle()), // pending
    ]);
    expect(totals.requestCount).toBe(4);
    expect(totals.totalBytesTransferred).toBe(1200);
    expect(totals.totalResourceSize).toBe(2200);
  });
});

describe('computeFooterSubset', () => {
  const filterConfig: FilterConfig = DEFAULT_FILTER_CONFIG;

  function filtered(full: readonly InspectorRowWithFires[], typeFacets: ReadonlySet<string>, urlFilter = '') {
    const filterTokens = parseFilter(urlFilter, filterConfig);
    return full.filter((r) => matchesPanelFilters(r.lifecycle, { filter: typeFacets, filterTokens, filterConfig }));
  }

  it('returns null when the filter hides nothing (count parity with the browser)', () => {
    const full = [finished('a', 100, 100), finished('b', 200, 200)];
    // An empty facet set matches every row → no rows hidden → no subset.
    const subset = computeFooterSubset(full, filtered(full, new Set()));
    expect(subset).toBeNull();
  });

  it('reports a strictly-smaller subset and it differs from the full totals', () => {
    const full = [
      finished('xhr', 1000, 2000, { resourceType: 'xmlhttprequest' }),
      finished('img', 5000, 9000, { resourceType: 'image' }),
    ];
    const fullTotals = computeFooterTotals(full);
    const subset = computeFooterSubset(full, filtered(full, new Set(['xhr'])));
    expect(subset).not.toBeNull();
    expect(subset?.requestCount).toBe(1);
    expect(subset?.totalBytesTransferred).toBe(1000);
    expect(subset?.totalResourceSize).toBe(2000);
    // The subset is genuinely a proper subset of the full readings.
    expect(subset?.totalBytesTransferred).toBeLessThan(fullTotals.totalBytesTransferred);
    expect(subset?.requestCount).toBeLessThan(fullTotals.requestCount);
  });

  it('grows live as a streaming row that passes the filter receives more bytes', () => {
    const otherFinished = finished('img', 5000, 9000, { resourceType: 'image' });
    const lcId = 'xhr';
    const at = (transferred: number, received: number): readonly InspectorRowWithFires[] => [
      streaming(lcId, transferred, received, { resourceType: 'xmlhttprequest' }),
      otherFinished,
    ];

    const early = at(100, 250);
    const later = at(900, 1800);
    const subsetEarly = computeFooterSubset(early, filtered(early, new Set(['xhr'])));
    const subsetLater = computeFooterSubset(later, filtered(later, new Set(['xhr'])));

    expect(subsetEarly?.totalBytesTransferred).toBe(100);
    expect(subsetLater?.totalBytesTransferred).toBe(900);
    expect(subsetLater?.totalResourceSize).toBeGreaterThan(subsetEarly?.totalResourceSize ?? 0);
  });
});
