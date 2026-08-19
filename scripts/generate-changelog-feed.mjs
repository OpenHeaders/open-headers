/**
 * Stages the static changelog feed objects uploaded to
 * `updates.openheaders.com/changelog/*` by the release workflow
 * (the changelog plan §4.1), beside the version feed. Everything is
 * projected from the canonical `changelog/` tree — nothing here is
 * authored:
 *
 *   changelog/index.json                     — all entries, all streams, newest first
 *   changelog/stable.json · beta.json        — channel views
 *   changelog/<stream>.json                  — per-product views
 *   changelog/<stream>/<version>.json        — full entry: frontmatter + body_markdown
 *   changelog/<stream>/<version>.md          — raw markdown, curl-able
 *   changelog/<stream>/<version>-beta.N.json — immutable per-beta snapshot
 *   changelog/assets/<stream>/<version>/…    — entry assets
 *   llms.txt (feed root)                     — llms.txt pointer for AI agents
 *
 * Asset refs are relative in the canonical tree and rewritten to
 * absolute feed URLs here (relative-at-source, resolve-at-projection).
 * Entry-existence law: a release the tag cuts WITHOUT an entry file
 * still gets an index row (version/date, no notes link), and rows from
 * the previously published index survive regeneration — the feed's
 * history is additive. Indexes complement `versions.json`; the updater
 * never reads them (the updates plan feed law).
 *
 * Usage: node scripts/generate-changelog-feed.mjs <tag> <output-dir> [prior-index.json]
 */

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STREAMS, compareCalVer, parseFrontmatter, parseInlineMap } from './lib/changelog.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const changelogDir = path.join(repoRoot, 'changelog');
const FEED_BASE = 'https://updates.openheaders.com/changelog';

// Public history starts at the first public release — earlier versions
// never appear on the feed, whether from the tree or a prior index.
const FIRST_PUBLIC_VERSION = '2026.7.23';

// The streams a suite tag cuts (the extension rides its own store
// lane; its rows come from authored tree entries and its manifest
// version, like versions.json's extension entry). A stream-lane tag
// (`v*-cli` / `v*-daemon`) cuts only its own stream.
const CUT_APPS = { desktop: null, cli: 'apps/cli', daemon: 'apps/daemon', web: 'apps/web', extension: 'apps/extension' };

function fail(message) {
  console.error(`generate-changelog-feed: ${message}`);
  process.exit(1);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

const [tag, outputDir, priorIndexPath] = process.argv.slice(2);
if (!tag?.startsWith('v')) fail(`expected the release tag as first argument, got '${tag}'`);
if (!outputDir) fail('usage: generate-changelog-feed.mjs <tag> <output-dir> [prior-index.json]');

const betaN = tag.match(/-beta\.(\d+)$/)?.[1] ?? null;
const lane = tag.match(/-(cli|daemon)$/)?.[1] ?? null;
const tagBase = tag
  .slice(1)
  .replace(/-beta\.\d+$/, '')
  .replace(/-(cli|daemon)$/, '');
const outRoot = path.join(outputDir, 'changelog');

/** `](./assets/…` → absolute feed asset URL for the stream. */
function resolveAssets(text, stream) {
  return text.replaceAll('](./assets/', `](${FEED_BASE}/assets/${stream}/`);
}

// ── Walk the canonical tree ──────────────────────────────────────────
const entries = [];
for (const stream of readdirSync(changelogDir)) {
  const streamDir = path.join(changelogDir, stream);
  if (!statSync(streamDir).isDirectory()) continue;
  for (const year of readdirSync(streamDir)) {
    const yearDir = path.join(streamDir, year);
    if (!statSync(yearDir).isDirectory()) continue;
    const assetsDir = path.join(yearDir, 'assets');
    if (existsSync(assetsDir)) {
      for (const version of readdirSync(assetsDir)) {
        cpSync(path.join(assetsDir, version), path.join(outRoot, 'assets', stream, version), { recursive: true });
      }
    }
    for (const file of readdirSync(yearDir)) {
      if (!file.endsWith('.md')) continue;
      const entryPath = path.join(yearDir, file);
      const raw = readFileSync(entryPath, 'utf8');
      const { fields, body, errors } = parseFrontmatter(raw);
      if (errors.length > 0) fail(`${path.relative(repoRoot, entryPath)}: ${errors[0]} (run scripts/lint-changelog.mjs)`);
      if (compareCalVer(fields.version, FIRST_PUBLIC_VERSION) < 0) continue;
      entries.push({ stream, fields, body: body.trim(), raw });
    }
  }
}

function entryJson(entry) {
  const { version, date, channel, severity, highlights, apps } = entry.fields;
  return {
    app: entry.stream,
    version,
    date,
    channel,
    severity,
    ...(highlights?.length ? { highlights } : {}),
    ...(apps ? { apps: parseInlineMap(apps) ?? apps } : {}),
    body_markdown: resolveAssets(entry.body, entry.stream),
  };
}

// ── Per-entry objects (prose entries only — stubs have nothing to say)
const byKey = new Map(entries.map((entry) => [`${entry.stream}@${entry.fields.version}`, entry]));
for (const entry of entries) {
  if (entry.body === '') continue;
  const streamDir = path.join(outRoot, entry.stream);
  mkdirSync(streamDir, { recursive: true });
  writeFileSync(path.join(streamDir, `${entry.fields.version}.json`), `${JSON.stringify(entryJson(entry), null, 2)}\n`);
  writeFileSync(path.join(streamDir, `${entry.fields.version}.md`), resolveAssets(entry.raw, entry.stream));
}

// ── Immutable per-beta snapshots for the streams this tag cuts ───────
const severityByApp = readJson('.github/release-severity.json');
const cutApps = lane ? { [lane]: CUT_APPS[lane] } : CUT_APPS;
const cutVersions = {};
for (const [app, pkgDir] of Object.entries(cutApps)) {
  cutVersions[app] = pkgDir ? readJson(`${pkgDir}/package.json`).version.replace(/-beta\.\d+$/, '') : tagBase;
}
if (betaN) {
  for (const app of Object.keys(cutApps)) {
    if (app === 'extension') continue;
    const entry = byKey.get(`${app}@${cutVersions[app]}`);
    if (!entry) continue;
    const streamDir = path.join(outRoot, app);
    mkdirSync(streamDir, { recursive: true });
    const snapshot = { ...entryJson(entry), tag };
    writeFileSync(path.join(streamDir, `${entry.fields.version}-beta.${betaN}.json`), `${JSON.stringify(snapshot, null, 2)}\n`);
  }
}

// ── Indexes ──────────────────────────────────────────────────────────
function indexRow(entry) {
  const { version, date, channel, severity, highlights } = entry.fields;
  const prose = entry.body !== '';
  return {
    app: entry.stream,
    version,
    date,
    channel,
    severity,
    ...(highlights?.length ? { highlights } : {}),
    ...(prose ? { md: `${FEED_BASE}/${entry.stream}/${version}.md`, json: `${FEED_BASE}/${entry.stream}/${version}.json` } : {}),
  };
}

const rows = new Map(entries.map((entry) => [`${entry.stream}@${entry.fields.version}`, indexRow(entry)]));

// Entry-existence law: releases without entries still appear —
// version/date only, no notes link.
const today = new Date().toISOString().slice(0, 10);
for (const [app, version] of Object.entries(cutVersions)) {
  const key = `${app}@${version}`;
  if (rows.has(key)) continue;
  rows.set(key, {
    app,
    version,
    date: today,
    channel: betaN ? 'beta' : 'stable',
    severity: severityByApp[app]?.severity ?? 'normal',
  });
}

// Rows published by earlier tags survive the rebuild (they may name
// entry-less releases the tree never records).
if (priorIndexPath && existsSync(priorIndexPath)) {
  try {
    const prior = JSON.parse(readFileSync(priorIndexPath, 'utf8'));
    if (!Array.isArray(prior)) throw new Error('not an array');
    for (const row of prior) {
      if (!row?.app || !row?.version) continue;
      if (compareCalVer(row.version, FIRST_PUBLIC_VERSION) < 0) continue;
      const key = `${row.app}@${row.version}`;
      if (!rows.has(key)) rows.set(key, row);
    }
  } catch {
    console.error('generate-changelog-feed: prior index unparseable — regenerating from the tree alone');
  }
}

const index = [...rows.values()].sort(
  (a, b) =>
    (b.date ?? '').localeCompare(a.date ?? '') || compareCalVer(b.version, a.version) || a.app.localeCompare(b.app),
);

function writeView(name, view) {
  writeFileSync(path.join(outRoot, name), `${JSON.stringify(view, null, 2)}\n`);
}

mkdirSync(outRoot, { recursive: true });
writeView('index.json', index);
writeView('stable.json', index.filter((row) => row.channel === 'stable'));
writeView('beta.json', index.filter((row) => row.channel === 'beta'));
const streamViews = STREAMS.filter((stream) => index.some((row) => row.app === stream));
for (const stream of streamViews) {
  writeView(`${stream}.json`, index.filter((row) => row.app === stream));
}

// ── llms.txt (feed root) ─────────────────────────────────────────────
// Pointer file for AI agents (llmstxt.org): what this host serves and
// where the machine-readable release history lives. Regenerated with
// the feed on every tag, so the per-release links always reflect the
// published index. The daemon stream's public label is "Server".
const STREAM_LABELS = { desktop: 'Desktop', extension: 'Extension', cli: 'CLI', daemon: 'Server', web: 'Web' };
const noteLinks = index
  .filter((row) => row.md)
  .map((row) => `- [${STREAM_LABELS[row.app] ?? row.app} ${row.version}](${row.md}): JSON twin at ${row.json}`);
const llmsTxt = `# Open Headers

> Open Headers is a web development toolkit — a browser extension, desktop app, CLI, and server for modifying live browser requests, managing API collections, and collaborating with your team. This host (updates.openheaders.com) is its static update feed: version manifests and the release changelog as JSON and raw markdown. Streams are products: desktop, extension, cli, daemon (labeled "Server"), web.

## Changelog

- [All releases](${FEED_BASE}/index.json): every release across all streams, newest first; rows with prose notes carry \`md\` and \`json\` links
- [Stable releases](${FEED_BASE}/stable.json): channel view of the same index
- [Beta releases](${FEED_BASE}/beta.json): channel view of the same index
${streamViews.map((stream) => `- [${STREAM_LABELS[stream] ?? stream} releases](${FEED_BASE}/${stream}.json): per-product view`).join('\n')}

## Release notes

${noteLinks.join('\n')}

## Versions

- [Stable manifest](https://updates.openheaders.com/versions/stable.json): latest version, severity, and download URLs per product
- [Beta manifest](https://updates.openheaders.com/versions/beta.json): same shape for the beta channel

## Optional

- [Website](https://openheaders.com)
- [Changelog page](https://openheaders.com/changelog)
- [Public repository](https://github.com/OpenHeaders/open-headers)
`;
writeFileSync(path.join(outputDir, 'llms.txt'), llmsTxt);

console.error(`generate-changelog-feed: staged ${index.length} index rows for ${tag} in ${outputDir}`);
