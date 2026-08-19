/**
 * Feed contract pieces: the prerelease-aware CalVer ordering (mirrors
 * the generator and the desktop client — `.9 < .10`, betas below their
 * base) and the manifest `cli` entry parser (anything the generator
 * could not have produced reads as absent).
 */

import { describe, expect, it } from 'vitest';
import { compareCalVer, downloadBaseUrl, parseCliManifestEntry, versionsManifestUrl } from '../../src/update-feed';

describe('compareCalVer', () => {
  it('orders segments numerically, never lexically', () => {
    expect(compareCalVer('2026.7.9', '2026.7.10')).toBeLessThan(0);
    expect(compareCalVer('2026.7.10', '2026.7.9')).toBeGreaterThan(0);
    expect(compareCalVer('2026.7.19', '2026.7.19')).toBe(0);
  });

  it('sorts a beta below its base release and betas by N', () => {
    expect(compareCalVer('2026.7.19-beta.1', '2026.7.19')).toBeLessThan(0);
    expect(compareCalVer('2026.7.19', '2026.7.19-beta.3')).toBeGreaterThan(0);
    expect(compareCalVer('2026.7.19-beta.2', '2026.7.19-beta.10')).toBeLessThan(0);
  });

  it('treats missing segments as zero', () => {
    expect(compareCalVer('2026.7', '2026.7.0')).toBe(0);
    expect(compareCalVer('2026.8', '2026.7.19')).toBeGreaterThan(0);
  });
});

describe('parseCliManifestEntry', () => {
  const entry = { latest: '2026.7.19', tag: 'v2026.7.19', severity: 'normal' };

  it('extracts a valid cli entry, keeping the floor when present', () => {
    expect(parseCliManifestEntry({ cli: entry, desktop: { latest: 'x' } })).toEqual(entry);
    expect(parseCliManifestEntry({ cli: { ...entry, severity: 'security', minimumSafeVersion: '2026.7.19' } })).toEqual(
      { ...entry, severity: 'security', minimumSafeVersion: '2026.7.19' },
    );
  });

  it('reads any shape the generator could not have produced as absent', () => {
    expect(parseCliManifestEntry(null)).toBeNull();
    expect(parseCliManifestEntry({ desktop: entry })).toBeNull();
    expect(parseCliManifestEntry({ cli: { ...entry, latest: 'not-a-version' } })).toBeNull();
    expect(parseCliManifestEntry({ cli: { ...entry, tag: '2026.7.19' } })).toBeNull();
    expect(parseCliManifestEntry({ cli: { ...entry, severity: 'critical' } })).toBeNull();
    expect(parseCliManifestEntry({ cli: { ...entry, minimumSafeVersion: 42 } })).toBeNull();
  });
});

describe('feed URLs', () => {
  it('builds channel manifest and immutable per-tag download paths', () => {
    expect(versionsManifestUrl('stable')).toBe('https://updates.openheaders.com/versions/stable.json');
    expect(versionsManifestUrl('beta')).toBe('https://updates.openheaders.com/versions/beta.json');
    expect(downloadBaseUrl('v2026.7.19')).toBe('https://updates.openheaders.com/dl/v2026.7.19');
  });
});
