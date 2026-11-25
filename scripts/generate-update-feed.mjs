/**
 * Stages the static update feed uploaded to `updates.openheaders.com`
 * by the release workflow (the distribution plan §3). Input is the release
 * job's `processed_files` directory (electron-builder `latest*.yml`
 * feed files + the generated `versions.json`); output is the exact R2
 * object layout for the tag's channel:
 *
 *   desktop/<channel>/latest*.yml   — electron-updater generic feed,
 *                                     file entries rewritten to
 *                                     absolute release-asset URLs
 *   desktop/<channel>/windows-package.json
 *                                   — the Windows package pointer, only
 *                                     when the input holds packages
 *   versions/<channel>.json         — severity manifest, all apps
 *   install.sh · install.ps1        — CLI installers (stable only),
 *                                     resolve versions/stable.json
 *
 * The channel comes from the tag shape (`-beta.N` ⇒ beta). A beta tag
 * stages only `beta/` paths, so it can never move what stable clients
 * read. A stable tag stages `stable/` and, given the live beta
 * manifest, OVERTAKES the beta channel entry by entry: an app whose
 * beta version is older than this stable (or that has no beta entry)
 * gets the stable's manifest entry, and when that app is the desktop
 * the stable's pointer files are staged under `desktop/beta/` too. The
 * beta channel therefore never sits behind stable — the channel
 * setting's promise that the next stable overtakes a beta holds on the
 * feed, for every platform, between beta tags. A beta that is newer
 * stays untouched. The mirror guard: a beta tag older than the live
 * stable fails here, before anything is uploaded.
 *
 * Artifacts stay on the feed's `dl/<tag>/` path: the yml files carry
 * absolute URLs and clients download from those.
 *
 * The Windows package pointer is what an installed package reads to
 * learn of an update: one file for both arches, staged when the input
 * holds `<product>-<version>-<arch>.msix` for every arch, and not at all
 * when it holds none. Its shape is a wire contract from the first
 * release that carries one — an older package reads newer pointers. It
 * rides with the installer pointers, so a stable that overtakes the
 * beta channel carries it across. The publisher is the subject of the
 * certificate the packages were signed with, handed over by the leg
 * that signed them: Windows takes an update only from the publisher the
 * installed package names. So a release whose packages name another
 * publisher than a live pointer does is refused before anything is
 * staged: it would strand every install that pointer serves. A real
 * change of signer is bridged by hand, never by a release.
 *
 * Usage: node scripts/generate-update-feed.mjs <tag> <download-base-url> <input-dir> <output-dir>
 *          [--live-stable=<versions/stable.json copy>] [--live-beta=<versions/beta.json copy>]
 *          [--package-publisher=<file holding the packages' signer subject>]...
 *          [--live-package=<desktop/<channel>/windows-package.json copy>]...
 *        A live manifest or pointer file holds `{}` when its channel has none yet.
 *        One publisher file per leg that signed a package; they must agree.
 *        One live pointer per channel this release may write.
 */

import { createHash } from 'node:crypto';
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { channelForTag, compareVersions, packageVersion } from './lib/versions.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The pack script's artifact name: `<product>-<version>-<arch>.msix`. */
const PACKAGE_PRODUCT_NAME = 'OpenHeaders';
const PACKAGE_ARCHES = ['x64', 'arm64'];
const PACKAGE_POINTER_NAME = 'windows-package.json';

function fail(message) {
  console.error(`generate-update-feed: ${message}`);
  process.exit(1);
}

/**
 * Rewrite an electron-builder feed file's `url:` / `path:` entries to
 * absolute URLs under the release's asset download base. Only bare
 * asset names are rewritten — already-absolute values pass through, so
 * the transform is idempotent.
 */
function rewriteFeedYaml(content, downloadBase) {
  return content.replace(/^(\s*(?:- )?(?:url|path): )(\S+)$/gm, (line, prefix, value) =>
    /^https?:\/\//.test(value) ? line : `${prefix}${downloadBase}/${value}`,
  );
}

function readManifest(file, what) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`cannot read the ${what} ${file}: ${error.message}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) fail(`${file}: the ${what} is not an object`);
  return parsed;
}

function sha256Of(file) {
  const hash = createHash('sha256');
  const chunk = Buffer.allocUnsafe(1 << 20);
  const fd = openSync(file, 'r');
  try {
    for (let read = readSync(fd, chunk); read > 0; read = readSync(fd, chunk)) hash.update(chunk.subarray(0, read));
  } finally {
    closeSync(fd);
  }
  return hash.digest('hex');
}

/** The one signer subject every publisher file names. */
function readPackagePublisher(files) {
  if (files.length === 0) fail('the input holds a Windows package but no --package-publisher names its signer');
  const subjects = files.map((file) => {
    let subject;
    try {
      subject = readFileSync(file, 'utf8').replace(/^\uFEFF/, '').trim();
    } catch (error) {
      fail(`cannot read the package publisher ${file}: ${error.message}`);
    }
    if (!subject || /[\r\n]/.test(subject)) fail(`${file}: expected one line, the signer's subject`);
    return subject;
  });
  const differing = subjects.find((subject) => subject !== subjects[0]);
  if (differing) fail(`the Windows packages name two publishers: '${subjects[0]}' and '${differing}'`);
  return subjects[0];
}

/**
 * The pointer for the packages in the input, or undefined when it holds
 * none. A release ships a package for every arch or for none: a pointer
 * naming one arch would leave the other's installs without an update
 * and say nothing.
 */
function windowsPackagePointer(inputDir, tag, base, publisherFiles) {
  const present = readdirSync(inputDir).filter((name) => name.toLowerCase().endsWith('.msix'));
  if (present.length === 0) return undefined;
  const version = tag.slice(1);
  const nameFor = (arch) => `${PACKAGE_PRODUCT_NAME}-${version}-${arch}.msix`;
  const expected = PACKAGE_ARCHES.map(nameFor);
  const missing = expected.filter((name) => !present.includes(name));
  const unexpected = present.filter((name) => !expected.includes(name));
  if (missing.length > 0) fail(`a Windows package is missing from the input: ${missing.join(', ')}`);
  if (unexpected.length > 0) fail(`a Windows package in the input is not this release's: ${unexpected.join(', ')}`);
  let filledVersion;
  try {
    filledVersion = packageVersion(version);
  } catch (error) {
    fail(error.message);
  }
  const publisher = readPackagePublisher(publisherFiles);
  const packages = {};
  for (const arch of PACKAGE_ARCHES) {
    const file = path.join(inputDir, nameFor(arch));
    const size = statSync(file).size;
    if (size === 0) fail(`${nameFor(arch)} is empty`);
    packages[arch] = { url: `${base}/${nameFor(arch)}`, size, sha256: sha256Of(file) };
  }
  return { version, packageVersion: filledVersion, tag, publisher, packages, stop: false, ramp: 100 };
}

/** The publisher a live package pointer names; undefined when its channel has no pointer yet (`{}`). */
function livePackagePublisher(file) {
  const live = readManifest(file, 'live package pointer');
  if (Object.keys(live).length === 0) return undefined;
  if (typeof live.publisher !== 'string' || live.publisher === '') fail(`${file}: the live package pointer names no publisher`);
  return live.publisher;
}

const options = {};
const packagePublisherFiles = [];
const livePackageFiles = [];
const positional = [];
for (const arg of process.argv.slice(2)) {
  const match = arg.match(/^--(live-stable|live-beta|package-publisher|live-package)=(.*)$/);
  if (match) {
    if (!match[2]) fail(`--${match[1]} expects a file path`);
    if (match[1] === 'package-publisher') packagePublisherFiles.push(match[2]);
    else if (match[1] === 'live-package') livePackageFiles.push(match[2]);
    else options[match[1]] = match[2];
  } else if (arg.startsWith('--')) {
    fail(`unknown option '${arg}'`);
  } else {
    positional.push(arg);
  }
}
const [tag, downloadBase, inputDir, outputDir] = positional;
if (!tag?.startsWith('v')) fail(`expected the release tag as first argument, got '${tag}'`);
if (!downloadBase?.startsWith('https://')) fail(`expected an absolute download base URL, got '${downloadBase}'`);
if (!inputDir || !outputDir) {
  fail(
    'usage: generate-update-feed.mjs <tag> <download-base-url> <input-dir> <output-dir> [--live-stable=<file>] [--live-beta=<file>] [--package-publisher=<file>]... [--live-package=<file>]...',
  );
}

const channel = channelForTag(tag);
const base = downloadBase.replace(/\/+$/, '');

// Read before anything is staged: a package that cannot be pointed at
// fails the release with an empty output tree.
const packagePointer = windowsPackagePointer(inputDir, tag, base, packagePublisherFiles);
if (packagePointer) {
  for (const file of livePackageFiles) {
    const livePublisher = livePackagePublisher(file);
    if (livePublisher !== undefined && livePublisher !== packagePointer.publisher) {
      fail(
        `${tag}'s Windows packages are signed by '${packagePointer.publisher}', the live pointer ${path.basename(file)} names '${livePublisher}' — an installed package takes no update from another publisher`,
      );
    }
  }
}

// Desktop feed pointers — whatever OS legs produced artifacts. A leg
// that failed simply leaves its previous pointer in place on the feed.
// electron-builder names the files after the version's channel
// (`latest*.yml` stable, `beta*.yml` prerelease); in the feed layout
// the channel is the PATH segment and clients always request the
// `latest` names, so beta-named files are normalized on staging.
const feedFiles = readdirSync(inputDir).filter((name) => /^(latest|beta)(-[a-z0-9-]+)?\.yml$/.test(name));
const stagedPointers = new Map();
if (feedFiles.length === 0) {
  console.error('generate-update-feed: no feed yml files in input — desktop pointers unchanged this release');
} else {
  const desktopDir = path.join(outputDir, 'desktop', channel);
  mkdirSync(desktopDir, { recursive: true });
  for (const name of feedFiles) {
    const stagedName = name.replace(/^beta/, 'latest');
    if (stagedPointers.has(stagedName)) fail(`both channel spellings of ${stagedName} are present in the input`);
    const rewritten = rewriteFeedYaml(readFileSync(path.join(inputDir, name), 'utf8'), base);
    if (!/url: https:\/\//.test(rewritten)) fail(`${name} has no absolute file URL after rewrite`);
    writeFileSync(path.join(desktopDir, stagedName), rewritten);
    stagedPointers.set(stagedName, rewritten);
  }
}
if (packagePointer) {
  const desktopDir = path.join(outputDir, 'desktop', channel);
  mkdirSync(desktopDir, { recursive: true });
  const content = `${JSON.stringify(packagePointer, null, 2)}\n`;
  writeFileSync(path.join(desktopDir, PACKAGE_POINTER_NAME), content);
  stagedPointers.set(PACKAGE_POINTER_NAME, content);
}

// Severity manifest — always present (the generator ran before this).
const versionsPath = path.join(inputDir, 'versions.json');
if (!existsSync(versionsPath)) fail('versions.json is missing from the input directory');
const versions = readManifest(versionsPath, 'release manifest');
if (!versions.desktop?.latest) fail('versions.json is missing or has no desktop entry');
mkdirSync(path.join(outputDir, 'versions'), { recursive: true });
copyFileSync(versionsPath, path.join(outputDir, 'versions', `${channel}.json`));

// The beta channel never goes behind stable: a beta tag whose desktop
// version is older than the live stable is a mis-cut tag, not a
// release — refused before any byte is uploaded.
if (channel === 'beta' && options['live-stable']) {
  const liveStable = readManifest(options['live-stable'], 'live stable manifest');
  const stableLatest = liveStable.desktop?.latest;
  if (stableLatest && compareVersions(versions.desktop.latest, stableLatest) < 0) {
    fail(`beta ${tag} is older than the live stable ${stableLatest} — the beta channel never goes behind stable`);
  }
}

// Stable overtakes beta, entry by entry. The extension never has a
// beta entry (stores are its only channel). The desktop entry moves
// only together with its pointer files — a manifest naming a stable
// the ymls do not serve would send beta clients to a version their
// updater cannot find.
if (channel === 'stable' && options['live-beta']) {
  const liveBeta = readManifest(options['live-beta'], 'live beta manifest');
  const betaManifest = { ...liveBeta };
  const overtaken = [];
  for (const [app, entry] of Object.entries(versions)) {
    if (app === 'extension') continue;
    const live = liveBeta[app];
    const older = !live?.latest || compareVersions(entry.latest, live.latest) > 0;
    if (!older) continue;
    if (app === 'desktop' && feedFiles.length === 0) {
      console.error('generate-update-feed: no desktop pointers staged — the beta desktop entry is not overtaken');
      continue;
    }
    betaManifest[app] = entry;
    overtaken.push(app);
  }
  if (overtaken.includes('desktop')) {
    const betaDesktopDir = path.join(outputDir, 'desktop', 'beta');
    mkdirSync(betaDesktopDir, { recursive: true });
    for (const [name, content] of stagedPointers) writeFileSync(path.join(betaDesktopDir, name), content);
  }
  if (overtaken.length > 0) {
    writeFileSync(path.join(outputDir, 'versions', 'beta.json'), `${JSON.stringify(betaManifest, null, 2)}\n`);
    console.error(`generate-update-feed: stable ${tag} overtakes the beta channel for ${overtaken.join(', ')}`);
  } else {
    console.error('generate-update-feed: the beta channel is newer or equal for every app — not overtaken');
  }
}

// CLI install scripts ride the stable feed root — the printed
// one-liners fetch them from updates.openheaders.com directly. The ps1
// is ONLY the release-artifact copy (the windows leg's, Authenticode-
// signed): the checkout copy is unsigned, and a saved-file run under an
// AllSigned execution policy would break on it — a missing artifact
// copy fails the release instead of shipping the unsigned one silently.
if (channel === 'stable') {
  copyFileSync(path.join(repoRoot, 'apps/cli/scripts/install.sh'), path.join(outputDir, 'install.sh'));
  const signedPs1 = path.join(inputDir, 'install-oh.ps1');
  if (!existsSync(signedPs1)) fail('install-oh.ps1 (the signed windows-leg copy) is missing from the input directory');
  copyFileSync(signedPs1, path.join(outputDir, 'install.ps1'));
}

console.error(`generate-update-feed: staged ${channel} feed for ${tag} in ${outputDir}`);
