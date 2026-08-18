/**
 * THIRD-PARTY-NOTICES generator — one aggregated notices file per
 * shipped artifact (audit finding: bundled deps and fonts shipped
 * without their license texts).
 *
 * Walks the production dependency closure of one or more app dirs the
 * way the bundlers do: `dependencies` + `optionalDependencies` of each
 * package, plus `@openheaders/*` entries wherever they are declared
 * (desktop keeps its workspace packages in devDependencies but bundles
 * them). Workspace packages are traversed but not emitted — only
 * external packages get an entry, each with its bundled license text
 * (LICENSE/LICENCE/COPYING file from the installed package) or a
 * fallback note naming the declared SPDX id and author.
 *
 * Missing optional deps are skipped (e.g. the win32-only native module
 * on a mac runner), which keeps the output per-platform-correct when a
 * release leg generates its own file.
 *
 * The vendored Press Start 2P face (OFL text lives beside the woff2 in
 * packages/ui) is appended whenever @openheaders/ui is in the closure.
 *
 * Usage: node scripts/generate-third-party-notices.mjs --out <file> <appDir...>
 * App dirs resolve against the repo root.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdirSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
if (outIndex === -1 || outIndex + 1 >= args.length) {
  console.error('Usage: node scripts/generate-third-party-notices.mjs --out <file> <appDir...>');
  process.exit(1);
}
const outFile = path.resolve(repoRoot, args[outIndex + 1]);
const appDirs = args.filter((_, i) => i !== outIndex && i !== outIndex + 1);
if (appDirs.length === 0) {
  console.error('generate-third-party-notices: at least one app dir is required');
  process.exit(1);
}

const LICENSE_FILE_PATTERN = /^(license|licence|copying)(\.(txt|md|markdown))?$/i;
const WORKSPACE_SCOPE = '@openheaders/';

function readManifest(dir) {
  return JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
}

function findLicenseText(dir) {
  for (const entry of readdirSync(dir)) {
    if (LICENSE_FILE_PATTERN.test(entry)) {
      return readFileSync(path.join(dir, entry), 'utf8').trim();
    }
  }
  return null;
}

function licenseId(manifest) {
  const license = manifest.license;
  if (typeof license === 'string') return license;
  if (license && typeof license.type === 'string') return license.type;
  return 'UNKNOWN';
}

function authorLine(manifest) {
  const author = manifest.author;
  if (typeof author === 'string') return author;
  if (author && typeof author.name === 'string') return author.name;
  return null;
}

/** name@version → { name, version, license, text } for external packages. */
const collected = new Map();
/** Workspace package names seen during traversal (drives the vendored-font entry). */
const workspaceSeen = new Set();
/** realpath dirs already traversed, so shared deps walk once. */
const visitedDirs = new Set();

function depNames(manifest) {
  const names = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ]);
  for (const name of Object.keys(manifest.devDependencies ?? {})) {
    if (name.startsWith(WORKSPACE_SCOPE)) names.add(name);
  }
  return names;
}

function walk(fromDir, manifest) {
  const require = createRequire(path.join(fromDir, 'noop.js'));
  for (const name of depNames(manifest)) {
    let depDir;
    try {
      depDir = realpathSync(path.dirname(require.resolve(`${name}/package.json`)));
    } catch {
      // Unresolvable = an optional dep skipped on this platform, or a
      // package whose exports hide package.json — resolve via the
      // package root walk-up as a fallback before giving up.
      depDir = resolvePackageRoot(fromDir, name);
      if (!depDir) continue;
    }
    let depManifest = readManifest(depDir);
    if (depManifest.name !== name) {
      // An exports map can alias `<pkg>/package.json` to a nested stub
      // (e.g. a dist/cjs type marker) — walk up to the real package root.
      depDir = resolvePackageRoot(fromDir, name);
      if (!depDir) continue;
      depManifest = readManifest(depDir);
    }
    if (visitedDirs.has(depDir)) continue;
    visitedDirs.add(depDir);
    if (name.startsWith(WORKSPACE_SCOPE)) {
      workspaceSeen.add(name);
    } else {
      const key = `${depManifest.name}@${depManifest.version}`;
      if (!collected.has(key)) {
        collected.set(key, {
          name: depManifest.name,
          version: depManifest.version,
          license: licenseId(depManifest),
          author: authorLine(depManifest),
          text: findLicenseText(depDir),
        });
      }
    }
    walk(depDir, depManifest);
  }
}

function resolvePackageRoot(fromDir, name) {
  let dir = fromDir;
  while (true) {
    const candidate = path.join(dir, 'node_modules', ...name.split('/'));
    if (existsSync(path.join(candidate, 'package.json'))) return realpathSync(candidate);
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

for (const appDir of appDirs) {
  const dir = path.resolve(repoRoot, appDir);
  walk(dir, readManifest(dir));
}

const entries = [...collected.values()].sort((a, b) => a.name.localeCompare(b.name));

const RULE = '='.repeat(72);
const sections = entries.map((entry) => {
  const header = `${entry.name} ${entry.version} — ${entry.license}`;
  const body =
    entry.text ??
    [
      `License: ${entry.license}.`,
      entry.author ? `Copyright ${entry.author}.` : null,
      'This package ships without a license file; the standard text of the license named above applies.',
    ]
      .filter(Boolean)
      .join(' ');
  return `${RULE}\n${header}\n${RULE}\n\n${body}\n`;
});

if (workspaceSeen.has('@openheaders/ui')) {
  const oflPath = path.join(repoRoot, 'packages/ui/src/assets/fonts/OFL.txt');
  const oflText = readFileSync(oflPath, 'utf8').trim();
  sections.push(`${RULE}\nPress Start 2P (vendored font) — OFL-1.1\n${RULE}\n\n${oflText}\n`);
}

const header = [
  'THIRD-PARTY SOFTWARE NOTICES',
  '',
  'This artifact bundles the third-party packages listed below. Each entry',
  'reproduces the license text shipped with the package.',
  '',
  '',
].join('\n');

mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, header + sections.join('\n'));
console.log(
  `third-party notices: ${entries.length} packages${workspaceSeen.has('@openheaders/ui') ? ' + 1 vendored font' : ''} → ${path.relative(repoRoot, outFile)}`,
);
