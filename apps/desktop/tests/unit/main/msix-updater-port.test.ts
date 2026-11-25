import { describe, expect, it } from 'vitest';
import { createMsixUpdaterPort, type PackageUpdater } from '../../../src/main/msix-updater-port';
import type { UpdateChannel } from '../../../src/main/update-feed';

type Listener = (...args: unknown[]) => void;

const X64_URL = 'https://updates.openheaders.com/dl/v2026.12.0-beta.2/OpenHeaders-2026.12.0-beta.2-x64.msix';
const ARM64_URL = 'https://updates.openheaders.com/dl/v2026.12.0-beta.2/OpenHeaders-2026.12.0-beta.2-arm64.msix';

function makePointer(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: '2026.12.0-beta.2',
    packageVersion: '2026.12.0.2',
    tag: 'v2026.12.0-beta.2',
    publisher: 'CN=John Doe SRL, O=John Doe SRL, L=Iasi, S=Iasi, C=RO',
    packages: {
      x64: { url: X64_URL, size: 255_619_482, sha256: 'a'.repeat(64) },
      arm64: { url: ARM64_URL, size: 252_125_182, sha256: 'b'.repeat(64) },
    },
    stop: false,
    ramp: 100,
    ...overrides,
  };
}

/** Electron's updater as the port sees it: what it was asked, and a way to answer as Windows would. */
function makeUpdater(behavior: { onCheck?: (emit: (event: string, ...args: unknown[]) => void) => void } = {}) {
  const listeners = new Map<string, Set<Listener>>();
  const calls: string[] = [];
  const emit = (event: string, ...args: unknown[]): void => {
    for (const listener of [...(listeners.get(event) ?? [])]) listener(...args);
  };
  const updater: PackageUpdater = {
    setFeedURL(options) {
      calls.push(`setFeedURL ${options.url}`);
    },
    async checkForUpdates() {
      calls.push('checkForUpdates');
      behavior.onCheck?.(emit);
    },
    async quitAndInstall() {
      calls.push('quitAndInstall');
    },
    on(event, listener) {
      const set = listeners.get(event) ?? new Set<Listener>();
      set.add(listener);
      listeners.set(event, set);
    },
    removeListener(event, listener) {
      listeners.get(event)?.delete(listener);
    },
  };
  return { updater, calls, emit, listenerCount: (event: string) => listeners.get(event)?.size ?? 0 };
}

interface PortOptions {
  pointer?: unknown;
  status?: number;
  channel?: UpdateChannel;
  arch?: string;
  currentVersion?: string;
  hasPackageIdentity?: boolean;
  updater?: ReturnType<typeof makeUpdater>;
}

function makePort(options: PortOptions = {}) {
  const urls: string[] = [];
  const fetchFn = (async (input: string | URL | Request) => {
    urls.push(String(input));
    const status = options.status ?? 200;
    return {
      ok: status === 200,
      status,
      json: async () => options.pointer ?? makePointer(),
    } as Response;
  }) as typeof fetch;
  const fake = options.updater ?? makeUpdater({ onCheck: (emit) => emit('update-downloaded') });
  const quits: Array<() => void> = [];
  const logged = { info: [] as string[], warn: [] as string[] };
  let exits = 0;
  const port = createMsixUpdaterPort({
    updater: fake.updater,
    fetch: fetchFn,
    hasPackageIdentity: () => options.hasPackageIdentity ?? true,
    arch: options.arch ?? 'x64',
    currentVersion: options.currentVersion ?? '2026.12.0-beta.1',
    getChannel: () => options.channel ?? 'beta',
    quitThen: (finish) => quits.push(finish),
    exit: () => {
      exits += 1;
    },
    log: { info: (msg) => logged.info.push(msg), warn: (msg) => logged.warn.push(msg) },
  });
  return { port, urls, fake, quits, logged, exits: () => exits };
}

describe('createMsixUpdaterPort', () => {
  describe('check', () => {
    it("offers the pointer's version when newer, from the channel's own pointer", async () => {
      const { port, urls, fake } = makePort();
      expect(await port.check()).toEqual({
        version: '2026.12.0-beta.2',
        releaseNotesUrl: 'https://github.com/OpenHeaders/open-headers/releases/tag/v2026.12.0-beta.2',
      });
      expect(urls).toEqual(['https://updates.openheaders.com/desktop/beta/windows-package.json']);
      // A check only looks: Electron's updater stages at once, so it is not called.
      expect(fake.calls).toEqual([]);
    });

    it('reads the stable pointer on the stable channel', async () => {
      const { port, urls } = makePort({ channel: 'stable' });
      await port.check();
      expect(urls).toEqual(['https://updates.openheaders.com/desktop/stable/windows-package.json']);
    });

    it('offers nothing when the channel has no pointer', async () => {
      const { port } = makePort({ status: 404 });
      expect(await port.check()).toBeNull();
    });

    it('throws on any other feed failure instead of reporting up to date', async () => {
      const { port } = makePort({ status: 503 });
      await expect(port.check()).rejects.toThrow('update feed returned 503');
    });

    it('offers nothing while the pointer is stopped', async () => {
      const { port } = makePort({ pointer: makePointer({ stop: true }) });
      expect(await port.check()).toBeNull();
    });

    it('offers nothing when already on the pointer version or newer', async () => {
      const { port } = makePort({ currentVersion: '2026.12.0-beta.2' });
      expect(await port.check()).toBeNull();
      const { port: ahead } = makePort({ currentVersion: '2026.12.0' });
      expect(await ahead.check()).toBeNull();
    });

    it('offers the plain release over a beta of the same base', async () => {
      const { port } = makePort({
        pointer: makePointer({ version: '2026.12.0' }),
        currentVersion: '2026.12.0-beta.2',
      });
      expect((await port.check())?.version).toBe('2026.12.0');
    });

    it('offers nothing, and says so, when the pointer names no package for this arch', async () => {
      const { port, logged } = makePort({
        pointer: makePointer({ packages: { x64: { url: X64_URL } } }),
        arch: 'arm64',
      });
      expect(await port.check()).toBeNull();
      expect(logged.warn).toEqual(['the package pointer offers 2026.12.0-beta.2 but names no arm64 package']);
    });

    it('reads a pointer that carries fields it does not know', async () => {
      const { port } = makePort({ pointer: makePointer({ minimumWindowsBuild: 19041, ramp: 25 }) });
      expect((await port.check())?.version).toBe('2026.12.0-beta.2');
    });

    it.each<[string, unknown]>([
      ['is not an object', []],
      ['has no version', makePointer({ version: undefined })],
      ['has a version that is not one', makePointer({ version: 'latest' })],
      ['has a stop that is not a yes or a no', makePointer({ stop: 'true' })],
      ['has no packages', makePointer({ packages: undefined })],
      ['has a link for this arch that is not a string', makePointer({ packages: { x64: { url: 42 } } })],
      [
        'has a link for this arch that is not https',
        makePointer({ packages: { x64: { url: 'http://updates.openheaders.com/a.msix' } } }),
      ],
    ])('throws on a pointer that %s', async (_case, pointer) => {
      const { port } = makePort({ pointer });
      await expect(port.check()).rejects.toThrow('unreadable package pointer');
    });
  });

  describe('download', () => {
    it("hands Windows this arch's link and settles when the package is staged", async () => {
      const { port, fake, logged } = makePort({ arch: 'arm64' });
      await port.check();
      await port.download(() => {});
      expect(fake.calls).toEqual([`setFeedURL ${ARM64_URL}`, 'checkForUpdates']);
      expect(logged.info).toEqual(['package 2026.12.0-beta.2 staged by Windows']);
      for (const event of ['update-downloaded', 'update-not-available', 'error']) {
        expect(fake.listenerCount(event)).toBe(0);
      }
    });

    it('never reports a percentage', async () => {
      const { port } = makePort();
      expect(port.reportsDownloadProgress).toBe(false);
      await port.check();
      const percents: number[] = [];
      await port.download((percent) => percents.push(percent));
      expect(percents).toEqual([]);
    });

    it('rejects with the error Windows gave', async () => {
      const updater = makeUpdater({ onCheck: (emit) => emit('error', new Error('0x80073CF3'), '0x80073CF3') });
      const { port, fake } = makePort({ updater });
      await port.check();
      await expect(port.download(() => {})).rejects.toThrow('0x80073CF3');
      expect(fake.listenerCount('error')).toBe(0);
    });

    it('rejects when the updater finds nothing at the link', async () => {
      const updater = makeUpdater({ onCheck: (emit) => emit('update-not-available') });
      const { port } = makePort({ updater });
      await port.check();
      await expect(port.download(() => {})).rejects.toThrow('no package at the offered link');
    });

    it('rejects when the updater call itself fails', async () => {
      const updater = makeUpdater();
      updater.updater.checkForUpdates = () => Promise.reject(new Error('the updater is gone'));
      const { port } = makePort({ updater });
      await port.check();
      await expect(port.download(() => {})).rejects.toThrow('the updater is gone');
    });

    it('refuses in a process without the package identity, before the updater is touched', async () => {
      const { port, fake } = makePort({ hasPackageIdentity: false });
      await port.check();
      await expect(port.download(() => {})).rejects.toThrow('does not carry the package identity');
      expect(fake.calls).toEqual([]);
    });

    it('refuses without an offer', async () => {
      const { port, fake } = makePort();
      await expect(port.download(() => {})).rejects.toThrow('no package update is on offer');
      expect(fake.calls).toEqual([]);
    });

    it('forgets an offer the next check no longer makes', async () => {
      let pointer = makePointer();
      const urls: string[] = [];
      const fake = makeUpdater({ onCheck: (emit) => emit('update-downloaded') });
      const port = createMsixUpdaterPort({
        updater: fake.updater,
        fetch: (async (input: string | URL | Request) => {
          urls.push(String(input));
          return { ok: true, status: 200, json: async () => pointer } as Response;
        }) as typeof fetch,
        hasPackageIdentity: () => true,
        arch: 'x64',
        currentVersion: '2026.12.0-beta.1',
        getChannel: () => 'beta',
        quitThen: () => {},
        exit: () => {},
        log: { info: () => {}, warn: () => {} },
      });
      expect(await port.check()).not.toBeNull();
      pointer = makePointer({ stop: true });
      expect(await port.check()).toBeNull();
      await expect(port.download(() => {})).rejects.toThrow('no package update is on offer');
    });
  });

  describe('quitAndInstall', () => {
    it("quits through the app's own teardown, with the updater's call as the last act", async () => {
      const { port, fake, quits, exits } = makePort();
      await port.check();
      await port.download(() => {});
      port.quitAndInstall();
      expect(fake.calls).not.toContain('quitAndInstall');
      expect(quits).toHaveLength(1);
      quits[0]?.();
      expect(fake.calls.at(-1)).toBe('quitAndInstall');
      // Windows closes the process; the port does not end it itself.
      expect(exits()).toBe(0);
    });

    it('ends the process when Windows does not take the install', async () => {
      const { port, fake, quits, exits, logged } = makePort();
      port.quitAndInstall();
      quits[0]?.();
      fake.emit('error', new Error('MSIX updates are not supported'));
      expect(exits()).toBe(1);
      expect(logged.warn).toEqual(['Windows did not take the package install']);
    });
  });

  describe('setInstallOnQuit', () => {
    it('has nothing to gate, and says a stage cannot be withdrawn when asked to block one', () => {
      const { port, fake, logged } = makePort();
      port.setInstallOnQuit(true);
      expect(logged.warn).toEqual([]);
      port.setInstallOnQuit(false);
      expect(logged.warn).toEqual(['a staged package cannot be withdrawn — it applies at the next start']);
      expect(fake.calls).toEqual([]);
    });
  });
});
