/**
 * Behavior of `scripts/generate-apt-repo.mjs` — the release step that
 * stages the signed apt repository on updates.openheaders.com. Run as
 * a child process against fixture debs: a fake `dpkg-deb` on PATH
 * serves control paragraphs (the real tool only exists on the release
 * runner), while signing uses real gpg with throwaway test keys. Also
 * guards the postinst's embedded archive key against drift from the
 * committed keyring the repository indexes are signed with.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(__dirname, '../../../../../scripts/generate-apt-repo.mjs');
const DEBIAN_DIR = path.resolve(__dirname, '../../../scripts/debian');
const PASSPHRASE = 'test-passphrase';

const hasGpg = (() => {
  try {
    execFileSync('gpg', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const DPKG_DEB_SHIM = [
  '#!/bin/sh',
  '# Fake dpkg-deb: `-f <deb>` prints a control paragraph derived from',
  '# the artifact name (open-headers_<version>_<arch>.deb).',
  'name=$(basename "$2" .deb)',
  'version=$(echo "$name" | cut -d_ -f2)',
  'arch=$(echo "$name" | cut -d_ -f3)',
  'cat <<EOF',
  'Package: open-headers',
  'Version: $version',
  'Architecture: $arch',
  'Maintainer: John Doe <test@openheaders.io>',
  'Installed-Size: 1024',
  'Depends: libgtk-3-0',
  'Section: utils',
  'Priority: optional',
  'Description: OpenHeaders test fixture',
  'EOF',
  '',
].join('\n');

function genKey(home: string, name: string): { privateKey: string; publicKey: string } {
  mkdirSync(home, { recursive: true, mode: 0o700 });
  const env = { ...process.env, GNUPGHOME: home };
  const params = [
    'Key-Type: eddsa',
    'Key-Curve: ed25519',
    'Key-Usage: sign',
    `Name-Real: ${name}`,
    'Name-Email: test@openheaders.io',
    'Expire-Date: 0',
    `Passphrase: ${PASSPHRASE}`,
    '%commit',
    '',
  ].join('\n');
  execFileSync('gpg', ['--batch', '--gen-key'], { env, input: params, stdio: ['pipe', 'ignore', 'ignore'] });
  const privateKey = execFileSync(
    'gpg',
    ['--batch', '--pinentry-mode', 'loopback', '--passphrase', PASSPHRASE, '--armor', '--export-secret-keys'],
    { env, encoding: 'utf8' },
  );
  const publicKey = execFileSync('gpg', ['--batch', '--armor', '--export'], { env, encoding: 'utf8' });
  return { privateKey, publicKey };
}

let keysDir: string;
let signingKey: { privateKey: string; publicKey: string };
let strangerKey: { privateKey: string; publicKey: string };
let workDir: string;

beforeAll(() => {
  if (!hasGpg || process.platform === 'win32') return;
  keysDir = mkdtempSync(path.join(tmpdir(), 'oh-apt-keys-'));
  signingKey = genKey(path.join(keysDir, 'signer'), 'OpenHeaders APT Archive Test');
  strangerKey = genKey(path.join(keysDir, 'stranger'), 'Somebody Else');
  return () => rmSync(keysDir, { recursive: true, force: true });
});

function stage(
  tag: string,
  debNames: string[],
  options: { keyring?: 'match' | 'mismatch'; secrets?: boolean } = {},
): { out: string; run: () => string } {
  workDir = mkdtempSync(path.join(tmpdir(), 'oh-apt-repo-'));
  const input = path.join(workDir, 'processed_files');
  const out = path.join(workDir, 'feed');
  const bin = path.join(workDir, 'bin');
  mkdirSync(input, { recursive: true });
  mkdirSync(bin, { recursive: true });
  writeFileSync(path.join(bin, 'dpkg-deb'), DPKG_DEB_SHIM, { mode: 0o755 });
  for (const name of debNames) {
    writeFileSync(path.join(input, name), `deb-bytes-${name}`);
  }
  const keyring = path.join(workDir, 'keyring.asc');
  writeFileSync(keyring, (options.keyring === 'mismatch' ? strangerKey : signingKey).publicKey);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${bin}${path.delimiter}${process.env.PATH}`,
  };
  if (options.secrets !== false) {
    env.APT_GPG_PRIVATE_KEY = signingKey.privateKey;
    env.APT_GPG_PASSPHRASE = PASSPHRASE;
  } else {
    delete env.APT_GPG_PRIVATE_KEY;
    delete env.APT_GPG_PASSPHRASE;
  }
  const run = () => execFileSync(process.execPath, [SCRIPT, tag, input, out, keyring], { encoding: 'utf8', env });
  return { out, run };
}

afterEach(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

describe.skipIf(!hasGpg || process.platform === 'win32')('generate-apt-repo', () => {
  it('stages a signed stable repository for both architectures', () => {
    const { out, run } = stage('v2026.8.3', ['open-headers_2026.8.3_amd64.deb', 'open-headers_2026.8.3_arm64.deb']);
    run();

    const root = path.join(out, 'apt/stable');
    for (const arch of ['amd64', 'arm64']) {
      expect(existsSync(path.join(root, `pool/main/o/open-headers/open-headers_2026.8.3_${arch}.deb`))).toBe(true);
      const packages = readFileSync(path.join(root, `dists/stable/main/binary-${arch}/Packages`), 'utf8');
      expect(packages).toContain('Package: open-headers');
      expect(packages).toContain('Version: 2026.8.3');
      expect(packages).toContain(`Architecture: ${arch}`);
      expect(packages).toContain(`Filename: pool/main/o/open-headers/open-headers_2026.8.3_${arch}.deb`);
      expect(packages).toMatch(/^SHA256: [0-9a-f]{64}$/m);
      expect(existsSync(path.join(root, `dists/stable/main/binary-${arch}/Packages.gz`))).toBe(true);
    }

    const release = readFileSync(path.join(root, 'dists/stable/Release'), 'utf8');
    expect(release).toContain('Suite: stable');
    expect(release).toContain('Codename: stable');
    expect(release).toContain('Architectures: amd64 arm64');
    expect(release).toContain('Components: main');
    expect(release).toMatch(/^ [0-9a-f]{64} \d+ main\/binary-amd64\/Packages$/m);
    expect(release).toMatch(/^ [0-9a-f]{64} \d+ main\/binary-arm64\/Packages\.gz$/m);

    // The script verifies both signatures with gpg before exiting —
    // shape assertions here, validity is enforced in-process.
    expect(readFileSync(path.join(root, 'dists/stable/InRelease'), 'utf8')).toContain('BEGIN PGP SIGNED MESSAGE');
    expect(readFileSync(path.join(root, 'dists/stable/Release.gpg'), 'utf8')).toContain('BEGIN PGP SIGNATURE');
    expect(readFileSync(path.join(out, 'apt/key.asc'), 'utf8')).toBe(signingKey.publicKey);
  });

  it('a beta tag stages only the beta archive', () => {
    const { out, run } = stage('v2026.8.3-beta.1', ['open-headers_2026.8.3-beta.1_amd64.deb']);
    run();

    expect(existsSync(path.join(out, 'apt/beta/dists/beta/InRelease'))).toBe(true);
    expect(existsSync(path.join(out, 'apt/stable'))).toBe(false);
    const release = readFileSync(path.join(out, 'apt/beta/dists/beta/Release'), 'utf8');
    expect(release).toContain('Suite: beta');
    expect(release).toContain('Architectures: amd64');
  });

  it('stages nothing without key secrets', () => {
    const { out, run } = stage('v2026.8.3', ['open-headers_2026.8.3_amd64.deb'], { secrets: false });
    run();
    expect(existsSync(path.join(out, 'apt'))).toBe(false);
  });

  it('stages nothing when no deb artifacts exist', () => {
    const { out, run } = stage('v2026.8.3', []);
    run();
    expect(existsSync(path.join(out, 'apt'))).toBe(false);
  });

  it('fails when the signing key does not match the committed keyring', () => {
    const { run } = stage('v2026.8.3', ['open-headers_2026.8.3_amd64.deb'], { keyring: 'mismatch' });
    expect(run).toThrow();
  });

  it('fails when two debs claim the same architecture', () => {
    const { run } = stage('v2026.8.3', ['open-headers_2026.8.3_amd64.deb', 'open-headers_2026.8.4_amd64.deb']);
    expect(run).toThrow();
  });
});

describe('debian repo registration scripts', () => {
  it('postinst embeds exactly the committed archive keyring', () => {
    const postinst = readFileSync(path.join(DEBIAN_DIR, 'postinst'), 'utf8');
    const keyring = readFileSync(path.join(DEBIAN_DIR, 'openheaders-archive-keyring.asc'), 'utf8');
    const embedded = postinst.match(/-----BEGIN PGP PUBLIC KEY BLOCK-----[\s\S]*?-----END PGP PUBLIC KEY BLOCK-----/);
    expect(embedded?.[0]).toBe(keyring.trim());
  });

  it('postinst registers the channel repository against the keyring path postrm cleans up', () => {
    const postinst = readFileSync(path.join(DEBIAN_DIR, 'postinst'), 'utf8');
    const postrm = readFileSync(path.join(DEBIAN_DIR, 'postrm'), 'utf8');
    expect(postinst).toContain(
      'signed-by=/usr/share/keyrings/openheaders-archive-keyring.asc] https://updates.openheaders.com/apt/$CHANNEL $CHANNEL main',
    );
    expect(postinst).toContain('OPENHEADERS_ADD_REPO');
    expect(postrm).toContain('/etc/apt/sources.list.d/openheaders.list');
    expect(postrm).toContain('/usr/share/keyrings/openheaders-archive-keyring.asc');
  });

  it('deb scripts carry no dollar-brace tokens (electron-builder fpm templating treats them as macros)', () => {
    for (const script of ['postinst', 'postrm']) {
      const text = readFileSync(path.join(DEBIAN_DIR, script), 'utf8');
      expect(text, `${script} would fail FpmTarget macro substitution`).not.toMatch(/\$\{[a-zA-Z]+\}/);
    }
  });
});
