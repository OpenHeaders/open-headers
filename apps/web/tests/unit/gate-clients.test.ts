/**
 * The pairing gate's install rows — one browser store and one desktop
 * download, resolved from the visitor's own browser and OS.
 */

import { setHostAssets } from '@openheaders/core/assets';
import type { HostProbe } from '@openheaders/core/utils';
import { beforeAll, describe, expect, it } from 'vitest';
import { resolveDesktopTarget, resolveExtensionTargets } from '@/gate-clients';

const probe = (userAgent: string, extra: Partial<HostProbe> = {}): HostProbe => ({ userAgent, ...extra });

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const FIREFOX_UA = 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0';
const EDGE_UA = `${CHROME_UA} Edg/140.0.0.0`;
const SAFARI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15';

beforeAll(() => {
  setHostAssets({ resolveUrl: (path) => (path.startsWith('/') ? path : `/${path}`) });
});

describe('resolveExtensionTargets', () => {
  it('offers only the store the visitor can install from', () => {
    expect(resolveExtensionTargets(probe(CHROME_UA)).map((target) => target.name)).toEqual(['Chrome']);
    expect(resolveExtensionTargets(probe(EDGE_UA)).map((target) => target.name)).toEqual(['Edge']);
    expect(resolveExtensionTargets(probe(FIREFOX_UA)).map((target) => target.name)).toEqual(['Firefox']);
  });

  it('folds every Chromium derivative onto the Chrome Web Store', () => {
    const brave = resolveExtensionTargets(probe(CHROME_UA, { hasBrave: true }));
    expect(brave.map((target) => target.name)).toEqual(['Chrome']);
    expect(brave[0]?.url).toContain('chromewebstore.google.com');
    expect(resolveExtensionTargets(probe(`${CHROME_UA} OPR/114.0.0.0`))[0]?.url).toContain('chromewebstore.google.com');
    expect(resolveExtensionTargets(probe(`${CHROME_UA} Vivaldi/6.9`))[0]?.url).toContain('chromewebstore.google.com');
  });

  it('falls back to every listing where no store serves this browser', () => {
    expect(resolveExtensionTargets(probe(SAFARI_UA)).map((target) => target.name)).toEqual([
      'Chrome',
      'Edge',
      'Firefox',
    ]);
    expect(resolveExtensionTargets(probe('')).map((target) => target.name)).toEqual(['Chrome', 'Edge', 'Firefox']);
  });

  it('marks each listing with its own browser', () => {
    expect(resolveExtensionTargets(probe(FIREFOX_UA))[0]?.icon).toBe('images/clients/firefox.svg');
  });
});

describe('resolveDesktopTarget', () => {
  it('names the platform it detected and marks it', () => {
    expect(resolveDesktopTarget(probe(CHROME_UA))).toMatchObject({
      name: 'macOS',
      icon: 'images/clients/macos.svg',
    });
    expect(resolveDesktopTarget(probe(CHROME_UA, { platform: 'Win32' }))).toMatchObject({
      name: 'Windows',
      icon: 'images/clients/windows.svg',
    });
  });

  it('keeps the distro when the user agent carries one', () => {
    expect(resolveDesktopTarget(probe(FIREFOX_UA))).toMatchObject({
      name: 'Ubuntu',
      icon: 'images/clients/ubuntu.svg',
    });
    expect(resolveDesktopTarget(probe('Mozilla/5.0 (X11; Fedora; Linux x86_64)'))).toMatchObject({
      name: 'Fedora',
      icon: 'images/clients/fedora.svg',
    });
  });

  it('goes unnamed under the product mark when nothing is detected', () => {
    expect(resolveDesktopTarget(probe(''))).toMatchObject({ name: null, icon: 'images/logo-pixel.svg' });
  });

  it('sends every platform to the site install section — no update-feed call from the gate', () => {
    const urls = [CHROME_UA, FIREFOX_UA, ''].map((ua) => resolveDesktopTarget(probe(ua)).url);
    expect(new Set(urls).size).toBe(1);
    expect(urls[0]).toBe('https://openheaders.com/#install-desktop');
  });
});
