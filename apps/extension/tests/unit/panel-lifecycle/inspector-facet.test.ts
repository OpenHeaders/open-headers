/**
 * Inspector facet (P3) — pure projection from lifecycle snapshot to
 * rows. Asserts sort key stability, discovery-order displayId (Request #
 * follows input/log order, not the time-sorted row order), and the
 * retry-consolidation policy (opt-in, same-(url, method), within window).
 */

import type { RedirectHop, RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { buildInspectorRows, type InspectorRow, inspectorSortKey } from '@openheaders/ui/panel/data/lifecycle';
import { describe, expect, it } from 'vitest';

function makeLifecycle(over: Partial<RequestLifecycle> = {}): RequestLifecycle {
  return {
    tabId: 1,
    requestId: 'r1',
    url: 'https://openheaders.io/a',
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'pending',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 100,
    hopStartedAtMs: 100,
    har: [],
    harBodyByHop: [],
    ...over,
  };
}

function hopHar(url: string, status: number, startedDateTime: string): InspectorHarEntry {
  return {
    startedDateTime,
    time: 10,
    request: { method: 'GET', url, headers: [], queryString: [] },
    response: { status, statusText: '', headers: [], content: { size: 0, mimeType: '' } },
  } as InspectorHarEntry;
}

function redirectLifecycle(over: Partial<RequestLifecycle> = {}): RequestLifecycle {
  const redirectHops: RedirectHop[] = [
    {
      sourceUrl: 'https://openheaders.io/',
      redirectUrl: 'https://openheaders.io/ro',
      statusCode: 302,
      timestampMs: 50,
    },
  ];
  return makeLifecycle({
    requestId: 'redir',
    url: 'https://openheaders.io/ro',
    resourceType: 'document',
    phase: 'completed',
    redirectHopCount: 1,
    redirectHops,
    startedAtMs: 100,
    hopStartedAtMs: 150,
    completedAtMs: 200,
    statusCode: 200,
    har: [
      hopHar('https://openheaders.io/', 302, '2026-04-16T00:00:00.100Z'),
      hopHar('https://openheaders.io/ro', 200, '2026-04-16T00:00:00.150Z'),
    ],
    ...over,
  });
}

describe('inspectorSortKey', () => {
  it('returns startedAtMs', () => {
    expect(inspectorSortKey(makeLifecycle({ startedAtMs: 1234 }))).toBe(1234);
  });
});

describe('buildInspectorRows — ordering + displayId', () => {
  it('sorts rows by startedAtMs ascending, breaks ties by discovery order', () => {
    const rows = buildInspectorRows([
      makeLifecycle({ requestId: 'c', startedAtMs: 200 }),
      makeLifecycle({ requestId: 'a', startedAtMs: 100 }),
      makeLifecycle({ requestId: 'b', startedAtMs: 100 }),
    ]);
    expect(rows.map((r: InspectorRow) => r.lifecycle.requestId)).toEqual(['a', 'b', 'c']);
  });

  it('breaks exact start-time ties by discovery order, not requestId string', () => {
    // A page fires a burst of requests in one tick — identical startedAtMs.
    // Discovery order is #4 then #10 (CDP ids `r.4`, `r.10`); a requestId
    // string compare would invert them (`r.10` < `r.4`). The host breaks the
    // tie by insertion order, so #4 must stay before #10.
    const rows = buildInspectorRows([
      makeLifecycle({ requestId: 'r.4', startedAtMs: 100 }),
      makeLifecycle({ requestId: 'r.10', startedAtMs: 100 }),
    ]);
    expect(rows.map((r: InspectorRow) => r.lifecycle.requestId)).toEqual(['r.4', 'r.10']);
  });

  it('numbers displayId by discovery (input) order, not the sorted row order', () => {
    // Input/log order is [c, a, b] → Request # c=1, a=2, b=3. The rows
    // come back time-sorted [a, b, c], so the numbers scramble — exactly
    // what a Request # column does under a start-time sort.
    const rows = buildInspectorRows([
      makeLifecycle({ requestId: 'c', startedAtMs: 200 }),
      makeLifecycle({ requestId: 'a', startedAtMs: 100 }),
      makeLifecycle({ requestId: 'b', startedAtMs: 100 }),
    ]);
    expect(rows.map((r: InspectorRow) => `${r.lifecycle.requestId}#${r.displayId}`)).toEqual(['a#2', 'b#3', 'c#1']);
  });

  it('returns empty rows for empty input', () => {
    expect(buildInspectorRows([])).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const input: RequestLifecycle[] = [
      makeLifecycle({ requestId: 'b', startedAtMs: 2 }),
      makeLifecycle({ requestId: 'a', startedAtMs: 1 }),
    ];
    const before = input.map((l) => l.requestId);
    buildInspectorRows(input);
    expect(input.map((l) => l.requestId)).toEqual(before);
  });
});

describe('buildInspectorRows — redirect un-folding', () => {
  it('expands a redirect lifecycle into a synthetic hop row then the real final row', () => {
    const rows = buildInspectorRows([redirectLifecycle()]);
    expect(rows).toHaveLength(2);
    expect(rows[0].isRedirectHop).toBe(true);
    expect(rows[0].lifecycle.requestId).toBe('oh-redir:redir#0');
    expect(rows[0].lifecycle.statusCode).toBe(302);
    expect(rows[1].isRedirectHop).toBeFalsy();
    expect(rows[1].lifecycle.requestId).toBe('redir');
    expect(rows[1].lifecycle.statusCode).toBe(200);
  });

  it('numbers the redirect hop then the final hop consecutively (302=#1, 200=#2)', () => {
    const rows = buildInspectorRows([redirectLifecycle()]);
    expect(rows.map((r) => r.displayId)).toEqual([1, 2]);
  });

  it('places the hop row immediately before its final row and keeps discovery numbering across siblings', () => {
    // Discovery order: [redirect (hop #1, final #2), later (#3)].
    const rows = buildInspectorRows([
      redirectLifecycle(),
      makeLifecycle({ requestId: 'later', startedAtMs: 300, phase: 'completed' }),
    ]);
    expect(rows.map((r) => `${r.lifecycle.requestId}#${r.displayId}`)).toEqual([
      'oh-redir:redir#0#1',
      'redir#2',
      'later#3',
    ]);
  });

  it('leaves a non-redirect lifecycle as a single row', () => {
    const rows = buildInspectorRows([makeLifecycle({ requestId: 'plain', phase: 'completed' })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].isRedirectHop).toBeFalsy();
  });
});

describe('buildInspectorRows — consolidateRetries (opt-in)', () => {
  it('is off by default — failed+retry render as two rows', () => {
    const rows = buildInspectorRows([
      makeLifecycle({ requestId: 'fail', startedAtMs: 100, completedAtMs: 110, phase: 'failed' }),
      makeLifecycle({ requestId: 'retry', startedAtMs: 120 }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.consolidatedRetryOf).toEqual([]);
    expect(rows[1]?.consolidatedRetryOf).toEqual([]);
  });

  it('collapses failed → restart on same (url, method) within the window', () => {
    const rows = buildInspectorRows(
      [
        makeLifecycle({ requestId: 'fail', startedAtMs: 100, completedAtMs: 110, phase: 'failed' }),
        makeLifecycle({ requestId: 'retry', startedAtMs: 200 }),
      ],
      { consolidateRetries: true, retryWindowMs: 200 },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.lifecycle.requestId).toBe('retry');
    expect(rows[0]?.consolidatedRetryOf).toEqual(['fail']);
    // The surviving row keeps its own discovery number — 'retry' was the
    // 2nd request in the input/log.
    expect(rows[0]?.displayId).toBe(2);
  });

  it('does not consolidate when URL differs', () => {
    const rows = buildInspectorRows(
      [
        makeLifecycle({
          requestId: 'fail',
          startedAtMs: 100,
          completedAtMs: 110,
          phase: 'failed',
          url: 'https://openheaders.io/a',
        }),
        makeLifecycle({ requestId: 'retry', startedAtMs: 120, url: 'https://openheaders.io/b' }),
      ],
      { consolidateRetries: true },
    );
    expect(rows).toHaveLength(2);
  });

  it('does not consolidate when restart falls outside the window', () => {
    const rows = buildInspectorRows(
      [
        makeLifecycle({ requestId: 'fail', startedAtMs: 100, completedAtMs: 110, phase: 'failed' }),
        makeLifecycle({ requestId: 'retry', startedAtMs: 1000 }),
      ],
      { consolidateRetries: true, retryWindowMs: 200 },
    );
    expect(rows).toHaveLength(2);
  });

  it('collapses transitively: fail → fail → succeed within window', () => {
    const rows = buildInspectorRows(
      [
        makeLifecycle({ requestId: 'a', startedAtMs: 100, completedAtMs: 110, phase: 'failed' }),
        makeLifecycle({ requestId: 'b', startedAtMs: 120, completedAtMs: 130, phase: 'failed' }),
        makeLifecycle({ requestId: 'c', startedAtMs: 140 }),
      ],
      { consolidateRetries: true, retryWindowMs: 100 },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.lifecycle.requestId).toBe('c');
    expect(rows[0]?.consolidatedRetryOf).toEqual(['a', 'b']);
  });
});
