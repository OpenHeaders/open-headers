/**
 * Changelog-tree lint — the canonical-entry gate (CHANGELOG_PLAN.md §2).
 *
 * For every entry under `changelog/<stream>/<year>/<version>.md`,
 * verifies the canonical-form laws:
 *   - the stream dir is one of the five product streams
 *   - the filename is exactly the frontmatter `version`, and the year
 *     folder is the version's year (no month folders, no zero-padding)
 *   - frontmatter carries `version`, `date`, `channel`, `severity`;
 *     `date` is YYYY-MM-DD, `channel` ∈ {stable, beta},
 *     `severity` ∈ {normal, security}
 *   - `highlights`, when present, is a non-empty list of strings
 *   - `apps`, when present, appears only in the desktop stream
 *   - asset refs in the body are relative (`./assets/<version>/…`)
 *
 * Frontmatter-only stubs (no body) are legitimate — backfill law
 * (§6): indexes stay machine-complete even where prose is not.
 *
 * Usage: node scripts/lint-changelog.mjs [<stream>...]
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const changelogDir = path.join(repoRoot, 'changelog');

const STREAMS = new Set(['desktop', 'extension', 'cli', 'daemon', 'web']);
const CHANNELS = new Set(['stable', 'beta']);
const SEVERITIES = new Set(['normal', 'security']);
const REQUIRED_FIELDS = ['version', 'date', 'channel', 'severity'];
const VERSION_RE = /^\d{4}\.\d{1,2}\.\d+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const problems = [];

function problem(file, message) {
  problems.push(`${path.relative(repoRoot, file)}: ${message}`);
}

/**
 * Minimal parser for the frontmatter subset the plan prescribes:
 * scalar `key: value`, one-level string lists, and inline maps
 * (`apps: { server: 2026.7.27 }`). Anything fancier is a lint error —
 * the machine layer stays this simple on purpose.
 */
function parseFrontmatter(file, text) {
  if (!text.startsWith('---\n')) {
    problem(file, 'missing frontmatter opening ---');
    return null;
  }
  const end = text.indexOf('\n---', 4);
  if (end < 0) {
    problem(file, 'missing frontmatter closing ---');
    return null;
  }
  const fields = {};
  let listKey = null;
  for (const line of text.slice(4, end).split('\n')) {
    if (line.trim() === '') continue;
    const listItem = line.match(/^\s+- (.*)$/);
    if (listItem) {
      if (!listKey) {
        problem(file, `list item outside a list: ${line.trim()}`);
        return null;
      }
      fields[listKey].push(listItem[1].trim());
      continue;
    }
    const pair = line.match(/^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/);
    if (!pair) {
      problem(file, `unparseable frontmatter line: ${line.trim()}`);
      return null;
    }
    const [, key, value] = pair;
    if (value === '') {
      listKey = key;
      fields[key] = [];
    } else {
      listKey = null;
      fields[key] = value;
    }
  }
  return { fields, body: text.slice(end + 4).replace(/^-*\n?/, '') };
}

function lintEntry(stream, year, file) {
  const name = path.basename(file, '.md');
  const parsed = parseFrontmatter(file, readFileSync(file, 'utf8'));
  if (!parsed) return;
  const { fields, body } = parsed;

  for (const field of REQUIRED_FIELDS) {
    if (fields[field] === undefined) problem(file, `missing required field: ${field}`);
  }
  const { version, date, channel, severity, highlights, apps } = fields;

  if (typeof version === 'string') {
    if (!VERSION_RE.test(version)) problem(file, `version is not CalVer YYYY.M.PATCH: ${version}`);
    if (version !== name) problem(file, `filename does not match version: ${name}.md vs ${version}`);
    if (version.split('.')[0] !== year) problem(file, `year folder ${year} does not match version ${version}`);
  }
  if (typeof date === 'string' && !DATE_RE.test(date)) problem(file, `date is not YYYY-MM-DD: ${date}`);
  if (typeof channel === 'string' && !CHANNELS.has(channel)) problem(file, `channel not in {stable, beta}: ${channel}`);
  if (typeof severity === 'string' && !SEVERITIES.has(severity)) {
    problem(file, `severity not in {normal, security}: ${severity}`);
  }
  if (highlights !== undefined) {
    if (!Array.isArray(highlights) || highlights.length === 0) {
      problem(file, 'highlights must be a non-empty list');
    } else if (highlights.some((h) => h === '')) {
      problem(file, 'highlights contains an empty item');
    }
  }
  if (apps !== undefined && stream !== 'desktop') problem(file, `apps field is desktop-only (stream: ${stream})`);

  for (const ref of body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = ref[1];
    if (/^[a-z]+:\/\//.test(target) || target.startsWith('/')) {
      problem(file, `asset ref must be relative (./assets/<version>/…): ${target}`);
    } else if (!target.startsWith(`./assets/${name}/`)) {
      problem(file, `asset ref outside ./assets/${name}/: ${target}`);
    }
  }
}

const streamFilter = process.argv.slice(2);
let entries = 0;
for (const stream of readdirSync(changelogDir)) {
  const streamDir = path.join(changelogDir, stream);
  if (!statSync(streamDir).isDirectory()) continue;
  if (!STREAMS.has(stream)) {
    problem(streamDir, `unknown stream (expected one of: ${[...STREAMS].join(', ')})`);
    continue;
  }
  if (streamFilter.length > 0 && !streamFilter.includes(stream)) continue;
  for (const year of readdirSync(streamDir)) {
    const yearDir = path.join(streamDir, year);
    if (!statSync(yearDir).isDirectory()) continue;
    if (!/^\d{4}$/.test(year)) {
      problem(yearDir, 'expected a year folder (no month level)');
      continue;
    }
    for (const file of readdirSync(yearDir)) {
      if (file === 'assets') continue;
      if (!file.endsWith('.md')) {
        problem(path.join(yearDir, file), 'unexpected non-entry file');
        continue;
      }
      entries += 1;
      lintEntry(stream, year, path.join(yearDir, file));
    }
  }
}

if (problems.length > 0) {
  for (const line of problems) console.error(`lint-changelog: ${line}`);
  process.exit(2);
}
console.log(`lint-changelog: ${entries} entries OK`);
