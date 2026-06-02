import { currentHarEntry } from '@openheaders/ui/panel/data/inspector-row-projection';
import { queueingMs, timelineEndMs, waterfallSortValue } from '@openheaders/ui/panel/data/network-columns';
import { computeTimingPhases } from '@openheaders/ui/panel/data/timing-phases';
import {
  barLabels,
  durationBarLayout,
  formatBarMs,
  pageMarkers,
  timelineBarLayout,
} from '@openheaders/ui/panel/data/waterfall-geometry';
import type { InspectorRowWithFires } from '@openheaders/ui/panel/data/inspector-row-projection';
import { describe, expect, it } from 'vitest';
import { makePage, makeRow } from '../__factories__/lifecycle';

function timingOf(row: InspectorRowWithFires) {
  const har = currentHarEntry(row.lifecycle);
  return har ? computeTimingPhases(har) : null;
}

// The github.com main-document load captured for the parity pass — `connect`
// spans both dns and ssl (HAR 1.2), so `time` double-counts dns. Real numbers
// keep the geometry honest against what the browser actually exports.
const GH_TIMINGS = {
  blocked: 4.367,
  dns: 26.386,
  ssl: 127.54,
  connect: 280.344,
  send: 0.39,
  wait: 129.846,
  receive: 377.882,
  _blocked_queueing: 3.343,
} as const;
const GH_TIME = 819.215;

// Derived, once, the way the columns + geometry should: duration strips
// queueing and the duplicated dns; latency is duration minus content download.
const QUEUEING = 3.343;
const DURATION = GH_TIME - QUEUEING - GH_TIMINGS.dns; // 789.486
const LATENCY = DURATION - GH_TIMINGS.receive; // 411.604

function ghRow(startedAtMs: number) {
  return makeRow({
    startedAtMs,
    completedAtMs: startedAtMs + GH_TIME,
    resourceType: 'document',
    harOverrides: { time: GH_TIME, timings: { ...GH_TIMINGS } },
  });
}

describe('waterfall sort keys', () => {
  const row = ghRow(1000);

  it('measures start time from the post-queue baseline, not the issue time', () => {
    // The browser's start time is requestTime (after queueing); startedAtMs is
    // the issue time, so the queueing delay is added back.
    expect(waterfallSortValue(row, 'startTime')).toBeCloseTo(1000 + QUEUEING, 3);
    expect(queueingMs(row.lifecycle)).toBeCloseTo(QUEUEING, 3);
  });

  it('places response time at post-queue start + latency', () => {
    expect(waterfallSortValue(row, 'responseTime')).toBeCloseTo(1000 + QUEUEING + LATENCY, 3);
  });

  it('keeps duration and latency free of queueing and double-counted dns', () => {
    expect(waterfallSortValue(row, 'duration')).toBeCloseTo(DURATION, 3);
    expect(waterfallSortValue(row, 'latency')).toBeCloseTo(LATENCY, 3);
  });

  it('uses the terminal wall time for end time', () => {
    expect(waterfallSortValue(row, 'endTime')).toBe(1000 + GH_TIME);
  });

  it('reports -1 for a still-pending response/latency', () => {
    const pending = makeRow({ startedAtMs: 1000 });
    expect(waterfallSortValue(pending, 'responseTime')).toBe(-1);
  });
});

describe('timelineEndMs', () => {
  it('anchors the finish at issue + queueing + duration (dns counted once)', () => {
    expect(timelineEndMs(ghRow(1000).lifecycle)).toBeCloseTo(1000 + QUEUEING + DURATION, 3);
  });
});

describe('durationBarLayout', () => {
  it('scales width against the largest duration in view', () => {
    const layout = durationBarLayout(ghRow(1000), DURATION * 2);
    expect(layout.widthPct).toBeCloseTo(50, 3);
  });

  it('splits the bar at the first-byte point (waiting vs download)', () => {
    const layout = durationBarLayout(ghRow(1000), DURATION);
    expect(layout.widthPct).toBeCloseTo(100, 3);
    expect(layout.waitPct).toBeCloseTo((LATENCY / DURATION) * 100, 3);
    expect(layout.downloadMs).toBeCloseTo(GH_TIMINGS.receive, 3);
  });
});

describe('timelineBarLayout', () => {
  // total = phase sum with dns counted once = queueing + duration.
  const TOTAL = QUEUEING + DURATION;

  it('spans issue→finish on the window and tiles the bar with phase segments', () => {
    const t0 = 1000;
    const tMax = 1000 + TOTAL;
    const row = ghRow(1000);
    const layout = timelineBarLayout(row, t0, tMax, timingOf(row));

    expect(layout.leftPct).toBeCloseTo(0, 3);
    expect(layout.widthPct).toBeCloseTo(100, 3);
    // queueing, stalled, dns, connect, ssl, send, wait, receive — all present.
    expect(layout.segments.map((s) => s.key)).toEqual([
      'queueing',
      'stalled',
      'dns',
      'connect',
      'ssl',
      'send',
      'wait',
      'receive',
    ]);
    const sum = layout.segments.reduce((acc, s) => acc + s.pct, 0);
    expect(sum).toBeCloseTo(100, 3);
    expect(layout.segments[0].pct).toBeCloseTo((QUEUEING / TOTAL) * 100, 3);
  });

  it('positions the bar by issue time, offset into the window', () => {
    const t0 = 1000;
    const tMax = 1000 + TOTAL + 500;
    const row = ghRow(1200);
    const layout = timelineBarLayout(row, t0, tMax, timingOf(row));
    expect(layout.leftPct).toBeCloseTo((200 / (tMax - t0)) * 100, 3);
  });

  it('falls back to an empty (unsegmented) bar when no timing detail exists', () => {
    const pending = makeRow({ startedAtMs: 1000, completedAtMs: 1100, harOverrides: { time: 100 } });
    const layout = timelineBarLayout(pending, 1000, 1200, null);
    expect(layout.segments).toEqual([]);
    expect(layout.leftPct).toBeCloseTo(0, 3);
  });
});

describe('barLabels', () => {
  it('drops both labels when the column width is unknown', () => {
    const layout = durationBarLayout(ghRow(1000), DURATION);
    const labels = barLabels(layout, 0);
    expect(labels.latency.inside).toBe(false);
    expect(labels.download.placement).toBe('none');
  });

  it('places both labels inside when the bar is wide enough', () => {
    const layout = durationBarLayout(ghRow(1000), DURATION);
    const labels = barLabels(layout, 400);
    expect(labels.latency.inside).toBe(true);
    expect(labels.download.placement).toBe('inside');
    expect(labels.download.text).toBe('378 ms');
  });

  it('drops the download label entirely when it fits neither inside nor outside', () => {
    const layout = durationBarLayout(ghRow(1000), DURATION);
    const labels = barLabels(layout, 30);
    expect(labels.latency.inside).toBe(false);
    expect(labels.download.placement).toBe('none');
  });
});

describe('pageMarkers', () => {
  it('places DCL/Load at their absolute instant on the window', () => {
    // milestones are relative to navigation start (page.startedAtMs).
    const page = makePage({ startedAtMs: 1000, dclMs: 200, loadMs: 400 });
    const markers = pageMarkers([page], 1000, 1500);
    expect(markers).toEqual([
      { key: `${page.id}-dcl`, kind: 'dcl', pct: 40 },
      { key: `${page.id}-load`, kind: 'load', pct: 80 },
    ]);
  });

  it('drops a milestone that falls outside the window', () => {
    const page = makePage({ startedAtMs: 1000, dclMs: 200, loadMs: 600 });
    const markers = pageMarkers([page], 1000, 1500);
    expect(markers.map((m) => m.kind)).toEqual(['dcl']);
  });

  it('emits nothing for a page with no nav-timing milestones', () => {
    expect(pageMarkers([makePage({ startedAtMs: 1000 })], 1000, 1500)).toEqual([]);
  });
});

describe('formatBarMs', () => {
  it('rounds to whole milliseconds below a second', () => {
    expect(formatBarMs(LATENCY)).toBe('412 ms');
    expect(formatBarMs(0.4)).toBe('0 ms');
  });

  it('switches to two-decimal seconds at and above a second', () => {
    expect(formatBarMs(1500)).toBe('1.50 s');
  });
});
