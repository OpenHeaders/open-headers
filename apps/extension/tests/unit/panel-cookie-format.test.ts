import {
  formatAbsoluteExpiry,
  formatRelativeExpiry,
  urlDecodeSafe,
} from '@openheaders/ui/panel/data/cookies/cookie-format';
import { describe, expect, it } from 'vitest';

const NOW = Date.UTC(2026, 4, 18, 23, 0, 0);

describe('formatRelativeExpiry', () => {
  it('returns Session when no expiry / flagged session', () => {
    expect(formatRelativeExpiry(undefined, true, NOW, 'en')).toBe('Session');
    expect(formatRelativeExpiry(undefined, undefined, NOW, 'en')).toBe('Session');
  });

  it('returns relative future / past', () => {
    expect(formatRelativeExpiry(Math.floor(NOW / 1000) + 30, false, NOW, 'en')).toBe('in 30s');
    expect(formatRelativeExpiry(Math.floor(NOW / 1000) - 30, false, NOW, 'en')).toBe('30s ago');
    expect(formatRelativeExpiry(Math.floor(NOW / 1000) + 7200, false, NOW, 'en')).toBe('in 2h');
    expect(formatRelativeExpiry(Math.floor(NOW / 1000) + 86400 * 3, false, NOW, 'en')).toBe('in 3d');
    expect(formatRelativeExpiry(Math.floor(NOW / 1000) + 86400 * 30 * 7, false, NOW, 'en')).toBe('in 7mo');
  });

  it('renders through CLDR for other locales', () => {
    expect(formatRelativeExpiry(Math.floor(NOW / 1000) - 30, false, NOW, 'fr')).toBe('-30 s');
    expect(formatRelativeExpiry(Math.floor(NOW / 1000) + 30, false, NOW, 'fr')).toBe('+30 s');
  });
});

describe('formatAbsoluteExpiry', () => {
  it('returns Session when no expiry', () => {
    expect(formatAbsoluteExpiry(undefined, true)).toBe('Session');
  });

  it('renders a UTC date for a real timestamp', () => {
    expect(formatAbsoluteExpiry(Math.floor(NOW / 1000), false)).toMatch(/2026-05-18 23:00:00 UTC/);
  });
});

describe('urlDecodeSafe', () => {
  it('decodes valid percent-encoded text', () => {
    expect(urlDecodeSafe('Europe%2FMadrid')).toBe('Europe/Madrid');
  });

  it('returns input unchanged on malformed encoding', () => {
    expect(urlDecodeSafe('%E0%A4%A')).toBe('%E0%A4%A');
  });
});
