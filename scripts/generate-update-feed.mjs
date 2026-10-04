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
 * Usage: node scripts/generate-update-feed.mjs <tag> <download-base-url> <input-dir> <output-dir>
 *          [--live-stable=<versions/stable.json copy>] [--live-beta=<versions/beta.json copy>]
 *        A live manifest file holds `{}` when its channel has none yet.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { channelForTag, compareVersions } from './lib/versions.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
    fail(`cannot read the ${what} manifest ${file}: ${error.message}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) fail(`${file}: the ${what} manifest is not an object`);
  return parsed;
}

const options = {};
const positional = [];
for (const arg of process.argv.slice(2)) {
  const match = arg.match(/^--(live-stable|live-beta)=(.*)$/);
  if (match) {
    if (!match[2]) fail(`--${match[1]} expects a file path`);
    options[match[1]] = match[2];
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
  fail('usage: generate-update-feed.mjs <tag> <download-base-url> <input-dir> <output-dir> [--live-stable=<file>] [--live-beta=<file>]');
}

const channel = channelForTag(tag);
const base = downloadBase.replace(/\/+$/, '');

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

// Severity manifest — always present (the generator ran before this).
const versionsPath = path.join(inputDir, 'versions.json');
if (!existsSync(versionsPath)) fail('versions.json is missing from the input directory');
const versions = readManifest(versionsPath, 'release');
if (!versions.desktop?.latest) fail('versions.json is missing or has no desktop entry');
mkdirSync(path.join(outputDir, 'versions'), { recursive: true });
copyFileSync(versionsPath, path.join(outputDir, 'versions', `${channel}.json`));

// The beta channel never goes behind stable: a beta tag whose desktop
// version is older than the live stable is a mis-cut tag, not a
// release — refused before any byte is uploaded.
if (channel === 'beta' && options['live-stable']) {
  const liveStable = readManifest(options['live-stable'], 'live stable');
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
  const liveBeta = readManifest(options['live-beta'], 'live beta');
  const betaManifest = { ...liveBeta };
  const overtaken = [];
  for (const [app, entry] of Object.entries(versions)) {
    if (app === 'extension') continue;
    const live = liveBeta[app];
    const older = !live?.latest || compareVersions(entry.latest, live.latest) > 0;
    if (!older) continue;
    if (app === 'desktop' && stagedPointers.size === 0) {
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
