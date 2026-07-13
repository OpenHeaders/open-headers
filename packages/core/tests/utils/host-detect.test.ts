import { describe, expect, it } from 'vitest';
import {
  BROWSER_DISPLAY_NAME,
  detectBrowser,
  detectPlatform,
  type HostProbe,
  PLATFORM_DISPLAY_NAME,
  readHostProbe,
} from '../../src/utils/host-detect';

const CHROME_MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const FIREFOX_LINUX_UA = 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0';
const SAFARI_MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const EDGE_WIN_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0';
const OPERA_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 OPR/111.0.0.0';

function probe(overrides: Partial<HostProbe> = {}): HostProbe {
  return { userAgent: CHROME_MAC_UA, ...overrides };
}

describe('detectBrowser', () => {
  it('detects Chrome from the UA token', () => {
    expect(detectBrowser(probe())).toBe('chrome');
  });

  it('detects Chrome from client-hint brands', () => {
    expect(detectBrowser(probe({ brands: ['Google Chrome', 'Chromium', 'Not/A)Brand'] }))).toBe('chrome');
  });

  it('detects Edge over the underlying Chrome token', () => {
    expect(detectBrowser(probe({ userAgent: EDGE_WIN_UA }))).toBe('edge');
    expect(detectBrowser(probe({ brands: ['Microsoft Edge', 'Chromium'] }))).toBe('edge');
  });

  it('detects Firefox', () => {
    expect(detectBrowser(probe({ userAgent: FIREFOX_LINUX_UA }))).toBe('firefox');
  });

  it('detects Safari only when no Chromium token is present', () => {
    expect(detectBrowser(probe({ userAgent: SAFARI_MAC_UA }))).toBe('safari');
    expect(detectBrowser(probe())).not.toBe('safari');
  });

  it('detects Opera via the OPR token or brand', () => {
    expect(detectBrowser(probe({ userAgent: OPERA_UA }))).toBe('opera');
    expect(detectBrowser(probe({ brands: ['Opera', 'Chromium'] }))).toBe('opera');
  });

  it('detects Brave via the navigator.brave global despite a Chrome UA', () => {
    expect(detectBrowser(probe({ hasBrave: true }))).toBe('brave');
    expect(detectBrowser(probe({ brands: ['Brave', 'Chromium'] }))).toBe('brave');
  });

  it('detects Vivaldi via brand or UA token', () => {
    expect(detectBrowser(probe({ brands: ['Vivaldi', 'Chromium'] }))).toBe('vivaldi');
  });

  it('classifies an unbranded Chromium derivative as chromium', () => {
    expect(detectBrowser(probe({ brands: ['Chromium', 'Not/A)Brand'] }))).toBe('chromium');
  });

  it('returns unknown for an unrecognized UA', () => {
    expect(detectBrowser(probe({ userAgent: 'curl/8.4.0' }))).toBe('unknown');
  });

  it('has a display name for every kind', () => {
    expect(BROWSER_DISPLAY_NAME.chrome).toBe('Chrome');
    expect(BROWSER_DISPLAY_NAME.unknown).toBe('Browser');
  });
});

describe('detectPlatform', () => {
  it('detects macOS from platform or UA', () => {
    expect(detectPlatform(probe({ platform: 'macOS' }))).toBe('macos');
    expect(detectPlatform(probe())).toBe('macos');
  });

  it('detects Windows before the mac fallback', () => {
    expect(detectPlatform(probe({ userAgent: EDGE_WIN_UA, platform: 'Windows' }))).toBe('windows');
    expect(detectPlatform(probe({ userAgent: EDGE_WIN_UA }))).toBe('windows');
  });

  it('detects Linux distros from UA tokens', () => {
    expect(detectPlatform(probe({ userAgent: FIREFOX_LINUX_UA }))).toBe('ubuntu');
    expect(detectPlatform(probe({ userAgent: 'Mozilla/5.0 (X11; Debian; Linux x86_64) Firefox/127.0' }))).toBe(
      'debian',
    );
    expect(detectPlatform(probe({ userAgent: 'Mozilla/5.0 (X11; Fedora; Linux x86_64) Firefox/127.0' }))).toBe(
      'fedora',
    );
    expect(detectPlatform(probe({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/126.0.0.0' }))).toBe('linux');
  });

  it('returns unknown when nothing matches', () => {
    expect(detectPlatform({ userAgent: '' })).toBe('unknown');
  });

  it('has a display name for every kind', () => {
    expect(PLATFORM_DISPLAY_NAME.macos).toBe('macOS');
    expect(PLATFORM_DISPLAY_NAME.unknown).toBe('Device');
  });
});

describe('readHostProbe', () => {
  it('snapshots userAgent, brands, platform, and the brave marker', () => {
    const snapshot = readHostProbe({
      userAgent: CHROME_MAC_UA,
      platform: 'MacIntel',
      brave: {},
      userAgentData: { brands: [{ brand: 'Google Chrome' }, { brand: 'Chromium' }], platform: 'macOS' },
    });
    expect(snapshot).toEqual({
      userAgent: CHROME_MAC_UA,
      brands: ['Google Chrome', 'Chromium'],
      platform: 'macOS',
      hasBrave: true,
    });
  });

  it('falls back to navigator.platform when client hints are absent', () => {
    expect(readHostProbe({ userAgent: SAFARI_MAC_UA, platform: 'MacIntel' })).toEqual({
      userAgent: SAFARI_MAC_UA,
      platform: 'MacIntel',
    });
  });

  it('yields an empty probe for a missing navigator', () => {
    expect(readHostProbe(undefined)).toEqual({ userAgent: '' });
    expect(detectBrowser(readHostProbe(undefined))).toBe('unknown');
  });
});
