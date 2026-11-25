/**
 * Behavior of `scripts/build/check-msix.mjs` — what a packed Windows
 * package's identity is held to: the product's name, the arch of the
 * tree's program, the version of the app inside the tree, the subject of
 * the package's signer. Run as a child process against a fixture tree
 * and a manifest filled as the pack fills it; reading the signature is
 * Windows' and is never reached.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const APP_DIR = path.resolve(__dirname, '../../..');
const SCRIPT = path.join(APP_DIR, 'scripts/build/check-msix.mjs');
const MANIFEST_TEMPLATE = path.join(APP_DIR, 'build/windows/AppxManifest.xml');

const SIGNER = 'CN=John Doe SRL, O=John Doe SRL, L=Iasi, S=Iasi, C=RO';

const MACHINE = { x64: 0x8664, arm64: 0xaa64 } as const;

/** Packs a folder into an archive with the library the builder packs the app with. */
const MAKE_ARCHIVE = `
const path = require('node:path');
const { appDir, sourceDir, archive } = JSON.parse(process.argv[1]);
const builderDir = path.dirname(require.resolve('electron-builder/package.json', { paths: [appDir] }));
const builderLibDir = path.dirname(require.resolve('app-builder-lib/package.json', { paths: [builderDir] }));
require(require.resolve('@electron/asar', { paths: [builderLibDir] }))
  .createPackage(sourceDir, archive)
  .catch((error) => { console.error(error.message); process.exit(1); });
`;

/** A minimal Windows program: headers only, built for `machine`. */
function program(machine: number): Buffer {
  const peOffset = 64;
  const image = Buffer.alloc(peOffset + 24);
  image.write('MZ', 0, 'latin1');
  image.writeUInt32LE(peOffset, 0x3c);
  image.write('PE\0\0', peOffset, 'latin1');
  image.writeUInt16LE(machine, peOffset + 4);
  return image;
}

let workDir: string | null = null;

/** A tree whose program is built for `machine` and whose app carries `appVersion`. */
function makeTree(machine: number, appVersion: string | null): string {
  workDir = mkdtempSync(path.join(tmpdir(), 'oh-check-msix-'));
  const tree = path.join(workDir, 'win-unpacked');
  mkdirSync(path.join(tree, 'resources', 'nm-host'), { recursive: true });
  writeFileSync(path.join(tree, 'OpenHeaders.exe'), program(machine));
  writeFileSync(path.join(tree, 'resources', 'nm-host', 'oh-nm-host.exe'), program(machine));
  if (appVersion !== null) {
    const sourceDir = path.join(workDir, 'app');
    mkdirSync(sourceDir);
    writeFileSync(path.join(sourceDir, 'package.json'), JSON.stringify({ name: 'open-headers', version: appVersion }));
    const options = JSON.stringify({ appDir: APP_DIR, sourceDir, archive: path.join(tree, 'resources', 'app.asar') });
    const packed = spawnSync(process.execPath, ['-e', MAKE_ARCHIVE, options], { encoding: 'utf8' });
    expect(packed.stderr).toBe('');
  }
  return tree;
}

interface Identity {
  arch: string;
  publisher: string;
  version: string;
  name?: string;
}

/** The product's manifest filled as the pack fills it, written beside the tree. */
function writeManifest(tree: string, identity: Identity): string {
  const filled: Record<string, string> = {
    arch: identity.arch,
    publisher: identity.publisher,
    version: identity.version,
  };
  let manifest = readFileSync(MANIFEST_TEMPLATE, 'utf8').replace(/\$\{(\w+)\}/g, (_token, name) => filled[name]);
  if (identity.name) manifest = manifest.replace('Name="OpenHeaders"', `Name="${identity.name}"`);
  const file = path.join(path.dirname(tree), 'AppxManifest.xml');
  writeFileSync(file, manifest);
  return file;
}

function check(manifestFile: string, tree: string, signer: string | null = SIGNER) {
  const env = { ...process.env };
  delete env.OH_PACKAGE_SIGNER;
  if (signer !== null) env.OH_PACKAGE_SIGNER = signer;
  const result = spawnSync(process.execPath, [SCRIPT, manifestFile, tree], { encoding: 'utf8', env });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

// The suite removes a tree that holds an archive. Under the desktop's
// own runtime `fs` opens an .asar as an archive instead; plain Node has
// no such switch and ignores this one.
const readsArchives = process.noAsar;
beforeAll(() => {
  process.noAsar = true;
});
afterAll(() => {
  process.noAsar = readsArchives;
});

afterEach(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
  workDir = null;
});

describe('check-msix — a package that is what it was packed from', () => {
  it("passes when the identity is the product's, the tree's and the signer's", () => {
    const tree = makeTree(MACHINE.arm64, '2026.11.3-beta.2');
    const manifest = writeManifest(tree, { arch: 'arm64', publisher: SIGNER, version: '2026.11.3.2' });

    const result = check(manifest, tree);

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`OpenHeaders 2026.11.3.2 arm64, publisher ${SIGNER}`);
  });

  it("maps a stable app's version as the pack does", () => {
    const tree = makeTree(MACHINE.x64, '2026.11.3');
    const manifest = writeManifest(tree, { arch: 'x64', publisher: SIGNER, version: '2026.11.3.1000' });

    expect(check(manifest, tree).status).toBe(0);
  });

  it('reads a publisher with marks of its own as the text it stands for', () => {
    const signer = 'CN="Doe & Sons, <SRL>", O=John Doe, C=RO';
    const tree = makeTree(MACHINE.arm64, '2026.11.3');
    const manifest = writeManifest(tree, {
      arch: 'arm64',
      publisher: 'CN=&quot;Doe &amp; Sons, &lt;SRL&gt;&quot;, O=John Doe, C=RO',
      version: '2026.11.3.1000',
    });

    expect(check(manifest, tree, signer).status).toBe(0);
  });
});

describe('check-msix — the differences it fails on', () => {
  it('fails a package stamped with another version than the app inside it carries', () => {
    const tree = makeTree(MACHINE.arm64, '2026.11.3-beta.3');
    const manifest = writeManifest(tree, { arch: 'arm64', publisher: SIGNER, version: '2026.11.3.2' });

    const result = check(manifest, tree);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "the package's version is '2026.11.3.2', the app's own version (2026.11.3-beta.3) is '2026.11.3.3'",
    );
  });

  it('fails a package whose publisher is not its signer, down to the spelling of a part', () => {
    const tree = makeTree(MACHINE.arm64, '2026.11.3');
    const manifest = writeManifest(tree, {
      arch: 'arm64',
      publisher: 'CN=John Doe SRL, O=John Doe SRL, L=Iasi, ST=Iasi, C=RO',
      version: '2026.11.3.1000',
    });

    const result = check(manifest, tree);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`the package's signer is '${SIGNER}'`);
  });

  it("fails a package whose arch is not the tree's program's", () => {
    const tree = makeTree(MACHINE.x64, '2026.11.3');
    const manifest = writeManifest(tree, { arch: 'arm64', publisher: SIGNER, version: '2026.11.3.1000' });

    const result = check(manifest, tree);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("the package's arch is 'arm64', the tree's program is 'x64'");
  });

  it("fails a package that goes by another name than the product's", () => {
    const tree = makeTree(MACHINE.arm64, '2026.11.3');
    const manifest = writeManifest(tree, {
      arch: 'arm64',
      publisher: SIGNER,
      version: '2026.11.3.1000',
      name: 'OpenHeadersBeta',
    });

    const result = check(manifest, tree);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("the package's name is 'OpenHeadersBeta', the product's manifest is 'OpenHeaders'");
  });

  it('names every difference, not the first', () => {
    const tree = makeTree(MACHINE.x64, '2026.11.3');
    const manifest = writeManifest(tree, { arch: 'arm64', publisher: 'CN=Jane Doe', version: '2026.11.2.1000' });

    const result = check(manifest, tree);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('3 difference(s)');
  });
});

describe('check-msix — what it cannot check', () => {
  it('fails without the signer', () => {
    const tree = makeTree(MACHINE.arm64, '2026.11.3');
    const manifest = writeManifest(tree, { arch: 'arm64', publisher: SIGNER, version: '2026.11.3.1000' });

    const result = check(manifest, tree, null);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('OH_PACKAGE_SIGNER is not set');
  });

  it('fails a tree without the app', () => {
    const tree = makeTree(MACHINE.arm64, null);
    const manifest = writeManifest(tree, { arch: 'arm64', publisher: SIGNER, version: '2026.11.3.1000' });

    const result = check(manifest, tree);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('the tree has no');
  });

  it('fails a manifest that is not there', () => {
    const tree = makeTree(MACHINE.arm64, '2026.11.3');

    const result = check(path.join(path.dirname(tree), 'AppxManifest.xml'), tree);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no manifest at');
  });

  it('says how it is called when an argument is missing', () => {
    const result = check(path.join(tmpdir(), 'AppxManifest.xml'), '');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('usage: check-msix.mjs <manifest> <tree>');
  });
});
