/**
 * Behavior of `scripts/build/update-config.js` — the update config a
 * Windows pack gets when the builder writes none, and the release leg's
 * check that the packed app and its installer name one cache folder.
 * The generation runs inside the real builder, on this app's own build
 * config, with packing itself replaced: only the config step runs. Run
 * as child processes, like the other release script suites.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const APP_DIR = path.resolve(__dirname, '../../..');
const SCRIPT = path.join(APP_DIR, 'scripts/build/update-config.js');
const ARM64_CONFIG = 'scripts/build/win-arm64-config.js';
const UNSIGNED = { win: { verifyUpdateCodeSignature: false } };

// The folder every installed copy already keeps its installer in. A
// build that names another one strands that copy: the next update is a
// full download.
const CACHE_DIR = 'open-headers-updater';

const BUILDER_TIMEOUT = 60_000;

/** The builder's logger, as far as this suite drives it. */
interface DebugLogger {
  (values: Record<string, unknown>): void;
  useColors: boolean;
  log: (text: string) => void;
}
interface DebugFactory {
  (namespace: string): DebugLogger;
  enable(namespaces: string): void;
  disable(): string;
}

/**
 * Runs the builder on the app's config for a Windows `dir` pack, with
 * the pack replaced by the one call the pack hook makes.
 */
const GENERATE = `
const [script, appOutDir, archName, config] = process.argv.slice(1);
const { Arch, Packager, Platform, WinPackager } = require('electron-builder');
const { writeUpdateConfig } = require(script);
class ConfigOnly extends WinPackager {
  async pack(outDir, arch) {
    const written = await writeUpdateConfig({ packager: this, appOutDir, arch });
    console.log('written=' + JSON.stringify(written));
  }
}
new Packager({
  projectDir: process.cwd(),
  targets: Platform.WINDOWS.createTarget('dir', Arch[archName]),
  config: JSON.parse(config),
  platformPackagerFactory: (info) => new ConfigOnly(info),
}).build().catch((error) => { console.error(error.message); process.exit(1); });
`;

let workDir: string | null = null;

/** A fresh unpacked tree: an empty `resources` folder, plus `files` inside it. */
function makeTree(files: Record<string, string> = {}): string {
  workDir = mkdtempSync(path.join(tmpdir(), 'oh-update-config-'));
  mkdirSync(path.join(workDir, 'resources'));
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(workDir, 'resources', name), text);
  return workDir;
}

function generate(tree: string, arch: 'x64' | 'arm64', config: object | string | null = null) {
  const result = spawnSync(process.execPath, ['-e', GENERATE, SCRIPT, tree, arch, JSON.stringify(config)], {
    encoding: 'utf8',
    cwd: APP_DIR,
  });
  const line = result.stdout.split(/\r?\n/).find((entry) => entry.startsWith('written='));
  const written: Record<string, unknown> | null | undefined = line
    ? JSON.parse(line.slice('written='.length))
    : undefined;
  return { status: result.status, stderr: result.stderr, written };
}

function packedConfig(tree: string): string {
  return readFileSync(path.join(tree, 'resources', 'app-update.yml'), 'utf8');
}

/** The packaging log's line for the installer's defines, printed by the builder's own logger. */
function packagingLog(storeFile: string | null): string {
  const builderRequire = createRequire(createRequire(__filename).resolve('electron-builder/package.json'));
  const libraryRequire = createRequire(builderRequire.resolve('app-builder-lib/package.json'));
  const createDebug: DebugFactory = libraryRequire('debug');
  const enabledBefore = createDebug.disable();
  createDebug.enable('electron-builder:nsis');
  const lines: string[] = [];
  const debug = createDebug('electron-builder:nsis');
  // A log piped to a file is never a terminal.
  debug.useColors = false;
  debug.log = (text: string) => lines.push(text);
  debug({
    APP_ID: 'io.openheaders',
    PRODUCT_NAME: 'OpenHeaders',
    ...(storeFile === null ? {} : { APP_INSTALLER_STORE_FILE: storeFile }),
    COMPRESSION_METHOD: '7z',
  });
  debug({ OutFile: '"D:\\a\\dist\\OpenHeaders-2026.11.2-Setup.exe"', Unicode: true });
  createDebug.enable(enabledBefore);
  return ['  • building        target=nsis file=dist\\OpenHeaders-2026.11.2-Setup.exe', ...lines, ''].join('\n');
}

function check(tree: string, log: string) {
  const logFile = path.join(tree, 'package-installers.log');
  writeFileSync(logFile, log);
  const result = spawnSync(process.execPath, [SCRIPT, tree, logFile], { encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

afterEach(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
  workDir = null;
});

describe('update-config — the file a pack without an installer target gets', () => {
  it(
    'names the cache folder installed copies use, the feed and the publisher',
    () => {
      const tree = makeTree();

      const result = generate(tree, 'x64');

      expect(result.status).toBe(0);
      expect(result.written).toEqual({
        provider: 'generic',
        url: 'https://updates.openheaders.com/desktop/stable',
        updaterCacheDirName: CACHE_DIR,
        publisherName: ['BITHUB TEAM SRL'],
      });
      expect(packedConfig(tree)).toBe(
        [
          'provider: generic',
          'url: https://updates.openheaders.com/desktop/stable',
          `updaterCacheDirName: ${CACHE_DIR}`,
          'publisherName:',
          '  - BITHUB TEAM SRL',
          '',
        ].join('\n'),
      );
    },
    BUILDER_TIMEOUT,
  );

  it(
    'writes the same file for the ARM64 installer',
    () => {
      const x64 = makeTree();
      expect(generate(x64, 'x64').status).toBe(0);
      const x64Config = packedConfig(x64);
      rmSync(x64, { recursive: true, force: true });

      const arm64 = makeTree();
      const result = generate(arm64, 'arm64', ARM64_CONFIG);

      expect(result.status).toBe(0);
      expect(packedConfig(arm64)).toBe(x64Config);
    },
    BUILDER_TIMEOUT,
  );

  it.each([
    { lane: 'x64', arch: 'x64' as const, config: UNSIGNED },
    { lane: 'ARM64', arch: 'arm64' as const, config: { extends: ARM64_CONFIG, ...UNSIGNED } },
  ])(
    'leaves the publisher out for an unsigned $lane installer',
    ({ arch, config }) => {
      const tree = makeTree();

      const result = generate(tree, arch, config);

      expect(result.status).toBe(0);
      expect(result.written).toEqual({
        provider: 'generic',
        url: 'https://updates.openheaders.com/desktop/stable',
        updaterCacheDirName: CACHE_DIR,
      });
      expect(packedConfig(tree)).not.toContain('publisherName');
    },
    BUILDER_TIMEOUT,
  );

  it(
    'leaves the file the builder wrote as it is',
    () => {
      const fromBuilder =
        'provider: generic\nurl: https://updates.openheaders.io/desktop/stable\nupdaterCacheDirName: written-by-the-builder\n';
      const tree = makeTree({ 'app-update.yml': fromBuilder });

      const result = generate(tree, 'x64');

      expect(result.status).toBe(0);
      expect(result.written).toBeNull();
      expect(packedConfig(tree)).toBe(fromBuilder);
    },
    BUILDER_TIMEOUT,
  );
});

describe('update-config — one author', () => {
  it('copies no update config of our own into a package', () => {
    const { build } = JSON.parse(readFileSync(path.join(APP_DIR, 'package.json'), 'utf8')) as {
      build: { extraResources: { from: string; to: string }[] };
    };

    expect(build.extraResources.filter(({ to }) => to.endsWith('app-update.yml'))).toEqual([]);
    expect(existsSync(path.join(APP_DIR, 'dev-app-update.yml'))).toBe(false);
  });
});

describe("update-config — the release leg's check", () => {
  const packed = (cacheDir: string) => ({
    'app-update.yml': `provider: generic\nurl: https://updates.openheaders.io/desktop/stable\nupdaterCacheDirName: ${cacheDir}\n`,
  });

  it('passes when the installer keeps its copy in the folder the packed app reads', () => {
    const tree = makeTree(packed(CACHE_DIR));

    const result = check(tree, packagingLog(`${CACHE_DIR}\\installer.exe`));

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`the packed app and its installer both use "${CACHE_DIR}"`);
  });

  it('fails when the packed app reads another folder, as 2026.11.1 did', () => {
    const tree = makeTree(packed('openheaders-updater'));

    const result = check(tree, packagingLog(`${CACHE_DIR}\\installer.exe`));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `the packed app reads its update cache in "openheaders-updater" and the installer keeps its copy in "${CACHE_DIR}"`,
    );
  });

  it('fails when the log does not say where the installer keeps its copy', () => {
    const tree = makeTree(packed(CACHE_DIR));

    const result = check(tree, packagingLog(null));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('the packaging log holds no APP_INSTALLER_STORE_FILE');
  });

  it('fails when two installers in one log keep their copies in different folders', () => {
    const tree = makeTree(packed(CACHE_DIR));

    const result = check(
      tree,
      packagingLog(`${CACHE_DIR}\\installer.exe`) + packagingLog('another-updater\\installer.exe'),
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`more than one installer folder: ${CACHE_DIR}, another-updater`);
  });

  it('fails on a tree with no update config', () => {
    const tree = makeTree();

    const result = check(tree, packagingLog(`${CACHE_DIR}\\installer.exe`));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no app-update.yml at');
  });

  it('fails on an update config that names no cache folder', () => {
    const tree = makeTree({
      'app-update.yml': 'provider: generic\nurl: https://updates.openheaders.io/desktop/stable\n',
    });

    const result = check(tree, packagingLog(`${CACHE_DIR}\\installer.exe`));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('names no updaterCacheDirName');
  });
});
