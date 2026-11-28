/**
 * Whether an install may switch to the Windows package: one eligible
 * PC, then every reason that holds a switch back, each from the one fact
 * that differs — and the order they are said in when several apply.
 */

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PACKAGE_MANIFEST_FILE_NAME } from '@/main/bootstrap/install-kind';
import {
  PACKAGE_MINIMUM_WINDOWS_BUILD,
  type PackageOffer,
  type PackageSwitchBlocker,
  type PackageSwitchFacts,
  packageSwitchEligibility,
} from '@/main/bootstrap/package-switch-eligibility';

const APP_VERSION = '2026.11.3-beta.11';

function makeOffer(overrides: Partial<Extract<PackageOffer, { state: 'read' }>> = {}): PackageOffer {
  return { state: 'read', version: APP_VERSION, stop: false, forThisArch: true, ...overrides };
}

function makeFacts(overrides: Partial<PackageSwitchFacts> = {}): PackageSwitchFacts {
  return {
    installKind: 'nsis',
    windowsBuild: 26200,
    hasInstaller: true,
    dataDir: 'C:\\Users\\John Doe\\AppData\\Roaming\\OpenHeaders',
    classicDir: 'C:\\Users\\John Doe\\AppData\\Roaming\\OpenHeaders',
    classicDirIsPlain: true,
    packageDir: 'C:\\Users\\John Doe\\AppData\\Local\\OpenHeaders-Data',
    packageDirIsAbsent: true,
    packageInstalled: false,
    appVersion: APP_VERSION,
    offer: makeOffer(),
    ...overrides,
  };
}

function blockerOf(overrides: Partial<PackageSwitchFacts>): PackageSwitchBlocker | null {
  const eligibility = packageSwitchEligibility(makeFacts(overrides));
  return eligibility.eligible ? null : eligibility.blocker;
}

describe('whether an install may switch to the Windows package', () => {
  it('lets a classic install switch to the package its channel offers, and names that package', () => {
    expect(packageSwitchEligibility(makeFacts())).toEqual({ eligible: true, version: APP_VERSION });
    expect(packageSwitchEligibility(makeFacts({ offer: makeOffer({ version: '2026.11.4' }) }))).toEqual({
      eligible: true,
      version: '2026.11.4',
    });
  });

  it('takes the oldest Windows the package names, and a data folder spelled in another case', () => {
    expect(blockerOf({ windowsBuild: PACKAGE_MINIMUM_WINDOWS_BUILD })).toBeNull();
    expect(blockerOf({ dataDir: 'c:\\users\\john doe\\appdata\\roaming\\openheaders' })).toBeNull();
    expect(blockerOf({ packageDir: 'c:\\Users\\John Doe\\AppData\\Local\\OpenHeaders-Data' })).toBeNull();
  });

  it.each<[PackageSwitchBlocker, Partial<PackageSwitchFacts>]>([
    ['not-classic-install', { installKind: 'msi' }],
    ['not-classic-install', { installKind: 'msix' }],
    ['not-classic-install', { installKind: 'dev' }],
    ['not-classic-install', { installKind: null }],
    ['windows-too-old', { windowsBuild: PACKAGE_MINIMUM_WINDOWS_BUILD - 1 }],
    ['windows-too-old', { windowsBuild: null }],
    ['no-installer', { hasInstaller: false }],
    ['data-folder-elsewhere', { dataDir: 'D:\\Profiles\\OpenHeaders' }],
    ['data-folder-not-plain', { classicDirIsPlain: false }],
    ['data-on-another-volume', { packageDir: 'D:\\Local\\OpenHeaders-Data' }],
    [
      'data-on-another-volume',
      {
        dataDir: '\\\\files.openheaders.io\\profiles\\John Doe\\OpenHeaders',
        classicDir: '\\\\files.openheaders.io\\profiles\\John Doe\\OpenHeaders',
      },
    ],
    ['package-installed', { packageInstalled: true }],
    ['package-installed', { packageInstalled: null }],
    ['package-data-left', { packageDirIsAbsent: false }],
    ['feed-unread', { offer: { state: 'unread' } }],
    ['no-package-offered', { offer: { state: 'none' } }],
    ['no-package-offered', { offer: makeOffer({ forThisArch: false }) }],
    ['held-back', { offer: makeOffer({ stop: true }) }],
    ['package-older', { offer: makeOffer({ version: '2026.11.3-beta.10' }) }],
    ['package-older', { appVersion: '2026.11.3', offer: makeOffer({ version: '2026.11.3-beta.11' }) }],
  ])('holds a switch back with %s', (blocker, overrides) => {
    expect(packageSwitchEligibility(makeFacts(overrides))).toEqual({ eligible: false, blocker });
  });

  it("says this PC's own reason before the feed's, and the install's before the data's", () => {
    const everything: Partial<PackageSwitchFacts> = {
      installKind: 'msi',
      windowsBuild: 18363,
      hasInstaller: false,
      dataDir: 'D:\\Profiles\\OpenHeaders',
      classicDirIsPlain: false,
      packageDir: 'E:\\Local\\OpenHeaders-Data',
      packageInstalled: true,
      packageDirIsAbsent: false,
      offer: { state: 'unread' },
    };
    const order: [PackageSwitchBlocker, Partial<PackageSwitchFacts>][] = [
      ['not-classic-install', { installKind: 'nsis' }],
      ['windows-too-old', { windowsBuild: 26200 }],
      ['no-installer', { hasInstaller: true }],
      ['data-folder-elsewhere', { dataDir: makeFacts().classicDir }],
      ['data-folder-not-plain', { classicDirIsPlain: true }],
      ['data-on-another-volume', { packageDir: makeFacts().packageDir }],
      ['package-installed', { packageInstalled: false }],
      ['package-data-left', { packageDirIsAbsent: true }],
      ['feed-unread', { offer: makeOffer({ stop: true, forThisArch: false, version: '2026.11.2' }) }],
      ['no-package-offered', { offer: makeOffer({ stop: true, version: '2026.11.2' }) }],
      ['held-back', { offer: makeOffer({ version: '2026.11.2' }) }],
      ['package-older', { offer: makeOffer() }],
    ];

    let facts = everything;
    for (const [blocker, mended] of order) {
      expect(blockerOf(facts)).toBe(blocker);
      facts = { ...facts, ...mended };
    }
    expect(blockerOf(facts)).toBeNull();
  });

  it("names the Windows floor the package's own manifest names", () => {
    const manifest = readFileSync(
      path.resolve(__dirname, '../../../../build/windows', PACKAGE_MANIFEST_FILE_NAME),
      'utf8',
    );

    expect(/MinVersion="10\.0\.(\d+)\.0"/.exec(manifest)?.[1]).toBe(String(PACKAGE_MINIMUM_WINDOWS_BUILD));
  });
});
