/**
 * Merges the per-arch `latest-mac.yml` files the split macOS release
 * legs produce into the single feed file electron-updater reads. Each
 * electron-builder run writes an update-info file listing only the
 * arch it built; clients on both archs resolve from ONE
 * `latest-mac.yml`, so the release job unions the `files:` entries
 * before feed staging.
 *
 * Output mirrors electron-builder's own combined single-run shape:
 * x64 entries first and the top-level `path`/`sha512` naming the x64
 * asset, with arm64 clients selecting their file from the `files:`
 * list by name. A single input passes through byte-identical — the
 * beta lane builds arm64 only.
 *
 * Usage: node scripts/merge-mac-update-yml.mjs <output-file> <input-file>...
 */

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

function fail(message) {
  console.error(`merge-mac-update-yml: ${message}`);
  process.exit(1);
}

/**
 * The update-info files are machine-generated with a fixed two-level
 * shape (scalar top-level keys plus the `files:` list), so a
 * line-based parse keeps this dependency-free — the release job runs
 * root scripts without installing anything.
 */
function parseUpdateInfo(file) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const scalars = new Map();
  const entries = [];
  let inFiles = false;
  for (const line of lines) {
    if (/^files:\s*$/.test(line)) {
      inFiles = true;
      continue;
    }
    if (/^[A-Za-z]/.test(line)) {
      inFiles = false;
      const match = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
      if (match) scalars.set(match[1], match[2]);
      continue;
    }
    if (inFiles && line.trim() !== '') {
      if (/^ {2}- /.test(line)) {
        entries.push([line]);
      } else if (entries.length > 0) {
        entries[entries.length - 1].push(line);
      } else {
        fail(`${file}: files list starts with a continuation line`);
      }
    }
  }
  for (const key of ['version', 'path', 'sha512']) {
    if (!scalars.get(key)) fail(`${file}: missing top-level '${key}'`);
  }
  if (entries.length === 0) fail(`${file}: no files entries`);
  return { file, scalars, entries };
}

function entryUrl(entry) {
  const match = entry[0].match(/^ {2}- url:\s*(\S+)\s*$/);
  if (!match) fail(`unrecognized files entry line: ${entry[0]}`);
  return match[1];
}

const [output, ...inputs] = process.argv.slice(2);
if (!output || inputs.length === 0) {
  fail('usage: merge-mac-update-yml.mjs <output-file> <input-file>...');
}

mkdirSync(path.dirname(output), { recursive: true });

if (inputs.length === 1) {
  copyFileSync(inputs[0], output);
  console.log(`merge-mac-update-yml: single input — copied ${inputs[0]} to ${output}`);
  process.exit(0);
}

const docs = inputs.map(parseUpdateInfo);

const versions = new Set(docs.map((doc) => doc.scalars.get('version')));
if (versions.size > 1) {
  fail(`inputs disagree on version: ${[...versions].join(', ')}`);
}

// Base doc first: the one whose default `path` is not the arm64 asset,
// matching the x64-first ordering of electron-builder's own combined
// output. Its scalars (path, sha512, releaseDate) carry through.
const base = docs.find((doc) => !doc.scalars.get('path').includes('-arm64')) ?? docs[0];
const ordered = [base, ...docs.filter((doc) => doc !== base)];

const seen = new Map();
const merged = [];
for (const doc of ordered) {
  for (const entry of doc.entries) {
    const url = entryUrl(entry);
    const body = entry.join('\n');
    const prior = seen.get(url);
    if (prior === undefined) {
      seen.set(url, body);
      merged.push(entry);
    } else if (prior !== body) {
      // The same asset name with different hashes means two legs built
      // conflicting bytes — never publish a pointer over that.
      fail(`conflicting entries for ${url}`);
    }
  }
}

const out = [
  `version: ${base.scalars.get('version')}`,
  'files:',
  ...merged.flat(),
  `path: ${base.scalars.get('path')}`,
  `sha512: ${base.scalars.get('sha512')}`,
];
if (base.scalars.get('releaseDate')) out.push(`releaseDate: ${base.scalars.get('releaseDate')}`);

writeFileSync(output, `${out.join('\n')}\n`);
console.log(`merge-mac-update-yml: merged ${inputs.length} inputs (${merged.length} file entries) into ${output}`);
