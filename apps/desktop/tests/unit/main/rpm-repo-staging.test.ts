/**
 * Behavior of `scripts/generate-rpm-repo.mjs` — the release step that
 * stages the signed rpm/dnf repository on updates.openheaders.com. Run
 * as a child process against fixture rpms: a fake `createrepo_c` on
 * PATH writes a minimal repodata/ (the real tool only exists on the
 * release runner), while signing uses real gpg with throwaway test
 * keys. Also guards the rpm post script's embedded archive key against
 * drift from the committed keyring the repomd.xml is signed with.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(__dirname, '../../../../../scripts/generate-rpm-repo.mjs');
const RPM_DIR = path.resolve(__dirname, '../../../scripts/rpm');
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

const CREATEREPO_SHIM = [
  '#!/bin/sh',
  '# Fake createrepo_c: writes a minimal repodata/ into the last',
  '# argument (flags precede the directory).',
  'for last; do :; done',
  'mkdir -p "$last/repodata"',
  'printf \'<repomd/>\' > "$last/repodata/repomd.xml"',
  'printf fake > "$last/repodata/0123abc-primary.xml.gz"',
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
  keysDir = mkdtempSync(path.join(tmpdir(), 'oh-rpm-keys-'));
  signingKey = genKey(path.join(keysDir, 'signer'), 'OpenHeaders Archive Test');
  strangerKey = genKey(path.join(keysDir, 'stranger'), 'Somebody Else');
  return () => rmSync(keysDir, { recursive: true, force: true });
});

function stage(
  tag: string,
  rpmNames: string[],
  options: { keyring?: 'match' | 'mismatch'; secrets?: boolean } = {},
): { out: string; run: () => string } {
  workDir = mkdtempSync(path.join(tmpdir(), 'oh-rpm-repo-'));
  const input = path.join(workDir, 'processed_files');
  const out = path.join(workDir, 'feed');
  const bin = path.join(workDir, 'bin');
  mkdirSync(input, { recursive: true });
  mkdirSync(bin, { recursive: true });
  writeFileSync(path.join(bin, 'createrepo_c'), CREATEREPO_SHIM, { mode: 0o755 });
  for (const name of rpmNames) {
    writeFileSync(path.join(input, name), `rpm-bytes-${name}`);
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

describe.skipIf(!hasGpg || process.platform === 'win32')('generate-rpm-repo', () => {
  it('stages a signed stable repository for both architectures', () => {
    const { out, run } = stage('v2026.8.3', ['open-headers-2026.8.3.x86_64.rpm', 'open-headers-2026.8.3.aarch64.rpm']);
    run();

    const root = path.join(out, 'rpm/stable');
    for (const arch of ['x86_64', 'aarch64']) {
      expect(existsSync(path.join(root, `Packages/open-headers-2026.8.3.${arch}.rpm`))).toBe(true);
    }
    expect(readFileSync(path.join(root, 'repodata/repomd.xml'), 'utf8')).toBe('<repomd/>');
    expect(existsSync(path.join(root, 'repodata/0123abc-primary.xml.gz'))).toBe(true);

    // The script verifies the signature with gpg before exiting —
    // shape assertion here, validity is enforced in-process.
    expect(readFileSync(path.join(root, 'repodata/repomd.xml.asc'), 'utf8')).toContain('BEGIN PGP SIGNATURE');
    expect(readFileSync(path.join(out, 'rpm/key.asc'), 'utf8')).toBe(signingKey.publicKey);
  });

  it('a beta tag stages only the beta repository', () => {
    const { out, run } = stage('v2026.8.3-beta.1', ['open-headers-2026.8.3-beta.1.x86_64.rpm']);
    run();

    expect(existsSync(path.join(out, 'rpm/beta/repodata/repomd.xml.asc'))).toBe(true);
    expect(existsSync(path.join(out, 'rpm/beta/Packages/open-headers-2026.8.3-beta.1.x86_64.rpm'))).toBe(true);
    expect(existsSync(path.join(out, 'rpm/stable'))).toBe(false);
  });

  it('stages nothing without key secrets', () => {
    const { out, run } = stage('v2026.8.3', ['open-headers-2026.8.3.x86_64.rpm'], { secrets: false });
    run();
    expect(existsSync(path.join(out, 'rpm'))).toBe(false);
  });

  it('stages nothing when no rpm artifacts exist', () => {
    const { out, run } = stage('v2026.8.3', []);
    run();
    expect(existsSync(path.join(out, 'rpm'))).toBe(false);
  });

  it('fails when the signing key does not match the committed keyring', () => {
    const { run } = stage('v2026.8.3', ['open-headers-2026.8.3.x86_64.rpm'], { keyring: 'mismatch' });
    expect(run).toThrow();
  });

  it('fails when two rpms claim the same architecture', () => {
    const { run } = stage('v2026.8.3', ['open-headers-2026.8.3.x86_64.rpm', 'open-headers-2026.8.4.x86_64.rpm']);
    expect(run).toThrow();
  });
});

describe('rpm repo registration scripts', () => {
  it('post embeds exactly the committed archive keyring', () => {
    const post = readFileSync(path.join(RPM_DIR, 'post'), 'utf8');
    const keyring = readFileSync(path.join(DEBIAN_DIR, 'openheaders-archive-keyring.asc'), 'utf8');
    const embedded = post.match(/-----BEGIN PGP PUBLIC KEY BLOCK-----[\s\S]*?-----END PGP PUBLIC KEY BLOCK-----/);
    expect(embedded?.[0]).toBe(keyring.trim());
  });

  it('post registers the channel repository against the key path postun cleans up', () => {
    const post = readFileSync(path.join(RPM_DIR, 'post'), 'utf8');
    const postun = readFileSync(path.join(RPM_DIR, 'postun'), 'utf8');
    expect(post).toContain('baseurl=https://updates.openheaders.com/rpm/$CHANNEL');
    expect(post).toContain('repo_gpgcheck=1');
    expect(post).toContain('gpgcheck=0');
    expect(post).toContain('gpgkey=file:///etc/pki/rpm-gpg/RPM-GPG-KEY-openheaders');
    expect(post).toContain('OPENHEADERS_ADD_REPO');
    // Cleanup only on erase — rpm passes the count of remaining
    // installs, and 1 means upgrade.
    expect(postun).toContain('if [ "$1" = "0" ]; then');
    expect(postun).toContain('/etc/yum.repos.d/openheaders.repo');
    expect(postun).toContain('/etc/pki/rpm-gpg/RPM-GPG-KEY-openheaders');
    expect(postun).toContain('rm -f /usr/bin/open-headers');
  });

  it('rpm scripts carry no dollar-brace tokens (electron-builder fpm templating treats them as macros)', () => {
    for (const script of ['post', 'postun', 'posttrans']) {
      const text = readFileSync(path.join(RPM_DIR, script), 'utf8');
      expect(text, `${script} would fail FpmTarget macro substitution`).not.toMatch(/\$\{[a-zA-Z]+\}/);
    }
  });

  it('posttrans re-asserts the symlink after the outgoing postun (crossgrade teardown survives)', () => {
    const posttrans = readFileSync(path.join(RPM_DIR, 'posttrans'), 'utf8');
    expect(posttrans).toContain('ln -sf "/opt/OpenHeaders/open-headers" "/usr/bin/open-headers"');
  });

  it('electron-builder wires the rpm scripts', () => {
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf8'));
    expect(pkg.build.rpm.afterInstall).toBe('./scripts/rpm/post');
    expect(pkg.build.rpm.afterRemove).toBe('./scripts/rpm/postun');
    expect(pkg.build.rpm.fpm).toContain('--rpm-posttrans=scripts/rpm/posttrans');
  });
});
