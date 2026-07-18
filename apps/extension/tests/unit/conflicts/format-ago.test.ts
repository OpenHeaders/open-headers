import { formatAgo } from '@openheaders/ui/shared/awareness/format-ago';
import { describe, expect, it } from 'vitest';

describe('formatAgo', () => {
  it('treats sub-second deltas as "now"', () => {
    expect(formatAgo(0, 'en')).toBe('now');
    expect(formatAgo(800, 'en')).toBe('now');
    expect(formatAgo(1499, 'en')).toBe('now');
  });

  it('rounds seconds when under a minute', () => {
    expect(formatAgo(4_000, 'en')).toBe('4s ago');
    expect(formatAgo(45_500, 'en')).toBe('46s ago');
  });

  it('rolls into minutes / hours / days', () => {
    expect(formatAgo(90_000, 'en')).toBe('2m ago');
    expect(formatAgo(45 * 60_000, 'en')).toBe('45m ago');
    expect(formatAgo(2.6 * 60 * 60_000, 'en')).toBe('3h ago');
    expect(formatAgo(48 * 60 * 60_000, 'en')).toBe('2d ago');
  });

  it('clamps negative skew to "now"', () => {
    expect(formatAgo(-3_000, 'en')).toBe('now');
  });

  it('handles non-finite as "now"', () => {
    expect(formatAgo(Number.NaN, 'en')).toBe('now');
  });

  it('renders through CLDR for other locales', () => {
    expect(formatAgo(0, 'fr')).toBe('maintenant');
    expect(formatAgo(30_000, 'fr')).toBe('-30 s');
  });
});
