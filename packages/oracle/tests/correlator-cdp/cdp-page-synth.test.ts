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
    expect(pageStartedAtMs(1_700_000_000, 100.5, 100.6)).toBe(1_700_000_000_100);
  });

  it('rounds representational noise to microsecond precision', () => {
    // (1000 - 0.1 + 0.2) * 1000 = 1000100, but float math drifts; round3 fixes it.
    expect(pageStartedAtMs(1000, 0.1, 0.2)).toBe(1_000_100);
  });
});

describe('pageMilestoneMs — offset from page start', () => {
  it('is the event time minus the page start, in ms', () => {
    expect(pageMilestoneMs(100.6, 100.0)).toBe(600); // 0.6s after start
  });

  it('rounds to microsecond precision', () => {
    expect(pageMilestoneMs(1.5765, 0)).toBe(1576.5);
  });

  it('returns the -1 sentinel when the event predates the start (clock skew)', () => {
    expect(pageMilestoneMs(0.5, 1.0)).toBe(-1);
  });
});
