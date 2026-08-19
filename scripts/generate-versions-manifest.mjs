/**
 * Builds the static severity manifest (`versions.json`, the updates
 * plan §4) printed to stdout by the release workflow. Clients fetch it
 * anonymously from the update feed at
 * `updates.openheaders.com/versions/<channel>.json`; the GitHub release
 * asset is a redundant human-browsable copy, not the client contract.
 *
 * Shape, per app: `{ latest, tag, severity, minimumSafeVersion? }`.
 * `latest` comes from each app's own package.json (the desktop's from
 * the tag — that is its version axis); `tag` is the release tag whose
 * page hosts the app's assets, so consumers (the install scripts)
 * construct absolute download URLs without ever resolving GitHub
 * "latest" (the distribution plan §3). `severity` and the optional
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

/**
 * Numeric segment-wise CalVer compare, prerelease-aware: on an equal
 * base a `-beta.N` sorts below the plain release and betas order by N.
 * Mirrors the client's `compareCalVer` (versions-manifest.ts) exactly.
 */
function compareVersions(a, b) {
  const parse = (v) => {
    const match = /-beta\.(\d+)$/.exec(v);
    return {
      base: v
        .replace(/-beta\.\d+$/, '')
        .split('.')
        .map(Number),
      beta: match ? Number(match[1]) : null,
    };
  };
  const [pa, pb] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(pa.base.length, pb.base.length); i++) {
    const diff = (pa.base[i] ?? 0) - (pb.base[i] ?? 0);
    if (diff !== 0) return diff;
  }
  if (pa.beta === null && pb.beta === null) return 0;
  if (pa.beta === null) return 1;
  if (pb.beta === null) return -1;
  return pa.beta - pb.beta;
}

const tag = process.argv[2];
if (!tag?.startsWith('v')) fail(`expected the release tag as argument, got '${tag}'`);

// The extension entry exists for the website's download surfaces (the
// extension itself never checks for updates — stores own that) and
// names the store-submitted version. STABLE ONLY: the extension has
// no beta channel and no channel serves sideload zips, so a beta
// manifest carries no extension entry at all.
const isBeta = /-beta\.\d+$/.test(tag);

const severityByApp = readJson('.github/release-severity.json');
const apps = isBeta ? APPS.filter((app) => app !== 'extension') : APPS;
const latestByApp = {
  desktop: tag.slice(1),
  daemon: readJson('apps/daemon/package.json').version,
  cli: readJson('apps/cli/package.json').version,
  extension: readJson('apps/extension/package.json').version.replace(/-beta\.\d+$/, ''),
};

const manifest = {};
for (const app of apps) {
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
