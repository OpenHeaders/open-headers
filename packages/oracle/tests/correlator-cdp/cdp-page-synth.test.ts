/**
 * Pure CDP → HAR page-timing base conversions: the wall-clock page start
 * (Chrome's `pseudoWallTime`) and the milestone offsets (`onContentLoad` /
 * `onLoad`).
 */

import { describe, expect, it } from 'vitest';

import { pageMilestoneMs, pageStartedAtMs } from '../../src/correlator-cdp/cdp-page-synth';

describe('pageStartedAtMs — pseudoWallTime mapping', () => {
  it('maps the monotonic page start to wall ms via the document request offset', () => {
    // wall 1_700_000_000s, issued at monotonic 100.5s, network start 100.6s →
    // wall start = (1_700_000_000 - 100.5 + 100.6) * 1000.
    expect(pageStartedAtMs(1_700_000_000, 100.5, 100.6)).toBeCloseTo(1_700_000_000_100, 0);
  });

  it('carries the raw float; scaling noise is left for the export to truncate', () => {
    // (1000 - 0.1 + 0.2) * 1000 = 1000100 mathematically, but float scaling
    // drifts to 1000099.999…; raw-float parity keeps it rather than rounding.
    expect(pageStartedAtMs(1000, 0.1, 0.2)).toBeCloseTo(1_000_100, 6);
  });
});

describe('pageMilestoneMs — offset from page start', () => {
  it('is the event time minus the page start, in ms', () => {
    expect(pageMilestoneMs(100.6, 100.0)).toBeCloseTo(600, 6); // 0.6s after start
  });

  it('carries the raw float, mirroring Chrome Entry.toMilliseconds (no rounding)', () => {
    expect(pageMilestoneMs(1.5765, 0)).toBeCloseTo(1576.5, 6);
  });

  it('returns the -1 sentinel when the event predates the start (clock skew)', () => {
    expect(pageMilestoneMs(0.5, 1.0)).toBe(-1);
  });
});
