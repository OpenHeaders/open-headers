/**
 * Behavior of `scripts/build/pack-msix.mjs` up to the Windows tools —
 * how a signed tree is laid out as a Windows package, what is read from
 * the tree instead of typed, and which trees it refuses. Run as child
 * processes against fixture trees, like the other release script
 * suites; indexing and packing are Windows' and are never reached.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { deriveInstallKind, PACKAGE_MANIFEST_FILE_NAME } from '../../../src/main/bootstrap/install-kind';

const APP_DIR = path.resolve(__dirname, '../../..');
const SCRIPT = path.join(APP_DIR, 'scripts/build/pack-msix.mjs');
const LOGO_SET_DIR = path.join(APP_DIR, 'build/windows/package-assets');

const PUBLISHER = 'CN=John Doe SRL, O=John Doe SRL, L=Iasi, S=Iasi, C=RO';

const MACHINE = { x64: 0x8664, arm64: 0xaa64, x86: 0x014c } as const;

/**
 * Lays a package out with the index step replaced: the stand-in writes
 * what the staging folder held when it ran, where the index would go.
 */
const LAY_OUT = `
const fs = require('node:fs');
const path = require('node:path');
const [options, script] = process.argv.slice(1);
import(script).then(({ layOutPackage }) => {
  try {
    const laidOut = layOutPackage({
      ...JSON.parse(options),
      indexLogoSet: (dir) => fs.writeFileSync(path.join(dir, 'resources.pri'), fs.readdirSync(dir).sort().join(',')),
    });
    console.log(JSON.stringify({ laidOut }));
  } catch (error) {
    console.log(JSON.stringify({ refused: error.message }));
  }
});
`;

interface LaidOut {
  arch: string;
  packageVersion: string;
  artifactName: string;
}

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

function signedTree(machine: number = MACHINE.arm64): Record<string, Buffer | string> {
  return {
    'OpenHeaders.exe': program(machine),
    'ffmpeg.dll': Buffer.from([0x4d, 0x5a, 0x00, 0xff, 0x10, 0x80]),
    'resources/app.asar': 'an archive, copied as the file it is',
    'resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node': Buffer.from([
      0x00, 0x01, 0xfe, 0xff,
    ]),
    'resources/app-update.yml': 'provider: generic\n',
    'resources/nm-host/oh-nm-host.exe': program(machine),
  };
}

let workDir: string | null = null;

function makeTree(files: Record<string, Buffer | string>): string {
  workDir = mkdtempSync(path.join(tmpdir(), 'oh-pack-msix-'));
  const tree = path.join(workDir, 'win-unpacked');
  mkdirSync(tree, { recursive: true });
  for (const [relative, bytes] of Object.entries(files)) {
    const file = path.join(tree, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, bytes);
  }
  return tree;
}

/** Every file under `root`, as forward-slash paths with their bytes. */
function filesUnder(root: string): Record<string, Buffer> {
  const found: Record<string, Buffer> = {};
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop() ?? root;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(entryPath);
      else found[path.relative(root, entryPath).split(path.sep).join('/')] = readFileSync(entryPath);
    }
  }
  return found;
}

function layOut(
  treeDir: string,
  overrides: { version?: string; publisher?: string; stagingDir?: string } = {},
): { laidOut?: LaidOut; refused?: string; stagingDir: string } {
  const stagingDir = overrides.stagingDir ?? path.join(path.dirname(treeDir), 'staging');
  const options = JSON.stringify({
    treeDir,
    version: '2026.11.3-beta.2',
    publisher: PUBLISHER,
    ...overrides,
    stagingDir,
  });
  const result = spawnSync(process.execPath, ['-e', LAY_OUT, options, pathToFileURL(SCRIPT).href], {
    encoding: 'utf8',
  });
  expect(result.stderr).toBe('');
  return { ...JSON.parse(result.stdout), stagingDir };
}

function identity(stagingDir: string): Record<string, string> {
  const manifest = readFileSync(path.join(stagingDir, PACKAGE_MANIFEST_FILE_NAME), 'utf8');
  const element = /<Identity\b([^>]*)\/>/.exec(manifest)?.[1] ?? '';
  return Object.fromEntries([...element.matchAll(/(\w+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
}

// The suite reads a staged tree as files on disk. Under the desktop's
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

describe('pack-msix — the layout', () => {
  it('puts the manifest at the root, the logo set and the index beside it, and the tree in app', () => {
    const tree = makeTree(signedTree());

    const { laidOut, stagingDir } = layOut(tree);

    expect(laidOut).toEqual({
      arch: 'arm64',
      packageVersion: '2026.11.3.2',
      artifactName: 'OpenHeaders-2026.11.3-beta.2-arm64.msix',
    });
    expect(readdirSync(stagingDir).sort()).toEqual([PACKAGE_MANIFEST_FILE_NAME, 'app', 'assets', 'resources.pri']);
  });

  it('copies the tree byte for byte and leaves it as it was', () => {
    const files = signedTree();
    const tree = makeTree(files);
    const expected = Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, Buffer.from(bytes)]));

    const { stagingDir } = layOut(tree);

    expect(filesUnder(path.join(stagingDir, 'app'))).toEqual(expected);
    expect(filesUnder(tree)).toEqual(expected);
  });

  it('copies the logo set as committed', () => {
    const { stagingDir } = layOut(makeTree(signedTree()));

    expect(filesUnder(path.join(stagingDir, 'assets'))).toEqual(filesUnder(LOGO_SET_DIR));
  });

  it('indexes the logo set before the tree is there', () => {
    const { stagingDir } = layOut(makeTree(signedTree()));

    expect(readFileSync(path.join(stagingDir, 'resources.pri'), 'utf8')).toBe(`${PACKAGE_MANIFEST_FILE_NAME},assets`);
  });

  it('lays the tree out where the app knows itself for a package', () => {
    const { stagingDir } = layOut(makeTree(signedTree()));

    const reading = deriveInstallKind({
      platform: 'win32',
      isPackaged: true,
      hasPackageIdentity: false,
      executablePath: path.join(stagingDir, 'app', 'OpenHeaders.exe'),
    });

    expect(reading).toEqual({ kind: 'msix', lonePackageSign: 'manifest' });
  });
});

describe('pack-msix — what the manifest is filled with', () => {
  it("fills the release's package version, the tree's arch and the signer's subject", () => {
    const { stagingDir } = layOut(makeTree(signedTree(MACHINE.x64)), { version: '2026.11.3' });

    expect(identity(stagingDir)).toEqual({
      Name: 'OpenHeaders',
      ProcessorArchitecture: 'x64',
      Publisher: PUBLISHER,
      Version: '2026.11.3.1000',
    });
  });

  it('leaves no value unfilled', () => {
    const { stagingDir } = layOut(makeTree(signedTree()));

    expect(readFileSync(path.join(stagingDir, PACKAGE_MANIFEST_FILE_NAME), 'utf8')).not.toContain('${');
  });

  it('writes a subject with marks of its own as text, not as markup', () => {
    const { stagingDir } = layOut(makeTree(signedTree()), { publisher: 'CN="Doe & Sons, <SRL>", O=John Doe, C=RO' });

    expect(identity(stagingDir).Publisher).toBe('CN=&quot;Doe &amp; Sons, &lt;SRL&gt;&quot;, O=John Doe, C=RO');
  });
});

describe('pack-msix — the trees it refuses', () => {
  const refusal = (files: Record<string, Buffer | string>, overrides: { version?: string } = {}) => {
    const result = layOut(makeTree(files), overrides);
    return { refused: result.refused, staged: readdirSync(path.dirname(result.stagingDir)).includes('staging') };
  };

  it('refuses an installed copy: the classic uninstaller lies in it', () => {
    const result = refusal({ ...signedTree(), 'Uninstall OpenHeaders.exe': program(MACHINE.x86) });

    expect(result.refused).toContain('it is an installed copy, not the signed tree');
    expect(result.staged).toBe(false);
  });

  it('refuses a tree without the browser helper the manifest starts', () => {
    const { 'resources/nm-host/oh-nm-host.exe': _helper, ...withoutHelper } = signedTree();

    const result = refusal(withoutHelper);

    expect(result.refused).toContain('the manifest starts app\\resources\\nm-host\\oh-nm-host.exe');
    expect(result.staged).toBe(false);
  });

  it('refuses a tree without the app', () => {
    const { 'OpenHeaders.exe': _app, ...withoutApp } = signedTree();

    expect(refusal(withoutApp).refused).toContain('the manifest starts app\\OpenHeaders.exe');
  });

  it('refuses an app that is no Windows program', () => {
    const result = refusal({
      ...signedTree(),
      'OpenHeaders.exe': 'a Mach-O file would start otherwise'.padEnd(200, ' '),
    });

    expect(result.refused).toContain('is not a Windows program');
    expect(result.staged).toBe(false);
  });

  it('refuses an app built for a machine no package is made for', () => {
    expect(refusal({ ...signedTree(), 'OpenHeaders.exe': program(MACHINE.x86) }).refused).toContain(
      'is built for a machine no package is made for (0x14c)',
    );
  });

  it('refuses a version that is no release', () => {
    const result = refusal(signedTree(), { version: 'v2026.11.3' });

    expect(result.refused).toContain("'v2026.11.3' is not a release version");
    expect(result.staged).toBe(false);
  });

  it('refuses a folder that is not there', () => {
    const tree = makeTree(signedTree());

    expect(layOut(path.join(tree, 'win-arm64-unpacked')).refused).toContain('no tree at');
  });

  it('refuses a staging folder that holds something', () => {
    const tree = makeTree(signedTree());
    const stagingDir = path.join(path.dirname(tree), 'staging');
    mkdirSync(stagingDir);
    writeFileSync(path.join(stagingDir, 'left-over.txt'), 'from another pack');

    expect(layOut(tree, { stagingDir }).refused).toContain('is not empty');
    expect(readdirSync(stagingDir)).toEqual(['left-over.txt']);
  });
});

describe('pack-msix — the command', () => {
  const run = (args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });

  it('says how it is called when an argument is missing', () => {
    const result = run([makeTree(signedTree()), '2026.11.3']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('usage: pack-msix.mjs <tree> <version> <signer> <out dir>');
  });

  it.runIf(process.platform !== 'win32')('packs on Windows only, and lays nothing out elsewhere', () => {
    const tree = makeTree(signedTree());
    const outDir = path.join(path.dirname(tree), 'out');

    const result = run([tree, '2026.11.3', path.join(tree, 'OpenHeaders.exe'), outDir]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('packing needs Windows');
    expect(readdirSync(path.dirname(tree))).toEqual(['win-unpacked']);
  });
});
