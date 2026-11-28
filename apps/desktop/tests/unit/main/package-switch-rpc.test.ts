/**
 * The desktop's main-process `oh.desktop.packageSwitch.*` plane — the two
 * channels a classic Windows install answers to switch to the Windows
 * package. What is read, how it is judged and how the installer is
 * started are pinned where they live; here, who gains the channels, what
 * the plane reads at the page's opening and at the click, and the one
 * state it keeps and tells.
 */

import * as path from 'node:path';
import type { PackageSwitchBlocker, PackageSwitchState } from '@openheaders/core/bridge';
import { describe, expect, it, vi } from 'vitest';
import type { InstallKind } from '@/main/bootstrap/install-kind';
import type { PackageSwitchFacts } from '@/main/bootstrap/package-switch-eligibility';
import type { PackageSwitchEnd, PackageSwitchStart, startPackageSwitch } from '@/main/package-switch';
import {
  carriedInstallerFileName,
  type PackageSwitchInstall,
  type readPackageSwitchFacts,
} from '@/main/package-switch-facts';
import { createPackageSwitchRpc, type PackageSwitchRpcOptions } from '@/main/package-switch-rpc';

const APP_VERSION = '2026.11.3-beta.11';
const OFFERED_VERSION = '2026.11.3-beta.12';
const HOME = 'C:\\Users\\John Doe';
const CLASSIC_DIR = `${HOME}\\AppData\\Roaming\\OpenHeaders`;
const PACKAGE_DIR = `${HOME}\\AppData\\Local\\OpenHeaders-Data`;
const RESOURCES = `${HOME}\\AppData\\Local\\Programs\\open-headers\\resources`;
const EXECUTABLE = `${HOME}\\AppData\\Local\\Programs\\open-headers\\OpenHeaders.exe`;
const TEMP = `${HOME}\\AppData\\Local\\Temp`;

const GET_STATE = 'oh.desktop.packageSwitch.getState';
const START = 'oh.desktop.packageSwitch.start';
const WORKING: PackageSwitchState = { phase: 'working' };

function makeInstall(overrides: Partial<PackageSwitchInstall> = {}): PackageSwitchInstall {
  return {
    installKind: 'nsis',
    osRelease: '10.0.26200',
    resourcesPath: RESOURCES,
    arch: 'arm64',
    underArm64Translation: false,
    dataDir: CLASSIC_DIR,
    isPackaged: true,
    appDataDir: `${HOME}\\AppData\\Roaming`,
    localAppDataDir: `${HOME}\\AppData\\Local`,
    homeDir: HOME,
    appVersion: APP_VERSION,
    ...overrides,
  };
}

/** What a classic install that may switch reads. */
function makeFacts(overrides: Partial<PackageSwitchFacts> = {}): PackageSwitchFacts {
  return {
    installKind: 'nsis',
    windowsBuild: 26200,
    hasInstaller: true,
    dataDir: CLASSIC_DIR,
    classicDir: CLASSIC_DIR,
    classicDirIsPlain: true,
    packageDir: PACKAGE_DIR,
    packageDirIsAbsent: true,
    packageInstalled: false,
    appVersion: APP_VERSION,
    offer: { state: 'read', version: OFFERED_VERSION, stop: false, forThisArch: true },
    ...overrides,
  };
}

function idle(overrides: Partial<Extract<PackageSwitchState, { phase: 'idle' }>> = {}): PackageSwitchState {
  return {
    phase: 'idle',
    verdict: { eligible: true, version: OFFERED_VERSION },
    channel: 'beta',
    offeredVersion: OFFERED_VERSION,
    packageDataDir: PACKAGE_DIR,
    lastStop: null,
    ...overrides,
  };
}

/** An installer that was started, and ends when the test says how. */
function startedInstaller(): { start: PackageSwitchStart; end: (end: PackageSwitchEnd) => void } {
  let end: (end: PackageSwitchEnd) => void = () => {};
  const ended = new Promise<PackageSwitchEnd>((resolve) => {
    end = resolve;
  });
  return { start: { started: true, ended }, end };
}

function makePlane(overrides: Partial<PackageSwitchRpcOptions> = {}) {
  let facts = makeFacts();
  const readFacts = vi.fn<typeof readPackageSwitchFacts>(async () => facts);
  const installer = startedInstaller();
  const start = vi.fn<typeof startPackageSwitch>(async () => installer.start);
  const quit = vi.fn();
  const broadcast = vi.fn<(state: PackageSwitchState) => void>();
  const plane = createPackageSwitchRpc({
    install: makeInstall(),
    tempDir: TEMP,
    executablePath: EXECUTABLE,
    pid: 4242,
    getChannel: () => 'beta',
    fetch: vi.fn(),
    broadcast,
    log: { info: vi.fn(), warn: vi.fn() },
    seams: { readFacts, start, quit },
    ...overrides,
  });
  return {
    plane,
    readFacts,
    start,
    quit,
    broadcast,
    installer,
    setFacts: (next: Partial<PackageSwitchFacts>) => {
      facts = makeFacts(next);
    },
  };
}

/** Lets a settled `ended` reach the plane, and the plane read this PC again. */
async function settled(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

describe('desktop packageSwitch rpc', () => {
  it('answers only its own channels', () => {
    const { plane, readFacts } = makePlane();
    expect(plane.dispatch('oh.desktop.localData.remove')).toBeUndefined();
    expect(plane.dispatch('oh.updates.getState')).toBeUndefined();
    expect(readFacts).not.toHaveBeenCalled();
  });

  it.each<[string, InstallKind | null]>([
    ['a Windows package', 'msix'],
    ['an MSI install', 'msi'],
    ['a dev run', 'dev'],
    ['another platform', null],
  ])('answers nothing in %s: no other install gains a channel', (_case, installKind) => {
    const { plane, readFacts, start } = makePlane({ install: makeInstall({ installKind }) });
    expect(plane.dispatch(GET_STATE)).toBeUndefined();
    expect(plane.dispatch(START)).toBeUndefined();
    expect(readFacts).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  describe("the page's opening", () => {
    it('reads the chosen channel with the package folder alone, and says a switch may begin', async () => {
      const { plane, readFacts, start, broadcast } = makePlane();
      expect(await plane.dispatch(GET_STATE)).toEqual(idle());
      expect(readFacts).toHaveBeenCalledOnce();
      expect(readFacts.mock.calls[0]?.[0]).toEqual(makeInstall());
      expect(readFacts.mock.calls[0]?.[1]).toEqual({ channel: 'beta', askWindows: false });
      expect(start).not.toHaveBeenCalled();
      expect(broadcast).not.toHaveBeenCalled();
    });

    it('follows the channel as it is chosen at each ask', async () => {
      let channel: 'stable' | 'beta' = 'beta';
      const { plane, readFacts } = makePlane({ getChannel: () => channel });
      await plane.dispatch(GET_STATE);
      channel = 'stable';
      expect(await plane.dispatch(GET_STATE)).toEqual(idle({ channel: 'stable' }));
      expect(readFacts.mock.calls[1]?.[1]).toEqual({ channel: 'stable', askWindows: false });
    });

    it.each<[PackageSwitchBlocker, Partial<PackageSwitchFacts>, string | null]>([
      ['windows-too-old', { windowsBuild: 19040 }, OFFERED_VERSION],
      ['no-installer', { hasInstaller: false }, OFFERED_VERSION],
      ['data-folder-elsewhere', { dataDir: 'D:\\profiles\\john-doe' }, OFFERED_VERSION],
      ['data-folder-not-plain', { classicDirIsPlain: false }, OFFERED_VERSION],
      ['data-on-another-volume', { packageDir: 'D:\\Local\\OpenHeaders-Data' }, OFFERED_VERSION],
      ['package-installed', { packageInstalled: true }, OFFERED_VERSION],
      ['package-data-left', { packageDirIsAbsent: false }, OFFERED_VERSION],
      ['feed-unread', { offer: { state: 'unread' } }, null],
      ['no-package-offered', { offer: { state: 'none' } }, null],
      [
        'held-back',
        { offer: { state: 'read', version: OFFERED_VERSION, stop: true, forThisArch: true } },
        OFFERED_VERSION,
      ],
      [
        'package-older',
        { offer: { state: 'read', version: '2026.11.3-beta.10', stop: false, forThisArch: true } },
        '2026.11.3-beta.10',
      ],
    ])('says %s, with what its sentence names', async (blocker, facts, offeredVersion) => {
      const { plane, setFacts } = makePlane();
      setFacts(facts);
      expect(await plane.dispatch(GET_STATE)).toEqual(
        idle({
          verdict: { eligible: false, blocker },
          offeredVersion,
          packageDataDir: facts.packageDir ?? PACKAGE_DIR,
        }),
      );
    });
  });

  describe('the click', () => {
    it('reads again with Windows asked, starts the installer this tree carries, and says it is at work', async () => {
      const { plane, readFacts, start, broadcast } = makePlane();
      expect(await plane.dispatch(START)).toEqual(WORKING);
      expect(readFacts.mock.calls[0]?.[1]).toEqual({ channel: 'beta', askWindows: true });
      expect(start).toHaveBeenCalledOnce();
      expect(start.mock.calls[0]?.[0]).toEqual({
        installer: path.join(RESOURCES, 'installer', carriedInstallerFileName('arm64')),
        copyRoot: path.join(TEMP, 'OpenHeaders-Switch'),
        app: EXECUTABLE,
        appPid: 4242,
        uninstaller: path.join(path.dirname(EXECUTABLE), 'Uninstall OpenHeaders.exe'),
        note: path.join(CLASSIC_DIR, 'move-to-package.json'),
        channel: 'beta',
      });
      expect(broadcast.mock.calls).toEqual([[WORKING]]);
    });

    it('hands the installer the quit through the lifecycle', async () => {
      const { plane, start, quit } = makePlane();
      await plane.dispatch(START);
      start.mock.calls[0]?.[1].quit();
      expect(quit).toHaveBeenCalledOnce();
    });

    it('never trusts the page: a switch that may not begin at the click is not started', async () => {
      const { plane, start, broadcast, setFacts } = makePlane();
      setFacts({ packageInstalled: true });
      expect(await plane.dispatch(START)).toEqual(idle({ verdict: { eligible: false, blocker: 'package-installed' } }));
      expect(start).not.toHaveBeenCalled();
      expect(broadcast).not.toHaveBeenCalled();

      setFacts({});
      expect(await plane.dispatch(START)).toEqual(WORKING);
      expect(start).toHaveBeenCalledOnce();
    });

    it('starts one switch at a time', async () => {
      const { plane, readFacts, start } = makePlane();
      const [first, second] = await Promise.all([plane.dispatch(START), plane.dispatch(START)]);
      expect(first).toEqual(WORKING);
      expect(second).toEqual(WORKING);
      expect(await plane.dispatch(START)).toEqual(WORKING);
      expect(start).toHaveBeenCalledOnce();

      expect(await plane.dispatch(GET_STATE)).toEqual(WORKING);
      expect(readFacts).toHaveBeenCalledOnce();
    });

    it("answers a page's read that was under way when the switch began with the switch", async () => {
      let release: (facts: PackageSwitchFacts) => void = () => {};
      const { plane, readFacts } = makePlane();
      readFacts.mockImplementationOnce(
        () =>
          new Promise<PackageSwitchFacts>((resolve) => {
            release = resolve;
          }),
      );
      const opening = plane.dispatch(GET_STATE);
      expect(await plane.dispatch(START)).toEqual(WORKING);
      release(makeFacts());
      expect(await opening).toEqual(WORKING);
    });

    it('says a start Windows refused as a switch that stopped, and may start again', async () => {
      const { plane, start, broadcast } = makePlane();
      start.mockResolvedValueOnce({ started: false, reason: 'EPERM' });
      expect(await plane.dispatch(START)).toEqual(idle({ lastStop: { code: null } }));
      expect(broadcast).not.toHaveBeenCalled();

      expect(await plane.dispatch(START)).toEqual(WORKING);
      expect(start).toHaveBeenCalledTimes(2);
    });

    it('is ready for another click when this PC could not be read', async () => {
      const { plane, readFacts, start } = makePlane();
      readFacts.mockRejectedValueOnce(new Error('EIO'));
      await expect(plane.dispatch(START)).rejects.toThrow('EIO');
      expect(await plane.dispatch(START)).toEqual(WORKING);
      expect(start).toHaveBeenCalledOnce();
    });
  });

  describe('the end of a switch', () => {
    it.each<[string, number | null]>([
      ['the download did not finish', 21],
      ['the app stayed open', 33],
      ['the person cancelled', 40],
      ['the installer ended without a word', null],
    ])('tells every window when %s, with the verdict as it is then', async (_case, code) => {
      const { plane, readFacts, broadcast, installer } = makePlane();
      await plane.dispatch(START);
      installer.end({ outcome: 'stopped', code });
      await settled();

      expect(broadcast.mock.calls).toEqual([[WORKING], [idle({ lastStop: { code } })]]);
      expect(readFacts.mock.calls[1]?.[1]).toEqual({ channel: 'beta', askWindows: false });
      expect(await plane.dispatch(GET_STATE)).toEqual(idle({ lastStop: { code } }));
    });

    it('says the package that is there already as the reason the read gives', async () => {
      const { plane, broadcast, installer, setFacts } = makePlane();
      await plane.dispatch(START);
      setFacts({ packageInstalled: true });
      installer.end({ outcome: 'stopped', code: 35 });
      await settled();

      expect(broadcast.mock.calls[1]).toEqual([
        idle({ verdict: { eligible: false, blocker: 'package-installed' }, lastStop: { code: 35 } }),
      ]);
    });

    it('starts again after a stop, and the new switch carries no earlier stop', async () => {
      const { plane, start, installer } = makePlane();
      await plane.dispatch(START);
      installer.end({ outcome: 'stopped', code: 21 });
      await settled();

      const again = startedInstaller();
      start.mockResolvedValueOnce(again.start);
      expect(await plane.dispatch(START)).toEqual(WORKING);
      again.end({ outcome: 'stopped', code: 40 });
      await settled();
      expect(await plane.dispatch(GET_STATE)).toEqual(idle({ lastStop: { code: 40 } }));
    });

    it('tells nothing more once the installer has the go: the app is quitting', async () => {
      const { plane, readFacts, broadcast, installer } = makePlane();
      await plane.dispatch(START);
      installer.end({ outcome: 'handed-over' });
      await settled();

      expect(broadcast.mock.calls).toEqual([[WORKING]]);
      expect(await plane.dispatch(GET_STATE)).toEqual(WORKING);
      expect(await plane.dispatch(START)).toEqual(WORKING);
      expect(readFacts).toHaveBeenCalledOnce();
    });
  });
});
