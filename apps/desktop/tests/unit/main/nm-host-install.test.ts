/**
 * NM bootstrap host install — binary path derivation (packaged
 * extraResource vs monorepo sibling, platform-suffixed name), the
 * manifest document shape, and the auto-register/repair discipline on
 * both mechanisms over in-memory seams: macOS NativeMessagingHosts
 * dirs and Windows HKCU registry keys — register on first boot, repair
 * drift, leave a settled target untouched, and skip browsers that
 * aren't installed.
 */

import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildNmManifest,
  CHROME_EXTENSION_ID,
  EDGE_EXTENSION_ID,
  macosNmManifestTargets,
  NM_HOST_NAME,
  type NmManifestFs,
  nmHostBinaryCandidate,
  parseRegQueryDefaultValue,
  type RegistryRunner,
  registerNmManifests,
  registerWindowsNmManifests,
  windowsNmManifestTargets,
} from '../../../src/main/nm-host-install';

const HOST_PATH = '/Applications/OpenHeaders.app/Contents/Resources/nm-host/oh-nm-host';

describe('nmHostBinaryCandidate', () => {
  it('resolves the packaged extraResource binary', () => {
    const candidate = nmHostBinaryCandidate({
      isPackaged: true,
      resourcesPath: '/Applications/OpenHeaders.app/Contents/Resources',
      appPath: '/Applications/OpenHeaders.app/Contents/Resources/app.asar',
      platform: 'darwin',
    });
    expect(candidate).toBe(path.join('/Applications/OpenHeaders.app/Contents/Resources', 'nm-host', 'oh-nm-host'));
  });

  it('resolves the monorepo sibling pack output in dev', () => {
    const candidate = nmHostBinaryCandidate({
      isPackaged: false,
      resourcesPath: '/somewhere/electron/resources',
      appPath: '/repo/apps/desktop',
      platform: 'darwin',
    });
    expect(candidate).toBe(path.resolve('/repo/apps/nm-host/dist-bun/oh-nm-host'));
  });

  it('appends the .exe suffix on win32', () => {
    const candidate = nmHostBinaryCandidate({
      isPackaged: true,
      resourcesPath: 'C:\\Program Files\\OpenHeaders\\resources',
      appPath: 'C:\\Program Files\\OpenHeaders\\resources\\app.asar',
      platform: 'win32',
    });
    expect(candidate).toBe(path.join('C:\\Program Files\\OpenHeaders\\resources', 'nm-host', 'oh-nm-host.exe'));
  });
});

describe('buildNmManifest', () => {
  it('emits the stdio manifest with extension-scoped origins', () => {
    const manifest = JSON.parse(buildNmManifest(HOST_PATH, [CHROME_EXTENSION_ID])) as Record<string, unknown>;
    expect(manifest.name).toBe(NM_HOST_NAME);
    expect(manifest.type).toBe('stdio');
    expect(manifest.path).toBe(HOST_PATH);
    expect(manifest.allowed_origins).toEqual([`chrome-extension://${CHROME_EXTENSION_ID}/`]);
  });

  it('carries the union allowlist as one origin per id', () => {
    const manifest = JSON.parse(buildNmManifest(HOST_PATH, [CHROME_EXTENSION_ID, EDGE_EXTENSION_ID])) as Record<
      string,
      unknown
    >;
    expect(manifest.allowed_origins).toEqual([
      `chrome-extension://${CHROME_EXTENSION_ID}/`,
      `chrome-extension://${EDGE_EXTENSION_ID}/`,
    ]);
  });
});

describe('macosNmManifestTargets', () => {
  it('lists the Chromium family with per-browser NativeMessagingHosts dirs', () => {
    const appSupport = path.join('/Users/casey', 'Library', 'Application Support');
    expect(macosNmManifestTargets('/Users/casey')).toEqual([
      {
        browser: 'Google Chrome',
        browserRoot: path.join(appSupport, 'Google', 'Chrome'),
        manifestDir: path.join(appSupport, 'Google', 'Chrome', 'NativeMessagingHosts'),
      },
      {
        browser: 'Google Chrome Beta',
        browserRoot: path.join(appSupport, 'Google', 'Chrome Beta'),
        manifestDir: path.join(appSupport, 'Google', 'Chrome Beta', 'NativeMessagingHosts'),
      },
      {
        browser: 'Microsoft Edge',
        browserRoot: path.join(appSupport, 'Microsoft Edge'),
        manifestDir: path.join(appSupport, 'Microsoft Edge', 'NativeMessagingHosts'),
      },
      {
        browser: 'Brave Browser',
        browserRoot: path.join(appSupport, 'BraveSoftware', 'Brave-Browser'),
        manifestDir: path.join(appSupport, 'BraveSoftware', 'Brave-Browser', 'NativeMessagingHosts'),
      },
    ]);
  });
});

interface FakeFs extends NmManifestFs {
  files: Map<string, string>;
  dirs: Set<string>;
  writes: string[];
}

function fakeFs(seed: { files?: Record<string, string>; dirs?: string[] } = {}): FakeFs {
  const files = new Map(Object.entries(seed.files ?? {}));
  const dirs = new Set(seed.dirs ?? []);
  const writes: string[] = [];
  return {
    files,
    dirs,
    writes,
    existsSync: (target) => files.has(target) || dirs.has(target),
    readFileSync: (target) => {
      const content = files.get(target);
      if (content === undefined) throw new Error(`ENOENT: ${target}`);
      return content;
    },
    writeFileSync: (target, content) => {
      files.set(target, content);
      writes.push(target);
    },
    mkdirSync: (target) => {
      dirs.add(target);
    },
  };
}

describe('registerNmManifests', () => {
  const allTargets = macosNmManifestTargets('/Users/casey');
  const targets = [allTargets[0]];
  const chromeRoot = targets[0].browserRoot;
  const manifestPath = path.join(targets[0].manifestDir, `${NM_HOST_NAME}.json`);
  const expected = buildNmManifest(HOST_PATH, [CHROME_EXTENSION_ID]);

  function register(fileSystem: NmManifestFs) {
    return registerNmManifests({
      hostBinaryPath: HOST_PATH,
      targets,
      allowedExtensionIds: [CHROME_EXTENSION_ID],
      fileSystem,
    });
  }

  it('registers a fresh manifest for an installed browser', () => {
    const fs = fakeFs({ dirs: [chromeRoot] });
    expect(register(fs)).toEqual([{ browser: 'Google Chrome', manifestPath, action: 'registered' }]);
    expect(fs.files.get(manifestPath)).toBe(expected);
    expect(fs.dirs.has(targets[0].manifestDir)).toBe(true);
  });

  it('repairs a drifted manifest (moved binary, stale allowlist)', () => {
    const fs = fakeFs({
      dirs: [chromeRoot, targets[0].manifestDir],
      files: { [manifestPath]: buildNmManifest('/old/location/oh-nm-host', [CHROME_EXTENSION_ID]) },
    });
    expect(register(fs)).toEqual([{ browser: 'Google Chrome', manifestPath, action: 'repaired' }]);
    expect(fs.files.get(manifestPath)).toBe(expected);
  });

  it('leaves an identical manifest untouched', () => {
    const fs = fakeFs({ dirs: [chromeRoot, targets[0].manifestDir], files: { [manifestPath]: expected } });
    expect(register(fs)).toEqual([{ browser: 'Google Chrome', manifestPath, action: 'unchanged' }]);
    expect(fs.writes).toEqual([]);
  });

  it('skips a browser that is not installed without creating litter', () => {
    const fs = fakeFs();
    expect(register(fs)).toEqual([{ browser: 'Google Chrome', manifestPath, action: 'skipped' }]);
    expect(fs.writes).toEqual([]);
    expect(fs.dirs.size).toBe(0);
  });

  it('answers skipped instead of throwing on an unwritable profile', () => {
    const fs = fakeFs({ dirs: [chromeRoot] });
    fs.mkdirSync = () => {
      throw new Error('EACCES');
    };
    expect(register(fs)).toEqual([{ browser: 'Google Chrome', manifestPath, action: 'skipped' }]);
  });

  it('handles each Chromium target independently on a mixed-install machine', () => {
    const edge = allTargets[2];
    const brave = allTargets[3];
    const unionContent = buildNmManifest(HOST_PATH, [CHROME_EXTENSION_ID, EDGE_EXTENSION_ID]);
    const braveManifestPath = path.join(brave.manifestDir, `${NM_HOST_NAME}.json`);
    const fs = fakeFs({
      dirs: [edge.browserRoot, brave.browserRoot, brave.manifestDir],
      files: { [braveManifestPath]: unionContent },
    });
    const results = registerNmManifests({
      hostBinaryPath: HOST_PATH,
      targets: allTargets,
      allowedExtensionIds: [CHROME_EXTENSION_ID, EDGE_EXTENSION_ID],
      fileSystem: fs,
    });
    expect(results.map((r) => `${r.browser}:${r.action}`)).toEqual([
      'Google Chrome:skipped',
      'Google Chrome Beta:skipped',
      'Microsoft Edge:registered',
      'Brave Browser:unchanged',
    ]);
    expect(fs.files.get(path.join(edge.manifestDir, `${NM_HOST_NAME}.json`))).toBe(unionContent);
  });
});

describe('windowsNmManifestTargets', () => {
  it('lists per-vendor registry keys with channel-aware presence roots', () => {
    const localAppData = path.join('C:', 'Users', 'casey', 'AppData', 'Local');
    expect(windowsNmManifestTargets(localAppData)).toEqual([
      {
        browser: 'Google Chrome',
        presenceRoots: [
          path.join(localAppData, 'Google', 'Chrome', 'User Data'),
          path.join(localAppData, 'Google', 'Chrome Beta', 'User Data'),
        ],
        registryKey: `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${NM_HOST_NAME}`,
      },
      {
        browser: 'Microsoft Edge',
        presenceRoots: [path.join(localAppData, 'Microsoft', 'Edge', 'User Data')],
        registryKey: `HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\${NM_HOST_NAME}`,
      },
      {
        browser: 'Brave Browser',
        presenceRoots: [path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data')],
        registryKey: `HKCU\\Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts\\${NM_HOST_NAME}`,
      },
    ]);
  });
});

describe('parseRegQueryDefaultValue', () => {
  it('extracts the default REG_SZ value from reg query output', () => {
    const output = [
      '',
      `HKEY_CURRENT_USER\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\${NM_HOST_NAME}`,
      '    (Default)    REG_SZ    C:\\Users\\casey\\AppData\\Roaming\\OpenHeaders\\nm-host\\manifest.json',
      '',
    ].join('\r\n');
    expect(parseRegQueryDefaultValue(output)).toBe(
      'C:\\Users\\casey\\AppData\\Roaming\\OpenHeaders\\nm-host\\manifest.json',
    );
  });

  it('answers null when no default value row exists', () => {
    expect(parseRegQueryDefaultValue('')).toBeNull();
    expect(parseRegQueryDefaultValue('ERROR: The system was unable to find the specified registry key.')).toBeNull();
  });
});

interface FakeRegistry {
  values: Map<string, string>;
  adds: string[][];
  run: RegistryRunner;
}

function fakeRegistry(seed: Record<string, string> = {}): FakeRegistry {
  const values = new Map(Object.entries(seed));
  const adds: string[][] = [];
  const run: RegistryRunner = async (args) => {
    if (args[0] === 'query') {
      const value = values.get(args[1]);
      if (value === undefined) return { stdout: '', code: 1 };
      return { stdout: `\r\n${args[1]}\r\n    (Default)    REG_SZ    ${value}\r\n`, code: 0 };
    }
    if (args[0] === 'add') {
      adds.push([...args]);
      values.set(args[1], args[6]);
      return { stdout: 'The operation completed successfully.', code: 0 };
    }
    return { stdout: '', code: 1 };
  };
  return { values, adds, run };
}

describe('registerWindowsNmManifests', () => {
  const WIN_HOST = 'C:\\Program Files\\OpenHeaders\\resources\\nm-host\\oh-nm-host.exe';
  const localAppData = path.join('C:', 'Users', 'casey', 'AppData', 'Local');
  const manifestDir = path.join('C:', 'Users', 'casey', 'AppData', 'Roaming', 'OpenHeaders', 'nm-host');
  const manifestPath = path.join(manifestDir, `${NM_HOST_NAME}.json`);
  const targets = windowsNmManifestTargets(localAppData);
  const edge = targets[1];
  const expected = buildNmManifest(WIN_HOST, [CHROME_EXTENSION_ID, EDGE_EXTENSION_ID]);

  function register(fileSystem: NmManifestFs, runRegistry: RegistryRunner, only = [edge]) {
    return registerWindowsNmManifests({
      hostBinaryPath: WIN_HOST,
      manifestDir,
      targets: only,
      allowedExtensionIds: [CHROME_EXTENSION_ID, EDGE_EXTENSION_ID],
      fileSystem,
      runRegistry,
    });
  }

  it('writes the shared manifest and registers a fresh key for an installed browser', async () => {
    const fs = fakeFs({ dirs: [edge.presenceRoots[0]] });
    const reg = fakeRegistry();
    expect(await register(fs, reg.run)).toEqual([
      { browser: 'Microsoft Edge', registryKey: edge.registryKey, action: 'registered' },
    ]);
    expect(fs.files.get(manifestPath)).toBe(expected);
    expect(reg.values.get(edge.registryKey)).toBe(manifestPath);
    expect(reg.adds).toEqual([['add', edge.registryKey, '/ve', '/t', 'REG_SZ', '/d', manifestPath, '/f']]);
  });

  it('repairs a key pointing somewhere else', async () => {
    const fs = fakeFs({ dirs: [edge.presenceRoots[0], manifestDir], files: { [manifestPath]: expected } });
    const reg = fakeRegistry({ [edge.registryKey]: 'C:\\old\\manifest.json' });
    expect(await register(fs, reg.run)).toEqual([
      { browser: 'Microsoft Edge', registryKey: edge.registryKey, action: 'repaired' },
    ]);
    expect(reg.values.get(edge.registryKey)).toBe(manifestPath);
  });

  it('marks a settled key repaired when the manifest content itself drifted', async () => {
    const stale = buildNmManifest('C:\\old\\oh-nm-host.exe', [CHROME_EXTENSION_ID]);
    const fs = fakeFs({ dirs: [edge.presenceRoots[0], manifestDir], files: { [manifestPath]: stale } });
    const reg = fakeRegistry({ [edge.registryKey]: manifestPath });
    expect(await register(fs, reg.run)).toEqual([
      { browser: 'Microsoft Edge', registryKey: edge.registryKey, action: 'repaired' },
    ]);
    expect(fs.files.get(manifestPath)).toBe(expected);
    expect(reg.adds).toEqual([]);
  });

  it('leaves a settled key and manifest untouched, comparing paths case-insensitively', async () => {
    const fs = fakeFs({ dirs: [edge.presenceRoots[0], manifestDir], files: { [manifestPath]: expected } });
    const reg = fakeRegistry({ [edge.registryKey]: manifestPath.toUpperCase() });
    expect(await register(fs, reg.run)).toEqual([
      { browser: 'Microsoft Edge', registryKey: edge.registryKey, action: 'unchanged' },
    ]);
    expect(fs.writes).toEqual([]);
    expect(reg.adds).toEqual([]);
  });

  it('skips browsers that are not installed without touching disk or registry', async () => {
    const fs = fakeFs();
    const reg = fakeRegistry();
    expect((await register(fs, reg.run, [...targets])).map((r) => `${r.browser}:${r.action}`)).toEqual([
      'Google Chrome:skipped',
      'Microsoft Edge:skipped',
      'Brave Browser:skipped',
    ]);
    expect(fs.writes).toEqual([]);
    expect(reg.adds).toEqual([]);
  });

  it('recognizes any channel profile root as vendor presence', async () => {
    const chrome = targets[0];
    const fs = fakeFs({ dirs: [chrome.presenceRoots[1]] });
    const reg = fakeRegistry();
    expect(await register(fs, reg.run, [chrome])).toEqual([
      { browser: 'Google Chrome', registryKey: chrome.registryKey, action: 'registered' },
    ]);
  });

  it('answers skipped instead of throwing when reg add fails', async () => {
    const fs = fakeFs({ dirs: [edge.presenceRoots[0]] });
    const reg = fakeRegistry();
    const failingRun: RegistryRunner = async (args) =>
      args[0] === 'add' ? { stdout: 'ERROR: Access is denied.', code: 1 } : reg.run(args);
    expect(await register(fs, failingRun)).toEqual([
      { browser: 'Microsoft Edge', registryKey: edge.registryKey, action: 'skipped' },
    ]);
  });
});
