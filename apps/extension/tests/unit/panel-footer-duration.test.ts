/**
 * Footer milestone duration formatter — Finish / DOMContentLoaded / Load.
 *
 * Below 1 s reads in whole ms, below 1 min in 2-decimal seconds, and at a
 * minute or more switches to "<min> min <sec.dd> s" — keeping the seconds at
 * full precision rather than a fractional-minute reading the user must decode.
 */

import { formatFooterDuration } from '@openheaders/ui/panel/data/timing/footer-timing';
import { describe, expect, it } from 'vitest';

describe('formatFooterDuration', () => {
  it('returns empty for unknown / non-positive input', () => {
    expect(formatFooterDuration(undefined)).toBe('');
    expect(formatFooterDuration(0)).toBe('');
    expect(formatFooterDuration(-5)).toBe('');
    expect(formatFooterDuration(Number.NaN)).toBe('');
  });

  it('shows whole milliseconds below one second', () => {
    expect(formatFooterDuration(840)).toBe('840 ms');
    expect(formatFooterDuration(7.4)).toBe('7 ms');
  });

  it('shows 2-decimal seconds from 1 s up to 1 min', () => {
    expect(formatFooterDuration(1000)).toBe('1.00 s');
    expect(formatFooterDuration(7_730)).toBe('7.73 s');
    expect(formatFooterDuration(59_990)).toBe('59.99 s');
  });

  it('switches to "<min> min <sec.dd> s" at a minute or more', () => {
    expect(formatFooterDuration(180_290)).toBe('3 min 0.29 s');
    expect(formatFooterDuration(158_740)).toBe('2 min 38.74 s');
    expect(formatFooterDuration(60_000)).toBe('1 min 0.00 s');
  });

  it('carries a seconds value that rounds up to a whole minute', () => {
    // 119.996 s → rounds to 120.00 s → 2 min 0.00 s, not "1 min 60.00 s".
    expect(formatFooterDuration(119_996)).toBe('2 min 0.00 s');
  });
});
