/**
 * Stages the signed apt repository uploaded to `updates.openheaders.com`
 * by the release workflow (the distribution plan §8, Phase 7). Input
 * is the release job's `processed_files` directory (the electron-builder
 * `open-headers_*_<arch>.deb` artifacts); output is the archive layout
 * for ONE channel, rooted at the sources-line URL:
 *
 *   apt/<channel>/pool/main/o/open-headers/*.deb
 *   apt/<channel>/dists/<channel>/main/binary-<arch>/Packages{,.gz}
 *   apt/<channel>/dists/<channel>/{Release,Release.gpg,InRelease}
 *   apt/key.asc — the archive public key clients verify against
 *
 * The channel comes from the tag shape (`-beta.N` ⇒ beta), same as the
 * update feed — a beta tag stages only `apt/beta/`, so it can never
 * move what stable clients read. The index is stateless: each release
 * lists exactly this tag's debs (older versions stay downloadable from
 * `dl/<tag>/`). Signing uses the DEDICATED archive key (never the
 * release GPG key) from `APT_GPG_PRIVATE_KEY`/`APT_GPG_PASSPHRASE`;
 * missing key or missing debs degrade to "apt tree unchanged" instead
 * of failing the release. A key that does not match the committed
 * keyring FAILS hard — the deb postinst embeds that keyring, and
 * signing with anything else would break every registered install.
 *
 * Usage: node scripts/generate-apt-repo.mjs <tag> <input-dir> <output-dir> [keyring-path]
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`generate-apt-repo: ${message}`);
  process.exit(1);
}

/** `stable` | `beta` from the tag shape — the only channel authority. */
function channelForTag(tag) {
  return /-beta[.0-9]*$/.test(tag) ? 'beta' : 'stable';
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function md5(buffer) {
  return createHash('md5').update(buffer).digest('hex');
}

const [tag, inputDir, outputDir, keyringArg] = process.argv.slice(2);
if (!tag?.startsWith('v')) fail(`expected the release tag as first argument, got '${tag}'`);
if (!inputDir || !outputDir) fail('usage: generate-apt-repo.mjs <tag> <input-dir> <output-dir> [keyring-path]');
const keyringPath = keyringArg ?? path.join(repoRoot, 'apps/desktop/scripts/debian/openheaders-archive-keyring.asc');

const privateKey = process.env.APT_GPG_PRIVATE_KEY;
const passphrase = process.env.APT_GPG_PASSPHRASE;
if (!privateKey || !passphrase) {
  console.error('generate-apt-repo: APT_GPG_PRIVATE_KEY/APT_GPG_PASSPHRASE not configured — apt repository not staged');
  process.exit(0);
}

const debNames = readdirSync(inputDir)
  .filter((name) => /^open-headers_.+\.deb$/.test(name))
  .sort();
if (debNames.length === 0) {
  console.error('generate-apt-repo: no deb artifacts in input — apt repository unchanged this release');
  process.exit(0);
}

const channel = channelForTag(tag);

// One Packages paragraph per architecture: the deb's own control
// fields verbatim (dpkg-deb reads them from the archive — the deb is
// the authority, never the filename), plus the archive fields apt
// needs to fetch and verify the pool file.
const byArch = new Map();
for (const name of debNames) {
  const debPath = path.join(inputDir, name);
  const control = execFileSync('dpkg-deb', ['-f', debPath], { encoding: 'utf8' }).trimEnd();
  const arch = control.match(/^Architecture: (\S+)$/m)?.[1];
  if (!arch) fail(`${name} has no Architecture control field`);
  if (byArch.has(arch)) fail(`two debs claim architecture ${arch}: ${byArch.get(arch).name} and ${name}`);
  const bytes = readFileSync(debPath);
  byArch.set(arch, {
    name,
    debPath,
    paragraph: [
      control,
      `Filename: pool/main/o/open-headers/${name}`,
      `Size: ${bytes.length}`,
      `MD5sum: ${md5(bytes)}`,
      `SHA256: ${sha256(bytes)}`,
      '',
    ].join('\n'),
  });
}
const arches = [...byArch.keys()].sort();

const archiveRoot = path.join(outputDir, 'apt', channel);
const poolDir = path.join(archiveRoot, 'pool/main/o/open-headers');
const distsDir = path.join(archiveRoot, 'dists', channel);
mkdirSync(poolDir, { recursive: true });

// dists-relative index files, hashed into Release below.
const indexFiles = [];
for (const arch of arches) {
  const entry = byArch.get(arch);
  copyFileSync(entry.debPath, path.join(poolDir, entry.name));
  const binaryDir = path.join(distsDir, 'main', `binary-${arch}`);
  mkdirSync(binaryDir, { recursive: true });
  const packages = Buffer.from(entry.paragraph, 'utf8');
  writeFileSync(path.join(binaryDir, 'Packages'), packages);
  const gz = gzipSync(packages, { level: 9 });
  writeFileSync(path.join(binaryDir, 'Packages.gz'), gz);
  indexFiles.push({ rel: `main/binary-${arch}/Packages`, bytes: packages });
  indexFiles.push({ rel: `main/binary-${arch}/Packages.gz`, bytes: gz });
}

const release = [
  'Origin: OpenHeaders',
  'Label: OpenHeaders',
  `Suite: ${channel}`,
  `Codename: ${channel}`,
  `Architectures: ${arches.join(' ')}`,
  'Components: main',
  `Date: ${new Date().toUTCString()}`,
  'MD5Sum:',
  ...indexFiles.map(({ rel, bytes }) => ` ${md5(bytes)} ${bytes.length} ${rel}`),
  'SHA256:',
  ...indexFiles.map(({ rel, bytes }) => ` ${sha256(bytes)} ${bytes.length} ${rel}`),
  '',
].join('\n');
const releasePath = path.join(distsDir, 'Release');
writeFileSync(releasePath, release);

// Sign in a throwaway keyring so the runner's other imports (the
// release key signs SHA256SUMS in the same job) can never be picked up.
const gnupghome = mkdtempSync(path.join(tmpdir(), 'oh-apt-gpg-'));
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
  gpg([...sign, '--clearsign', '--output', path.join(distsDir, 'InRelease'), releasePath]);
  gpg([...sign, '--armor', '--detach-sign', '--output', path.join(distsDir, 'Release.gpg'), releasePath]);
  gpg(['--verify', path.join(distsDir, 'InRelease')], { stdio: 'ignore' });
  gpg(['--verify', path.join(distsDir, 'Release.gpg'), releasePath], { stdio: 'ignore' });
} finally {
  rmSync(gnupghome, { recursive: true, force: true });
}

// The archive public key, channel-independent — served next to the
// repos for the documented one-line download. Always the COMMITTED
// keyring (the fingerprint check above ties it to the signing key),
// so a rotation must land in-repo before it can reach the feed.
copyFileSync(keyringPath, path.join(outputDir, 'apt', 'key.asc'));

console.error(`generate-apt-repo: staged signed ${channel} apt repository for ${tag} (${arches.join(', ')})`);
