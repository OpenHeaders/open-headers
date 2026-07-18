import { describe, expect, it } from 'vitest';
import {
  compareCalVer,
  fetchDesktopSeverity,
  isBelowSafeFloor,
  parseDesktopSeverity,
  VERSIONS_MANIFEST_URL,
} from '../../../src/main/versions-manifest';

describe('compareCalVer', () => {
  it('orders segment-wise numerically', () => {
    expect(compareCalVer('2026.7.2', '2026.8.0')).toBeLessThan(0);
    expect(compareCalVer('2026.10.0', '2026.9.9')).toBeGreaterThan(0);
    expect(compareCalVer('2026.7.11', '2026.7.11')).toBe(0);
  });

  it('treats missing segments as zero', () => {
    expect(compareCalVer('2026.7', '2026.7.0')).toBe(0);
    expect(compareCalVer('2026.7.11-beta.2', '2026.8.0')).toBeLessThan(0);
  });

  it('orders betas below their release and numerically among themselves', () => {
    expect(compareCalVer('2026.8.0-beta.1', '2026.8.0')).toBeLessThan(0);
    expect(compareCalVer('2026.8.0', '2026.8.0-beta.4')).toBeGreaterThan(0);
    expect(compareCalVer('2026.8.0-beta.2', '2026.8.0-beta.10')).toBeLessThan(0);
    expect(compareCalVer('2026.8.0-beta.3', '2026.8.0-beta.3')).toBe(0);
    expect(compareCalVer('2026.8.0-beta.9', '2026.8.1-beta.1')).toBeLessThan(0);
  });
});

describe('parseDesktopSeverity', () => {
  const valid = {
    desktop: { latest: '2026.8.0', severity: 'security', minimumSafeVersion: '2026.8.0' },
    daemon: { latest: '2026.7.0', severity: 'normal' },
  };

  it('extracts a valid desktop entry', () => {
    expect(parseDesktopSeverity(valid)).toEqual({
      latest: '2026.8.0',
      severity: 'security',
      minimumSafeVersion: '2026.8.0',
    });
    expect(parseDesktopSeverity({ desktop: { latest: '2026.8.0', severity: 'normal' } })).toEqual({
      latest: '2026.8.0',
      severity: 'normal',
    });
  });

  it('rejects shapes the generator cannot produce', () => {
    expect(parseDesktopSeverity(null)).toBeNull();
    expect(parseDesktopSeverity('versions')).toBeNull();
    expect(parseDesktopSeverity({})).toBeNull();
    expect(parseDesktopSeverity({ desktop: { latest: 'nope', severity: 'normal' } })).toBeNull();
    expect(parseDesktopSeverity({ desktop: { latest: '2026.8.0', severity: 'critical' } })).toBeNull();
    expect(
      parseDesktopSeverity({ desktop: { latest: '2026.8.0', severity: 'security', minimumSafeVersion: 42 } }),
    ).toBeNull();
  });
});

describe('isBelowSafeFloor', () => {
  it('true only for a security release with a floor above the running version', () => {
    const info = { latest: '2026.8.0', severity: 'security', minimumSafeVersion: '2026.8.0' } as const;
    expect(isBelowSafeFloor(info, '2026.7.2')).toBe(true);
    expect(isBelowSafeFloor(info, '2026.8.0')).toBe(false);
    expect(isBelowSafeFloor(info, '2026.9.0')).toBe(false);
    expect(isBelowSafeFloor({ latest: '2026.8.0', severity: 'normal' }, '2026.7.2')).toBe(false);
  });
});

describe('fetchDesktopSeverity', () => {
  const jsonResponse = (body: unknown, ok = true): Response => ({ ok, json: async () => body }) as unknown as Response;

  it('fetches the stable manifest URL anonymously and parses the desktop entry', async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return jsonResponse({ desktop: { latest: '2026.8.0', severity: 'normal' } });
    }) as typeof fetch;
    expect(await fetchDesktopSeverity(fetchFn)).toEqual({ latest: '2026.8.0', severity: 'normal' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(VERSIONS_MANIFEST_URL);
  });

  it('returns null on non-200, network failure, and unparseable bodies', async () => {
    expect(await fetchDesktopSeverity((async () => jsonResponse({}, false)) as typeof fetch)).toBeNull();
    expect(
      await fetchDesktopSeverity((async () => {
        throw new Error('offline');
      }) as typeof fetch),
    ).toBeNull();
    expect(await fetchDesktopSeverity((async () => jsonResponse({ desktop: 'nope' })) as typeof fetch)).toBeNull();
  });
});
