/**
 * Builds the static severity manifest (`versions.json`, UPDATES_PLAN §4)
 * printed to stdout by the release workflow and published as a release
 * asset. Clients fetch it anonymously from the public releases repo via
 * `/releases/latest/download/versions.json` — a URL GitHub resolves to
 * the newest non-prerelease, so beta tags never move the manifest.
 *
 * Shape, per app: `{ latest, tag, severity, minimumSafeVersion? }`.
 * `latest` comes from each app's own package.json (the desktop's from
 * the tag — that is its version axis); `tag` is the release tag whose
 * page hosts the app's assets, so consumers (the install scripts)
 * construct absolute download URLs without ever resolving GitHub
 * "latest" (DISTRIBUTION_PLAN §3). `severity` and the optional
 * `minimumSafeVersion` come from `.github/release-severity.json`, an
 * authored file: escalation is a human decision made before tagging,
 * never inferred. A `security` release must name its safe floor.
 *
 * Usage: node scripts/generate-versions-manifest.mjs <tag>
 */

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEVERITIES = new Set(['normal', 'security']);
const APPS = ['desktop', 'daemon', 'cli', 'extension'];

function fail(message) {
  console.error(`generate-versions-manifest: ${message}`);
  process.exit(1);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

/** Numeric segment-wise CalVer compare over the base version (beta suffix stripped). */
function compareVersions(a, b) {
  const segments = (v) =>
    v
      .replace(/-beta\.\d+$/, '')
      .split('.')
      .map(Number);
  const [as, bs] = [segments(a), segments(b)];
  for (let i = 0; i < Math.max(as.length, bs.length); i++) {
    const diff = (as[i] ?? 0) - (bs[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

const tag = process.argv[2];
if (!tag?.startsWith('v')) fail(`expected the release tag as argument, got '${tag}'`);

// The extension entry exists for the website's download surfaces (the
// extension itself never checks for updates — stores own that). On the
// stable channel it names the store-submitted version; the beta entry
// is kept fresh by the extension-only release lane, which patches it
// without a full release train.
const severityByApp = readJson('.github/release-severity.json');
const latestByApp = {
  desktop: tag.slice(1),
  daemon: readJson('apps/daemon/package.json').version,
  cli: readJson('apps/cli/package.json').version,
  extension: readJson('apps/extension/package.json').version,
};

const manifest = {};
for (const app of APPS) {
  const authored = severityByApp[app];
  if (!authored) fail(`.github/release-severity.json has no '${app}' entry`);
  const { severity, minimumSafeVersion } = authored;
  if (!SEVERITIES.has(severity)) fail(`'${app}' has invalid severity '${severity}'`);
  if (severity === 'security' && !minimumSafeVersion) {
    fail(`'${app}' is a security release but names no minimumSafeVersion`);
  }
  const latest = latestByApp[app];
  if (minimumSafeVersion && compareVersions(minimumSafeVersion, latest) > 0) {
    fail(`'${app}' minimumSafeVersion ${minimumSafeVersion} is above latest ${latest}`);
  }
  manifest[app] = { latest, tag, severity, ...(minimumSafeVersion ? { minimumSafeVersion } : {}) };
}

console.log(JSON.stringify(manifest, null, 2));
