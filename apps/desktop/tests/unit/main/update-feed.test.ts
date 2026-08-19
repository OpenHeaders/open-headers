import { describe, expect, it } from 'vitest';
import {
  desktopFeedUrl,
  releaseNotesUrl,
  UPDATE_FEED_ORIGIN,
  versionsManifestUrl,
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
  });

  it('severity always reads the STABLE manifest', () => {
    expect(VERSIONS_MANIFEST_URL).toBe('https://updates.openheaders.com/versions/stable.json');
  });

  it('release notes link to the offered version tag page', () => {
    expect(releaseNotesUrl('2026.8.0')).toBe('https://github.com/OpenHeaders/open-headers/releases/tag/v2026.8.0');
  });
});
