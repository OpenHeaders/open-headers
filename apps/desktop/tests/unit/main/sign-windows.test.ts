/**
 * Behavior of `scripts/build/sign-windows.js` up to the signing call
 * itself — which files of a Windows package it takes for PE images,
 * which of those it reads as unsigned, and when it refuses to sign.
 * Run as a child process against fixture trees, like the other release
 * script suites; the signing service is never reached.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(__dirname, '../../../scripts/build/sign-windows.js');

const SIGNING_ENV = [
  'AZURE_TENANT_ID',
  'AZURE_CLIENT_ID',
  'AZURE_CLIENT_SECRET',
  'WIN_SIGN_ENDPOINT',
  'WIN_SIGN_ACCOUNT',
  'WIN_SIGN_PROFILE',
];

/** A minimal PE image: headers only, its certificate table empty or not. */
function peImage(bits: 32 | 64, signed: boolean): Buffer {
  const peOffset = 64;
  const optionalHeader = peOffset + 24;
  const directories = optionalHeader + (bits === 64 ? 112 : 96);
  const image = Buffer.alloc(directories + 16 * 8);
  image.write('MZ', 0, 'latin1');
  image.writeUInt32LE(peOffset, 0x3c);
  image.write('PE\0\0', peOffset, 'latin1');
  image.writeUInt16LE(bits === 64 ? 0x20b : 0x10b, optionalHeader);
  image.writeUInt32LE(16, directories - 4);
  if (signed) {
    image.writeUInt32LE(0x4000, directories + 4 * 8);
    image.writeUInt32LE(0x2a10, directories + 4 * 8 + 4);
  }
  return image;
}

let workDir: string | null = null;

/** Writes `files` (relative path → bytes) under a fresh folder and returns it. */
function makeTree(files: Record<string, Buffer | string>): string {
  workDir = mkdtempSync(path.join(tmpdir(), 'oh-sign-windows-'));
  for (const [relative, bytes] of Object.entries(files)) {
    const file = path.join(workDir, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, bytes);
  }
  return workDir;
}

function withoutSigningEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env = { ...process.env, ...extra };
  for (const name of SIGNING_ENV) delete env[name];
  delete env.OH_WIN_SIGN;
  return { ...env, ...extra };
}

function run(args: string[], env: NodeJS.ProcessEnv = withoutSigningEnv()) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function listed(stdout: string): string[] {
  return stdout.split(/\r?\n/).filter((line) => line.length > 0);
}

afterEach(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
  workDir = null;
});

describe('sign-windows — which files are PE images', () => {
  it('lists PE files by content, whatever their extension, at any depth', () => {
    const root = makeTree({
      'OpenHeaders.exe': peImage(64, true),
      'ffmpeg.dll': peImage(64, false),
      'resources/elevate.exe': peImage(32, false),
      'resources/app.asar.unpacked/node_modules/node-pty/pty.node': peImage(64, false),
      'resources/app.asar': 'not an image',
      'resources/web/index.js': 'console.log(1);',
      'LICENSE.txt': 'MZ is how this text happens to start, and it is still text.'.padEnd(400, ' '),
    });

    const result = run(['--list', root]);

    expect(result.status).toBe(0);
    expect(listed(result.stdout)).toEqual(
      [
        path.join(root, 'OpenHeaders.exe'),
        path.join(root, 'ffmpeg.dll'),
        path.join(root, 'resources', 'app.asar.unpacked', 'node_modules', 'node-pty', 'pty.node'),
        path.join(root, 'resources', 'elevate.exe'),
      ].sort(),
    );
  });

  it('does not take a truncated or headerless file for a PE image', () => {
    const root = makeTree({
      'cut.exe': peImage(64, false).subarray(0, 80),
      'short.dll': 'MZ',
      'empty.node': '',
      'real.exe': peImage(64, false),
    });

    expect(listed(run(['--list', root]).stdout)).toEqual([path.join(root, 'real.exe')]);
  });
});

describe('sign-windows — which PE files are unsigned', () => {
  it('reads the certificate table of 32-bit and 64-bit images', () => {
    const root = makeTree({
      'signed64.exe': peImage(64, true),
      'signed32.dll': peImage(32, true),
      'unsigned64.node': peImage(64, false),
      'unsigned32.exe': peImage(32, false),
    });

    expect(listed(run(['--list-unsigned', root]).stdout)).toEqual([
      path.join(root, 'unsigned32.exe'),
      path.join(root, 'unsigned64.node'),
    ]);
  });
});

describe('sign-windows — signing a tree', () => {
  it('leaves a tree with nothing unsigned alone, credentials or not', () => {
    const root = makeTree({ 'OpenHeaders.exe': peImage(64, true), 'vendor.dll': peImage(64, true) });

    const result = run([root]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('0 of 2 PE files');
  });

  it('refuses to sign without the credentials and names what is missing', () => {
    const root = makeTree({ 'OpenHeaders.exe': peImage(64, false) });

    const result = run([root], withoutSigningEnv({ AZURE_TENANT_ID: 'tenant', WIN_SIGN_ACCOUNT: 'account' }));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'cannot sign without AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, WIN_SIGN_ENDPOINT, WIN_SIGN_PROFILE',
    );
  });

  it('fails on a folder that holds no PE file', () => {
    const root = makeTree({ 'notes.txt': 'nothing to sign here' });

    const result = run([root]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no PE file under');
  });

  it('fails on a folder that does not exist', () => {
    const root = makeTree({});

    const result = run([path.join(root, 'win-unpacked')]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no folder at');
  });
});

describe('sign-windows — signing a Windows package', () => {
  /** How a zip archive opens: the first local file header. */
  const zipHead = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x2d, 0x00, 0x00, 0x00]);

  it('refuses to sign without the credentials and names what is missing', () => {
    const root = makeTree({ 'OpenHeaders-2026.11.3-arm64.msix': zipHead });

    const result = run(['--package', path.join(root, 'OpenHeaders-2026.11.3-arm64.msix')]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('cannot sign without AZURE_TENANT_ID');
  });

  it('refuses a file that is not a package', () => {
    const root = makeTree({ 'OpenHeaders-2026.11.3-Setup.exe': peImage(32, false) });

    const result = run(['--package', path.join(root, 'OpenHeaders-2026.11.3-Setup.exe')]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('is not a Windows package');
  });

  it('fails on a package that is not there, and on a folder', () => {
    const root = makeTree({ 'windows-package/notes.txt': 'no package was packed' });

    for (const target of [path.join(root, 'windows-package', 'OpenHeaders.msix'), path.join(root, 'windows-package')]) {
      const result = run(['--package', target]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('no package at');
    }
  });

  it('says how it is called when the file is missing', () => {
    const result = run(['--package']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('usage: sign-windows.js --package <file>');
  });
});

describe('sign-windows — the builder hook', () => {
  const callHook = (file: string, env: NodeJS.ProcessEnv) =>
    spawnSync(
      process.execPath,
      [
        '-e',
        'require(process.argv[1]).default({ path: process.argv[2] }).then(() => console.log("returned"), (error) => { console.error(error.message); process.exit(1); })',
        SCRIPT,
        file,
      ],
      { encoding: 'utf8', env },
    );

  it('leaves the file as it is outside the signing lane', () => {
    const root = makeTree({ 'Uninstall OpenHeaders.exe': peImage(32, false) });
    const file = path.join(root, 'Uninstall OpenHeaders.exe');

    const result = callHook(file, withoutSigningEnv());

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('returned');
    expect(listed(run(['--list-unsigned', root]).stdout)).toEqual([file]);
  });

  it('fails in the signing lane when the credentials are missing', () => {
    const root = makeTree({ 'Uninstall OpenHeaders.exe': peImage(32, false) });

    const result = callHook(path.join(root, 'Uninstall OpenHeaders.exe'), withoutSigningEnv({ OH_WIN_SIGN: '1' }));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('cannot sign without AZURE_TENANT_ID');
  });
});
