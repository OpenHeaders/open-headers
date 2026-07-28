/**
 * Regenerates the flagship repo's top-level `CHANGELOG.md` from the
 * canonical `changelog/` tree (CHANGELOG_PLAN.md §4.2): one interleaved
 * timeline, newest first, each line app-labeled, prose entries linked
 * to their in-repo file (the flagship commit carries the same tree
 * layout, so relative links render on GitHub). Entries whose living
 * file is still `channel: beta` are marked as such. Prints to stdout.
 *
 * Usage: node scripts/generate-flagship-changelog.mjs > CHANGELOG.md
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareCalVer, parseFrontmatter } from './lib/changelog.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const changelogDir = path.join(repoRoot, 'changelog');

const APP_LABELS = { desktop: 'Desktop', extension: 'Extension', cli: 'CLI', daemon: 'Daemon', web: 'Web' };

function fail(message) {
  console.error(`generate-flagship-changelog: ${message}`);
  process.exit(1);
}

const rows = [];
for (const stream of readdirSync(changelogDir)) {
  const streamDir = path.join(changelogDir, stream);
  if (!statSync(streamDir).isDirectory()) continue;
  for (const year of readdirSync(streamDir)) {
    const yearDir = path.join(streamDir, year);
    if (!statSync(yearDir).isDirectory()) continue;
    for (const file of readdirSync(yearDir)) {
      if (!file.endsWith('.md')) continue;
      const entryPath = path.join(yearDir, file);
      const { fields, body, errors } = parseFrontmatter(readFileSync(entryPath, 'utf8'));
      if (errors.length > 0) fail(`${path.relative(repoRoot, entryPath)}: ${errors[0]} (run scripts/lint-changelog.mjs)`);
      rows.push({
        stream,
        version: fields.version,
        date: fields.date,
        channel: fields.channel,
        prose: body.trim() !== '',
        link: `changelog/${stream}/${year}/${file}`,
      });
    }
  }
}

rows.sort(
  (a, b) =>
    (b.date ?? '').localeCompare(a.date ?? '') ||
    compareCalVer(b.version, a.version) ||
    a.stream.localeCompare(b.stream),
);

const lines = [
  '# Changelog',
  '',
  'All Open Headers release notes, every app, newest first. Full entries',
  'live under [`changelog/`](changelog/); download artifacts are on the',
  '[releases page](https://github.com/OpenHeaders/open-headers/releases).',
  '',
];
for (const row of rows) {
  const label = `**${APP_LABELS[row.stream] ?? row.stream} ${row.version}**`;
  const beta = row.channel === 'beta' ? ' *(beta)*' : '';
  const notes = row.prose ? ` — [release notes](${row.link})` : '';
  lines.push(`- **${row.date}** · ${label}${beta}${notes}`);
}
process.stdout.write(`${lines.join('\n')}\n`);
