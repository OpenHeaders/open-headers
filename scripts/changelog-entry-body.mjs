/**
 * Prints one canonical entry's body with asset refs resolved to the
 * feed's absolute URLs — the GitHub release-body projection
 * (the changelog plan §4.2). Prints nothing (exit 0) when the entry is
 * missing or a frontmatter-only stub: the entry-existence law makes a
 * notes-free release legitimate, so the caller appends only when there
 * is prose.
 *
 * Usage: node scripts/changelog-entry-body.mjs <stream> <version>
 */

import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STREAMS, parseFrontmatter } from './lib/changelog.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FEED_BASE = 'https://updates.openheaders.com/changelog';

function fail(message) {
  console.error(`changelog-entry-body: ${message}`);
  process.exit(1);
}

const [stream, version] = process.argv.slice(2);
if (!STREAMS.includes(stream)) fail(`expected a stream (${STREAMS.join(', ')}), got '${stream}'`);
if (!/^\d{4}\.\d{1,2}\.\d+$/.test(version ?? '')) fail(`expected a base CalVer version, got '${version}'`);

const entryPath = path.join(repoRoot, 'changelog', stream, version.split('.')[0], `${version}.md`);
if (!existsSync(entryPath)) process.exit(0);

const { body, errors } = parseFrontmatter(readFileSync(entryPath, 'utf8'));
if (errors.length > 0) fail(`${path.relative(repoRoot, entryPath)}: ${errors[0]} (run scripts/lint-changelog.mjs)`);
if (body.trim() === '') process.exit(0);

process.stdout.write(`${body.trim().replaceAll('](./assets/', `](${FEED_BASE}/assets/${stream}/`)}\n`);
