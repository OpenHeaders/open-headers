/**
 * The installer program in a Windows tree: the pack hook copies the
 * staged program of the tree's own arch under `resources/installer`,
 * by the name it is published under, and a pack with none staged ships
 * without it. The hook's step runs as a child process against fixture
 * folders, like the other release script suites. What the release lane
 * rests on is held here too: the name the build script stages, the
 * names a release publishes, and the place the lane's check and the
 * install test read.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PACKAGE_MANIFEST_FILE_NAME } from '../../../src/main/bootstrap/install-kind';

const APP_DIR = path.resolve(__dirname, '../../..');
const REPO_DIR = path.resolve(APP_DIR, '../..');
const HOOK = path.join(APP_DIR, 'scripts/build/afterPackHook.js');
const BUILD_SCRIPT = readFileSync(path.join(REPO_DIR, 'scripts/build-windows-installer.mjs'), 'utf8');
const RELEASE_MANIFEST = readFileSync(path.join(REPO_DIR, 'scripts/assert-release-manifest.mjs'), 'utf8');
const RELEASE_WORKFLOW = readFileSync(path.join(REPO_DIR, '.github/workflows/release.yml'), 'utf8');
const INSTALL_TEST = readFileSync(path.join(APP_DIR, 'scripts/build/test-msix-install.ps1'), 'utf8');
const PACKAGE_MANIFEST = readFileSync(path.join(APP_DIR, 'build/windows', PACKAGE_MANIFEST_FILE_NAME), 'utf8');

/** The builder's arch numbers, as the hook reads them. */
const ARCH = { x64: 1, arm64: 3, universal: 4 };

const EMBED = `
const [options, hook] = process.argv.slice(1);
const { appOutDir, arch, stageRoot } = JSON.parse(options);
require(hook).embedWindowsInstaller({ appOutDir, arch }, stageRoot);
`;

const NAMES = `
const { WINDOWS_INSTALLER_DIR_NAME, windowsInstallerFileName } = require(process.argv[1]);
console.log(JSON.stringify({ dir: WINDOWS_INSTALLER_DIR_NAME, x64: windowsInstallerFileName('x64'), arm64: windowsInstallerFileName('arm64') }));
`;

let workDir: string | null = null;

/** A stage holding `staged` (target → bytes) and an empty tree beside it. */
function fixture(staged: Record<string, string>): { stageRoot: string; appOutDir: string } {
  workDir = mkdtempSync(path.join(tmpdir(), 'oh-installer-in-tree-'));
  const stageRoot = path.join(workDir, 'stage');
  for (const [target, bytes] of Object.entries(staged)) {
    const arch = target.slice('win-'.length);
    mkdirSync(path.join(stageRoot, target), { recursive: true });
    writeFileSync(path.join(stageRoot, target, `OpenHeaders-Installer-${arch}.exe`), bytes);
  }
  const appOutDir = path.join(workDir, 'tree');
  mkdirSync(path.join(appOutDir, 'resources'), { recursive: true });
  return { stageRoot, appOutDir };
}

function embed(options: { appOutDir: string; arch: number; stageRoot: string }) {
  const result = spawnSync(process.execPath, ['-e', EMBED, JSON.stringify(options), HOOK], { encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function hookNames(): { dir: string; x64: string; arm64: string } {
  const result = spawnSync(process.execPath, ['-e', NAMES, HOOK], { encoding: 'utf8' });
  return JSON.parse(result.stdout);
}

afterEach(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
  workDir = null;
});

describe('the installer program in a Windows tree', () => {
  it.each([
    ['x64', 'OpenHeaders-Installer-x64.exe', 'the x64 program'],
    ['arm64', 'OpenHeaders-Installer-arm64.exe', 'the arm64 program'],
  ] as const)('carries the staged program of its own arch (%s)', (arch, fileName, bytes) => {
    const { stageRoot, appOutDir } = fixture({ 'win-x64': 'the x64 program', 'win-arm64': 'the arm64 program' });

    const result = embed({ appOutDir, arch: ARCH[arch], stageRoot });

    expect(result.status).toBe(0);
    expect(readdirSync(path.join(appOutDir, 'resources', 'installer'))).toEqual([fileName]);
    expect(readFileSync(path.join(appOutDir, 'resources', 'installer', fileName), 'utf8')).toBe(bytes);
    expect(result.stdout).toContain(`win-${arch}`);
  });

  it('ships a tree without it when its arch was not staged, and says so', () => {
    const { stageRoot, appOutDir } = fixture({ 'win-x64': 'the x64 program' });

    const result = embed({ appOutDir, arch: ARCH.arm64, stageRoot });

    expect(result.status).toBe(0);
    expect(existsSync(path.join(appOutDir, 'resources', 'installer'))).toBe(false);
    expect(result.stderr).toContain('not staged');
    expect(result.stderr).toContain(path.join(stageRoot, 'win-arm64', 'OpenHeaders-Installer-arm64.exe'));
  });

  it('ships a tree of an arch the installer is not built for without it', () => {
    const { stageRoot, appOutDir } = fixture({ 'win-x64': 'the x64 program', 'win-arm64': 'the arm64 program' });

    const result = embed({ appOutDir, arch: ARCH.universal, stageRoot });

    expect(result.status).toBe(0);
    expect(existsSync(path.join(appOutDir, 'resources', 'installer'))).toBe(false);
  });
});

describe('the names the release lane rests on', () => {
  const names = hookNames();

  it('takes the file the build script stages, under the name a release publishes', () => {
    expect(BUILD_SCRIPT).toContain("path.join(crateRoot, 'dist', target)");
    const staged = /const staged = `([^`]+)`;/.exec(BUILD_SCRIPT)?.[1] ?? '';

    for (const arch of ['x64', 'arm64'] as const) {
      expect(staged.replace(/\$\{arch\}/, arch)).toBe(names[arch]);
      expect(RELEASE_MANIFEST).toContain(`'${names[arch]}'`);
    }
  });

  it("is read by the lane's check where the hook puts it", () => {
    expect(RELEASE_WORKFLOW).toContain(`-unpacked/resources/${names.dir}/OpenHeaders-Installer-$arch.exe`);
  });

  it('is looked for by the install test where the package carries the tree', () => {
    const program = /<Application Id="OpenHeaders" Executable="([^"]+)"/.exec(PACKAGE_MANIFEST)?.[1] ?? '';
    const treeDir = path.win32.dirname(program);

    expect(treeDir).not.toBe('.');
    expect(INSTALL_TEST).toContain(`'${treeDir}\\resources\\${names.dir}\\' + (Split-Path -Leaf $Installer)`);
  });
});
