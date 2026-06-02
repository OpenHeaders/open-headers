/**
 * Inspector facet (P3) — pure projection from lifecycle snapshot to
 * rows. Asserts sort key stability, discovery-order displayId (Request #
 * follows input/log order, not the time-sorted row order), and the
 * retry-consolidation policy (opt-in, same-(url, method), within window).
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { describe, expect, it } from 'vitest';

import { buildInspectorRows, inspectorSortKey, type InspectorRow } from '@openheaders/ui/panel/data/lifecycle';

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

describe('inspectorSortKey', () => {
  it('returns startedAtMs', () => {
    expect(inspectorSortKey(makeLifecycle({ startedAtMs: 1234 }))).toBe(1234);
  });
});

describe('buildInspectorRows — ordering + displayId', () => {
  it('sorts rows by startedAtMs ascending, breaks ties by requestId', () => {
    const rows = buildInspectorRows([
      makeLifecycle({ requestId: 'c', startedAtMs: 200 }),
      makeLifecycle({ requestId: 'a', startedAtMs: 100 }),
      makeLifecycle({ requestId: 'b', startedAtMs: 100 }),
    ]);
    expect(rows.map((r: InspectorRow) => r.lifecycle.requestId)).toEqual(['a', 'b', 'c']);
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
        makeLifecycle({ requestId: 'fail', startedAtMs: 100, completedAtMs: 110, phase: 'failed', url: 'https://openheaders.io/a' }),
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
