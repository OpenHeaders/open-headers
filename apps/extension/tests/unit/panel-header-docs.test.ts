import { DEFAULT_LOCALE, getTranslator } from '@openheaders/i18n';
import {
  getHeaderInfo,
  getHeaderInfoContent,
  hasHeaderInfo,
  headerInfoCount,
} from '@openheaders/ui/shared/info-popover/data/http-headers';
import type { InfoPopoverSection } from '@openheaders/ui/shared/info-popover';
import { describe, expect, it } from 'vitest';

const t = getTranslator(DEFAULT_LOCALE);

describe('http-headers info registry', () => {
  it('covers a substantial set of common headers', () => {
    expect(headerInfoCount()).toBeGreaterThanOrEqual(40);
  });

  it('hasHeaderInfo is case-insensitive', () => {
    for (const name of ['Cache-Control', 'set-cookie', 'CONTENT-TYPE', 'Authorization']) {
      expect(hasHeaderInfo(name)).toBe(true);
    }
    expect(hasHeaderInfo('X-Made-Up-Header-That-Does-Not-Exist')).toBe(false);
  });

  it('getHeaderInfoContent returns full popover content for known headers', () => {
    const content = getHeaderInfoContent(t, 'Cache-Control');
    expect(content).not.toBeNull();
    if (!content) return;
    expect(content.title).toBe('Cache-Control');
    expect(content.kicker).toMatch(/Caching/);
    // `summary` is typed ReactNode; the header registry always supplies a string.
    expect(typeof content.summary).toBe('string');
    expect(String(content.summary).length).toBeGreaterThan(0);
    // Cache-Control has a directives section.
    expect(content.sections?.some((s: InfoPopoverSection) => s.heading === 'Directives')).toBe(true);
  });

  it('getHeaderInfoContent returns null for unknown headers', () => {
    expect(getHeaderInfoContent(t, 'X-Made-Up')).toBeNull();
  });

  it('every entry has a non-empty display, keyed summary, and a known direction/category', () => {
    const directions = new Set(['request', 'response', 'both']);
    const categories = new Set([
      'CORS',
      'Caching',
      'Security',
      'Cookies',
      'Content',
      'Auth',
      'Tracing',
      'Client Hints',
      'Fetch metadata',
    ]);
    // Pick a representative sample by hitting each category we expect.
    for (const name of [
      'Access-Control-Allow-Origin',
      'Cache-Control',
      'Strict-Transport-Security',
      'Set-Cookie',
      'Content-Type',
      'Authorization',
      'Server-Timing',
      'Sec-Fetch-Mode',
      'Sec-CH-UA',
    ]) {
      const entry = getHeaderInfo(name);
      expect(entry).not.toBeNull();
      if (!entry) continue;
      expect(entry.display.length).toBeGreaterThan(0);
      // The summary is a catalog key — resolving it must yield prose,
      // not the key echoed back (the runtime's miss fallback).
      expect(t(entry.summaryKey)).not.toBe(entry.summaryKey);
      expect(t(entry.summaryKey).length).toBeGreaterThan(0);
      expect(directions.has(entry.direction)).toBe(true);
      expect(categories.has(entry.category)).toBe(true);
    }
  });
});
