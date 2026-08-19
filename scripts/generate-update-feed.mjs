/**
 * Stages the static update feed uploaded to `updates.openheaders.com`
 * by the release workflow (the distribution plan §3). Input is the release
 * job's `processed_files` directory (electron-builder `latest*.yml`
 * feed files + the generated `versions.json`); output is the exact R2
 * object layout for ONE channel:
 *
 *   desktop/<channel>/latest*.yml   — electron-updater generic feed,
 *                                     file entries rewritten to
 *                                     absolute release-asset URLs
 *   versions/<channel>.json         — severity manifest, all apps
 *   install.sh · install.ps1        — CLI installers (stable only),
 *                                     resolve versions/stable.json
 *
 * The channel comes from the tag shape (`-beta.N` ⇒ beta) — a beta tag
 * stages only `beta/` paths, so it can never move what stable clients
 * read. Artifacts stay on GitHub Releases: the yml files carry absolute
 * URLs and clients download from those; the feed host serves only these
 * few KB of pointers.
 *
 * Usage: node scripts/generate-update-feed.mjs <tag> <download-base-url> <input-dir> <output-dir>
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`generate-update-feed: ${message}`);
  process.exit(1);
}

/** `stable` | `beta` from the tag shape — the only channel authority. */
function channelForTag(tag) {
  return /-beta[.0-9]*$/.test(tag) ? 'beta' : 'stable';
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

const [tag, downloadBase, inputDir, outputDir] = process.argv.slice(2);
if (!tag?.startsWith('v')) fail(`expected the release tag as first argument, got '${tag}'`);
if (!downloadBase?.startsWith('https://')) fail(`expected an absolute download base URL, got '${downloadBase}'`);
if (!inputDir || !outputDir) fail('usage: generate-update-feed.mjs <tag> <download-base-url> <input-dir> <output-dir>');

const channel = channelForTag(tag);
const base = downloadBase.replace(/\/+$/, '');

// Desktop feed pointers — whatever OS legs produced artifacts. A leg
// that failed simply leaves its previous pointer in place on the feed.
// electron-builder names the files after the version's channel
// (`latest*.yml` stable, `beta*.yml` prerelease); in the feed layout
// the channel is the PATH segment and clients always request the
// `latest` names, so beta-named files are normalized on staging.
const feedFiles = readdirSync(inputDir).filter((name) => /^(latest|beta)(-[a-z0-9-]+)?\.yml$/.test(name));
if (feedFiles.length === 0) {
  console.error('generate-update-feed: no feed yml files in input — desktop pointers unchanged this release');
} else {
  const desktopDir = path.join(outputDir, 'desktop', channel);
  mkdirSync(desktopDir, { recursive: true });
  const staged = new Set();
  for (const name of feedFiles) {
    const stagedName = name.replace(/^beta/, 'latest');
    if (staged.has(stagedName)) fail(`both channel spellings of ${stagedName} are present in the input`);
    staged.add(stagedName);
    const rewritten = rewriteFeedYaml(readFileSync(path.join(inputDir, name), 'utf8'), base);
    if (!/url: https:\/\//.test(rewritten)) fail(`${name} has no absolute file URL after rewrite`);
    writeFileSync(path.join(desktopDir, stagedName), rewritten);
  }
}

// Severity manifest — always present (the generator ran before this).
const versionsPath = path.join(inputDir, 'versions.json');
if (!existsSync(versionsPath)) fail('versions.json is missing from the input directory');
const versions = JSON.parse(readFileSync(versionsPath, 'utf8'));
if (typeof versions !== 'object' || versions === null || !versions.desktop) {
  fail('versions.json is missing or has no desktop entry');
}
mkdirSync(path.join(outputDir, 'versions'), { recursive: true });
copyFileSync(versionsPath, path.join(outputDir, 'versions', `${channel}.json`));

// CLI install scripts ride the stable feed root — the printed
// one-liners fetch them from updates.openheaders.com directly. The ps1
// prefers the release-artifact copy (the windows leg's, Authenticode-
// signed on stable) over the unsigned checkout copy, so saved-file runs
// under AllSigned execution policies keep working from the feed too.
if (channel === 'stable') {
  copyFileSync(path.join(repoRoot, 'apps/cli/scripts/install.sh'), path.join(outputDir, 'install.sh'));
  const signedPs1 = path.join(inputDir, 'install-oh.ps1');
  copyFileSync(
    existsSync(signedPs1) ? signedPs1 : path.join(repoRoot, 'apps/cli/scripts/install.ps1'),
    path.join(outputDir, 'install.ps1'),
  );
}

console.error(`generate-update-feed: staged ${channel} feed for ${tag} in ${outputDir}`);
