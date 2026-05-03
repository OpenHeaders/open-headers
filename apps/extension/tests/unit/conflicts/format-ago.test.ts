import { describe, expect, it } from 'vitest';
import { formatAgo } from '@/shared/awareness/format-ago';

describe('formatAgo', () => {
  it('treats sub-second deltas as "just now"', () => {
    expect(formatAgo(0)).toBe('just now');
    expect(formatAgo(800)).toBe('just now');
    expect(formatAgo(1499)).toBe('just now');
  });

  it('rounds seconds when under a minute', () => {
    expect(formatAgo(4_000)).toBe('4s ago');
    expect(formatAgo(45_500)).toBe('46s ago');
  });

  it('rolls into minutes / hours / days', () => {
    expect(formatAgo(90_000)).toBe('2m ago');
    expect(formatAgo(45 * 60_000)).toBe('45m ago');
    expect(formatAgo(2.6 * 60 * 60_000)).toBe('3h ago');
    expect(formatAgo(48 * 60 * 60_000)).toBe('2d ago');
  });

  it('clamps negative skew to "just now"', () => {
    expect(formatAgo(-3_000)).toBe('just now');
  });

  it('handles non-finite as "just now"', () => {
    expect(formatAgo(Number.NaN)).toBe('just now');
  });
});
