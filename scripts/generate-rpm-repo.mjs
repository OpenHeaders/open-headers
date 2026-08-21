/**
 * Stages the signed rpm/dnf repository uploaded to
 * `updates.openheaders.com` by the release workflow (the distribution
 * plan §8, Phase 7 — second Linux leg after the apt tree). Input is
 * the release job's `processed_files` directory (the electron-builder
 * `open-headers-<version>.<arch>.rpm` artifacts); output is the
 * repository layout for ONE channel, rooted at the baseurl:
 *
 *   rpm/<channel>/Packages/*.rpm
 *   rpm/<channel>/repodata/            — createrepo_c output
 *   rpm/<channel>/repodata/repomd.xml.asc — detached armored signature
 *   rpm/key.asc — the archive public key clients verify against
 *
 * The channel comes from the tag shape (`-beta.N` ⇒ beta), same as the
 * update feed — a beta tag stages only `rpm/beta/`, so it can never
 * move what stable clients read. The index is stateless: each release
 * lists exactly this tag's rpms (older versions stay downloadable from
 * `dl/<tag>/`). Trust matches the apt leg: dnf verifies the signed
 * repomd.xml (`repo_gpgcheck=1`), package integrity flows through the
 * sha256 chain in that metadata (`gpgcheck=0` — rpms stay unsigned, the
 * pool file is the exact release artifact). Signing uses the DEDICATED
 * archive key (never the release GPG key) from
 * `APT_GPG_PRIVATE_KEY`/`APT_GPG_PASSPHRASE` — the one Linux archive
 * key serves both repos; missing key or missing rpms degrade to "rpm
 * tree unchanged" instead of failing the release. A key that does not
 * match the committed keyring FAILS hard — the rpm post script embeds
 * that keyring, and signing with anything else would break every
 * registered install.
 *
 * Usage: node scripts/generate-rpm-repo.mjs <tag> <input-dir> <output-dir> [keyring-path]
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`generate-rpm-repo: ${message}`);
  process.exit(1);
}

/** `stable` | `beta` from the tag shape — the only channel authority. */
function channelForTag(tag) {
  return /-beta[.0-9]*$/.test(tag) ? 'beta' : 'stable';
}

const [tag, inputDir, outputDir, keyringArg] = process.argv.slice(2);
if (!tag?.startsWith('v')) fail(`expected the release tag as first argument, got '${tag}'`);
if (!inputDir || !outputDir) fail('usage: generate-rpm-repo.mjs <tag> <input-dir> <output-dir> [keyring-path]');
const keyringPath = keyringArg ?? path.join(repoRoot, 'apps/desktop/scripts/debian/openheaders-archive-keyring.asc');

const privateKey = process.env.APT_GPG_PRIVATE_KEY;
const passphrase = process.env.APT_GPG_PASSPHRASE;
if (!privateKey || !passphrase) {
  console.error('generate-rpm-repo: APT_GPG_PRIVATE_KEY/APT_GPG_PASSPHRASE not configured — rpm repository not staged');
  process.exit(0);
}

const rpmNames = readdirSync(inputDir)
  .filter((name) => /^open-headers-.+\.rpm$/.test(name))
  .sort();
if (rpmNames.length === 0) {
  console.error('generate-rpm-repo: no rpm artifacts in input — rpm repository unchanged this release');
  process.exit(0);
}

// One rpm per architecture — createrepo_c reads the headers itself,
// the filename arch is only the duplicate guard.
const seenArch = new Map();
for (const name of rpmNames) {
  const arch = name.match(/\.([a-z0-9_]+)\.rpm$/)?.[1];
  if (!arch) fail(`${name} has no architecture suffix`);
  if (seenArch.has(arch)) fail(`two rpms claim architecture ${arch}: ${seenArch.get(arch)} and ${name}`);
  seenArch.set(arch, name);
}

const channel = channelForTag(tag);
const archiveRoot = path.join(outputDir, 'rpm', channel);
const packagesDir = path.join(archiveRoot, 'Packages');
mkdirSync(packagesDir, { recursive: true });
for (const name of rpmNames) {
  copyFileSync(path.join(inputDir, name), path.join(packagesDir, name));
}

// createrepo_c writes repodata/ with hash-prefixed index files —
// repomd.xml is the only mutable name, so stale CDN caches can never
// mix two releases' indexes. gz keeps the payloads readable by every
// dnf/librepo vintage regardless of the tool's default compression.
execFileSync('createrepo_c', ['--general-compress-type=gz', archiveRoot], { stdio: 'inherit' });

// Sign repomd.xml in a throwaway keyring so the runner's other imports
// (the release key signs SHA256SUMS in the same job) can never be
// picked up. dnf fetches repodata/repomd.xml.asc for repo_gpgcheck.
const repomdPath = path.join(archiveRoot, 'repodata', 'repomd.xml');
const gnupghome = mkdtempSync(path.join(tmpdir(), 'oh-rpm-gpg-'));
try {
  const env = { ...process.env, GNUPGHOME: gnupghome };
  const gpg = (args, options = {}) => execFileSync('gpg', ['--batch', ...args], { env, ...options });
  gpg(['--import'], { input: privateKey });
  const secretFpr = String(gpg(['--with-colons', '--list-secret-keys'])).match(/^fpr:+([0-9A-F]+):/m)?.[1];
  const keyringFpr = String(gpg(['--with-colons', '--show-keys', keyringPath])).match(/^fpr:+([0-9A-F]+):/m)?.[1];
  if (!secretFpr || secretFpr !== keyringFpr) {
    fail(`signing key ${secretFpr} does not match the committed archive keyring ${keyringFpr} — installs verify against the committed key`);
  }
  const sign = ['--yes', '--pinentry-mode', 'loopback', '--passphrase', passphrase, '--local-user', secretFpr];
  gpg([...sign, '--armor', '--detach-sign', '--output', `${repomdPath}.asc`, repomdPath]);
  gpg(['--verify', `${repomdPath}.asc`, repomdPath], { stdio: 'ignore' });
} finally {
  rmSync(gnupghome, { recursive: true, force: true });
}

// The archive public key, channel-independent — served next to the
// repos for the documented one-line download. Always the COMMITTED
// keyring (the fingerprint check above ties it to the signing key),
// so a rotation must land in-repo before it can reach the feed.
copyFileSync(keyringPath, path.join(outputDir, 'rpm', 'key.asc'));

console.error(`generate-rpm-repo: staged signed ${channel} rpm repository for ${tag} (${[...seenArch.keys()].sort().join(', ')})`);
