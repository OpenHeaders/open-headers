import { describe, expect, it } from 'vitest';
import {
  channelOfVersion,
  desktopFeedUrl,
  releaseNotesUrl,
  UPDATE_FEED_ORIGIN,
  versionsManifestUrl,
  windowsPackagePointerUrl,
} from '../../../src/main/update-feed';
import { VERSIONS_MANIFEST_URL } from '../../../src/main/versions-manifest';

describe('update feed URLs', () => {
  it('lives on the own-domain feed host', () => {
    expect(UPDATE_FEED_ORIGIN).toBe('https://updates.openheaders.com');
  });

  it('routes channels as path segments', () => {
    expect(desktopFeedUrl('stable')).toBe('https://updates.openheaders.com/desktop/stable');
    expect(desktopFeedUrl('beta')).toBe('https://updates.openheaders.com/desktop/beta');
    expect(versionsManifestUrl('stable')).toBe('https://updates.openheaders.com/versions/stable.json');
    expect(versionsManifestUrl('beta')).toBe('https://updates.openheaders.com/versions/beta.json');
    expect(windowsPackagePointerUrl('stable')).toBe(
      'https://updates.openheaders.com/desktop/stable/windows-package.json',
    );
    expect(windowsPackagePointerUrl('beta')).toBe('https://updates.openheaders.com/desktop/beta/windows-package.json');
  });

  it("reads a build's channel from its version", () => {
    expect(channelOfVersion('2026.11.3-beta.6')).toBe('beta');
    expect(channelOfVersion('2026.11.3')).toBe('stable');
    expect(channelOfVersion('2026.11.3-beta')).toBe('stable');
  });

  it('severity always reads the STABLE manifest', () => {
    expect(VERSIONS_MANIFEST_URL).toBe('https://updates.openheaders.com/versions/stable.json');
  });

  it('release notes link to the offered version tag page', () => {
    expect(releaseNotesUrl('2026.8.0')).toBe('https://github.com/OpenHeaders/open-headers/releases/tag/v2026.8.0');
  });
});
