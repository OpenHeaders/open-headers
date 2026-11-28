/**
 * What a classic install reads before it may switch to the Windows
 * package: each fact from its own edge, on a profile laid out in a temp
 * folder, with the feed and Windows answered by fakes — and the rule's
 * verdict on what was read.
 */

import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { packageSwitchEligibility } from '@/main/bootstrap/package-switch-eligibility';
import {
  CARRIED_INSTALLER_DIR_NAME,
  carriedInstallerFileName,
  carriedInstallerPath,
  type PackageSwitchAsk,
  type PackageSwitchInstall,
  readPackageSwitchFacts,
  windowsBuildOf,
} from '@/main/package-switch-facts';

const APP_VERSION = '2026.11.3-beta.11';
const X64_URL = `https://updates.openheaders.io/dl/v${APP_VERSION}/OpenHeaders-${APP_VERSION}-x64.msix`;
const ARM64_URL = `https://updates.openheaders.io/dl/v${APP_VERSION}/OpenHeaders-${APP_VERSION}-arm64.msix`;

function makePointer(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: APP_VERSION,
    packages: {
      x64: { url: X64_URL, size: 255_864_283, sha256: 'a'.repeat(64) },
      arm64: { url: ARM64_URL, size: 252_351_043, sha256: 'b'.repeat(64) },
    },
    stop: false,
    ramp: 100,
    ...overrides,
  };
}

let profile = '';

/** A classic install's profile: its data folder, its tree's resources with the installer, no package anywhere. */
function layOutProfile(): void {
  profile = mkdtempSync(path.join(tmpdir(), 'oh-switch-facts-'));
  mkdirSync(path.join(profile, 'Roaming', 'OpenHeaders', 'logs'), { recursive: true });
  mkdirSync(path.join(profile, 'Local', 'Packages'), { recursive: true });
  mkdirSync(path.join(profile, 'tree', 'resources', 'installer'), { recursive: true });
  for (const arch of ['x64', 'arm64'] as const) {
    writeFileSync(path.join(profile, 'tree', 'resources', 'installer', carriedInstallerFileName(arch)), arch);
  }
}

function makeInstall(overrides: Partial<PackageSwitchInstall> = {}): PackageSwitchInstall {
  return {
    installKind: 'nsis',
    osRelease: '10.0.26200',
    resourcesPath: path.join(profile, 'tree', 'resources'),
    arch: 'x64',
    underArm64Translation: false,
    dataDir: path.join(profile, 'Roaming', 'OpenHeaders'),
    isPackaged: true,
    appDataDir: path.join(profile, 'Roaming'),
    localAppDataDir: path.join(profile, 'Local'),
    homeDir: profile,
    appVersion: APP_VERSION,
    ...overrides,
  };
}

interface ReadOptions {
  install?: Partial<PackageSwitchInstall>;
  ask?: Partial<PackageSwitchAsk>;
  pointer?: unknown;
  status?: number;
  /** The feed cannot be reached at all. */
  offline?: boolean;
  /** What Windows answers when asked by the package's name. */
  windowsSays?: boolean | null;
  packageFolder?: boolean | null;
}

async function read(options: ReadOptions = {}) {
  const urls: string[] = [];
  const warned: string[] = [];
  let windowsAsked = 0;
  const fetchFn = (async (input: string | URL | Request) => {
    urls.push(String(input));
    if (options.offline) throw new Error('getaddrinfo ENOTFOUND updates.openheaders.io');
    const status = options.status ?? 200;
    return { ok: status === 200, status, json: async () => options.pointer ?? makePointer() } as Response;
  }) as typeof fetch;
  const facts = await readPackageSwitchFacts(
    makeInstall(options.install),
    { channel: 'beta', askWindows: false, ...options.ask },
    {
      fetch: fetchFn,
      log: { warn: (message) => warned.push(message) },
      ...(options.packageFolder !== undefined ? { hasPackageFolder: () => options.packageFolder ?? null } : {}),
      askWindows: async () => {
        windowsAsked += 1;
        return options.windowsSays === undefined ? false : options.windowsSays;
      },
    },
  );
  return { facts, urls, warned, windowsAsked: () => windowsAsked };
}

beforeEach(layOutProfile);

afterEach(() => {
  rmSync(profile, { recursive: true, force: true });
});

describe('the build of this Windows', () => {
  it.each([
    ['10.0.26200', 26200],
    ['10.0.19041', 19041],
    ['10.0.19045.6456', 19045],
  ])('reads %s as %d', (release, build) => {
    expect(windowsBuildOf(release)).toBe(build);
  });

  it.each(['', '10.0', 'Windows 11'])('has no answer for "%s"', (release) => {
    expect(windowsBuildOf(release)).toBeNull();
  });
});

describe('the installer program a tree carries', () => {
  it.each(['x64', 'arm64'] as const)('is the one of its own arch (%s)', (arch) => {
    expect(carriedInstallerPath({ resourcesPath: path.join(profile, 'tree', 'resources'), arch })).toBe(
      path.join(profile, 'tree', 'resources', CARRIED_INSTALLER_DIR_NAME, `OpenHeaders-Installer-${arch}.exe`),
    );
  });

  it('is none for an arch the installer is not built for', () => {
    expect(carriedInstallerPath({ resourcesPath: path.join(profile, 'tree', 'resources'), arch: 'ia32' })).toBeNull();
  });
});

describe('what a classic install reads before a switch', () => {
  it('reads a PC that may switch, and the rule names the package its channel offers', async () => {
    const { facts, urls, warned } = await read();

    expect(facts).toEqual({
      installKind: 'nsis',
      windowsBuild: 26200,
      hasInstaller: true,
      dataDir: path.join(profile, 'Roaming', 'OpenHeaders'),
      classicDir: path.join(profile, 'Roaming', 'OpenHeaders'),
      classicDirIsPlain: true,
      packageDir: path.join(profile, 'Local', 'OpenHeaders-Data'),
      packageDirIsAbsent: true,
      packageInstalled: false,
      appVersion: APP_VERSION,
      offer: { state: 'read', version: APP_VERSION, stop: false, forThisArch: true },
    });
    expect(packageSwitchEligibility(facts)).toEqual({ eligible: true, version: APP_VERSION });
    expect(urls).toEqual(['https://updates.openheaders.com/desktop/beta/windows-package.json']);
    expect(warned).toEqual([]);
  });

  it("reads the pointer of the channel the install follows, and no other's", async () => {
    const { urls } = await read({ ask: { channel: 'stable' } });

    expect(urls).toEqual(['https://updates.openheaders.com/desktop/stable/windows-package.json']);
  });

  it('looks for Local AppData under the home folder when the variable is unset', async () => {
    mkdirSync(path.join(profile, 'AppData', 'Local', 'Packages', 'OpenHeaders_eh4g1zpqgsf2c'), { recursive: true });

    const { facts } = await read({ install: { localAppDataDir: undefined } });

    expect(facts.packageDir).toBe(path.join(profile, 'AppData', 'Local', 'OpenHeaders-Data'));
    expect(facts.packageInstalled).toBe(true);
  });

  describe('this PC', () => {
    it('says a tree that carries no installer of its arch', async () => {
      rmSync(path.join(profile, 'tree', 'resources', 'installer', carriedInstallerFileName('x64')));

      expect((await read()).facts.hasInstaller).toBe(false);
      expect((await read({ install: { arch: 'arm64' } })).facts.hasInstaller).toBe(true);
      expect((await read({ install: { arch: 'ia32' } })).facts.hasInstaller).toBe(false);
    });

    it('says a Windows whose build it cannot read', async () => {
      expect((await read({ install: { osRelease: '' } })).facts.windowsBuild).toBeNull();
    });

    it('hands over the folder the run keeps its data in as it is', async () => {
      const elsewhere = path.join(profile, 'elsewhere');

      const { facts } = await read({ install: { dataDir: elsewhere } });

      expect(facts.dataDir).toBe(elsewhere);
      expect(facts.classicDir).toBe(path.join(profile, 'Roaming', 'OpenHeaders'));
    });

    it('says a classic data folder that is a link, and one that is not there', async () => {
      rmSync(path.join(profile, 'Roaming', 'OpenHeaders'), { recursive: true });
      expect((await read()).facts.classicDirIsPlain).toBe(false);

      mkdirSync(path.join(profile, 'real'));
      symlinkSync(path.join(profile, 'real'), path.join(profile, 'Roaming', 'OpenHeaders'), 'junction');
      expect((await read()).facts.classicDirIsPlain).toBe(false);
    });

    it('says a data folder an earlier package left', async () => {
      mkdirSync(path.join(profile, 'Local', 'OpenHeaders-Data'));

      expect((await read()).facts.packageDirIsAbsent).toBe(false);
    });
  });

  describe('whether a package of ours is installed', () => {
    it("takes the folder's yes without asking Windows", async () => {
      mkdirSync(path.join(profile, 'Local', 'Packages', 'OpenHeaders_eh4g1zpqgsf2c'));

      const { facts, windowsAsked } = await read({ ask: { askWindows: true }, windowsSays: false });

      expect(facts.packageInstalled).toBe(true);
      expect(windowsAsked()).toBe(0);
    });

    it("takes the folder's no alone while no switch is about to begin", async () => {
      const { facts, windowsAsked } = await read({ windowsSays: true });

      expect(facts.packageInstalled).toBe(false);
      expect(windowsAsked()).toBe(0);
    });

    it.each([
      [true, true],
      [false, false],
      [null, null],
    ])('asks Windows too before a switch begins, and takes its answer (%s)', async (windowsSays, expected) => {
      const { facts, windowsAsked } = await read({ ask: { askWindows: true }, windowsSays });

      expect(facts.packageInstalled).toBe(expected);
      expect(windowsAsked()).toBe(1);
    });

    it('has no answer where the folder listing cannot be read, and does not ask Windows', async () => {
      const { facts, windowsAsked } = await read({ ask: { askWindows: true }, packageFolder: null });

      expect(facts.packageInstalled).toBeNull();
      expect(windowsAsked()).toBe(0);
      expect(packageSwitchEligibility(facts)).toEqual({ eligible: false, blocker: 'package-installed' });
    });
  });

  describe('what the channel offers', () => {
    it('says a channel that has published no package', async () => {
      const { facts, warned } = await read({ status: 404 });

      expect(facts.offer).toEqual({ state: 'none' });
      expect(warned).toEqual([]);
    });

    it.each<[string, ReadOptions, string]>([
      ['the feed answers with an error', { status: 503 }, 'update feed returned 503'],
      ['the pointer cannot be read', { pointer: { version: 'soon' } }, 'unreadable package pointer'],
      ['the feed cannot be reached', { offline: true }, 'ENOTFOUND'],
    ])('says a feed it could not read when %s, with why in the log', async (_name, options, why) => {
      const { facts, warned } = await read(options);

      expect(facts.offer).toEqual({ state: 'unread' });
      expect(warned).toHaveLength(1);
      expect(warned[0]).toContain('beta');
      expect(warned[0]).toContain(why);
      expect(packageSwitchEligibility(facts)).toEqual({ eligible: false, blocker: 'feed-unread' });
    });

    it('says a release that is held back', async () => {
      const { facts } = await read({ pointer: makePointer({ stop: true }) });

      expect(facts.offer).toEqual({ state: 'read', version: APP_VERSION, stop: true, forThisArch: true });
    });

    it('says a pointer that names no package of this arch', async () => {
      const { facts } = await read({ pointer: makePointer({ packages: { arm64: { url: ARM64_URL } } }) });

      expect(facts.offer).toEqual({ state: 'read', version: APP_VERSION, stop: false, forThisArch: false });
    });

    it("asks for the PC's own arch where an x64 tree runs on an ARM PC", async () => {
      const install = { arch: 'x64', underArm64Translation: true };

      const armOnly = await read({ install, pointer: makePointer({ packages: { arm64: { url: ARM64_URL } } }) });
      const x64Only = await read({ install, pointer: makePointer({ packages: { x64: { url: X64_URL } } }) });

      expect(armOnly.facts.offer).toMatchObject({ forThisArch: true });
      expect(x64Only.facts.offer).toMatchObject({ forThisArch: false });
      expect(armOnly.facts.hasInstaller).toBe(true);
    });
  });
});
