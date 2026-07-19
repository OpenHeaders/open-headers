/**
 * Post-build report — prints size breakdown for all built browsers.
 * Runs automatically via the `postbuild` npm hook.
 *
 * Also enforces per-surface size budgets. The popup / sidepanel are
 * expected to stay lean; if a future change drags a heavy module
 * (Monaco, prettier, etc.) into their transitive chunk graph, this
 * script exits non-zero so CI fails the build.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DIST = path.join(ROOT, 'dist');
const BROWSERS = ['chrome', 'firefox', 'edge', 'safari'] as const;

// Per-entry JS budget (uncompressed bytes, including transitive chunks).
// Surfaces that must NOT pull Monaco / prettier / other heavy modules.
// Values have ~10% headroom over the current measured size so normal
// growth is fine; a regression that drags Monaco (~4 MB) blows through.
//
// Rebased 2026-07: each i18n locale catalog (~1 MB of string literals,
// statically imported by catalog-registry into every surface) plus panel
// feature growth moved the floor. Budgets carry headroom for several more
// locales. Per-family catalog loading can win most of that back —
// budgets tighten again when it lands.
const JS_BUDGETS_KB: Record<string, number> = {
  popup: 6144,
  sidepanel: 6144,
  // Panel's first paint is the request list. Monaco-backed CodeViewer
  // is behind React.lazy + Suspense in TextBodyViewer / PreviewView, so
  // it only loads when a user expands a text response body. Budget
  // tracks the static graph, not the dynamic one.
  panel: 7680,
  delay: 2100,
  devtools: 50,
};

interface FileInfo {
  name: string;
  size: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function getFiles(dir: string, prefix = ''): FileInfo[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: FileInfo[] = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...getFiles(path.join(dir, entry.name), rel));
    } else {
      files.push({ name: rel, size: fs.statSync(path.join(dir, entry.name)).size });
    }
  }
  return files;
}

/**
 * Extract every STATIC `../chunks/X.js` reference from a built JS file.
 * We care about what loads on first paint — not chunks reached through
 * dynamic `import()` (those load on demand). Static imports look like
 * `import"../chunks/x.js"` or `from"../chunks/x.js"`; dynamic imports
 * have a `(` between `import` and the string literal, which the
 * negative lookahead rules out.
 */
function extractChunkRefs(code: string): string[] {
  const refs = new Set<string>();
  const re = /(?:from|\bimport(?!\s*\())\s*["']\.\.\/chunks\/([A-Za-z0-9_.-]+\.js)["']/g;
  for (const m of code.matchAll(re)) {
    const name = m[1];
    if (name) refs.add(name);
  }
  return [...refs];
}

/**
 * Walk the static chunk graph from an entry file and return the
 * transitive size in bytes (entry + every reachable chunk, each
 * counted once).
 */
function measureEntryJs(jsRoot: string, entryRel: string): { total: number; chunks: string[] } | null {
  const entryAbs = path.join(jsRoot, entryRel);
  if (!fs.existsSync(entryAbs)) return null;

  const chunksDir = path.join(jsRoot, 'chunks');
  const visited = new Set<string>();
  let total = fs.statSync(entryAbs).size;

  const queue: string[] = extractChunkRefs(fs.readFileSync(entryAbs, 'utf8'));
  while (queue.length > 0) {
    const name = queue.shift();
    if (!name || visited.has(name)) continue;
    visited.add(name);
    const abs = path.join(chunksDir, name);
    if (!fs.existsSync(abs)) continue;
    total += fs.statSync(abs).size;
    for (const next of extractChunkRefs(fs.readFileSync(abs, 'utf8'))) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  return { total, chunks: [...visited].sort() };
}

function printBrowserReport(browser: string): boolean {
  const distDir = path.join(DIST, browser);
  if (!fs.existsSync(distDir)) {
    console.log(`  ${browser.padEnd(8)} skipped (not built)`);
    return true;
  }

  const manifestPath = path.join(distDir, 'manifest.json');
  let version = '?';
  if (fs.existsSync(manifestPath)) {
    try {
      version = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).version;
    } catch {
      /* ignore */
    }
  }

  const files = getFiles(distDir);
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  const jsFiles = files.filter((f) => f.name.endsWith('.js'));
  const cssFiles = files.filter((f) => f.name.endsWith('.css'));
  const jsSize = jsFiles.reduce((sum, f) => sum + f.size, 0);
  const cssSize = cssFiles.reduce((sum, f) => sum + f.size, 0);
  const otherSize = totalSize - jsSize - cssSize;

  console.log(
    `  ${browser.padEnd(8)} v${version}  ${formatSize(totalSize).padStart(10)}  (JS ${formatSize(jsSize)}, CSS ${formatSize(cssSize)}, other ${formatSize(otherSize)})`,
  );

  // Largest JS files overall (chunks + entries)
  const sorted = jsFiles.sort((a, b) => b.size - a.size).slice(0, 5);
  for (const f of sorted) {
    console.log(`           ${formatSize(f.size).padStart(10)}  ${f.name}`);
  }

  // Per-surface budget check — transitive JS reachable from each entry
  const jsRoot = path.join(distDir, 'js');
  const failures: string[] = [];
  console.log(`           ${'─'.repeat(48)}`);
  for (const [entry, budgetKb] of Object.entries(JS_BUDGETS_KB)) {
    const measured = measureEntryJs(jsRoot, `${entry}/index.js`);
    if (!measured) continue;
    const budget = budgetKb * 1024;
    const overBudget = measured.total > budget;
    const marker = overBudget ? '✗' : '✓';
    const budgetStr = `(budget ${formatSize(budget)})`;
    console.log(`         ${marker} ${entry.padEnd(10)} ${formatSize(measured.total).padStart(10)}  ${budgetStr}`);
    if (overBudget) {
      const delta = measured.total - budget;
      failures.push(
        `${entry} is ${formatSize(delta)} over budget (${formatSize(measured.total)} > ${formatSize(budget)})`,
      );
    }
  }

  if (failures.length > 0) {
    console.log();
    console.log(`  ✗ ${browser} exceeds JS budget:`);
    for (const f of failures) console.log(`      ${f}`);
    return false;
  }
  return true;
}

// ── Main ────────────────────────────────────────────────────────────

console.log('\n  Build Report');
console.log(`  ${'─'.repeat(60)}`);

let anyBuilt = false;
let ok = true;
for (const browser of BROWSERS) {
  if (fs.existsSync(path.join(DIST, browser))) {
    anyBuilt = true;
    if (!printBrowserReport(browser)) ok = false;
    console.log();
  }
}

if (!anyBuilt) {
  console.log('  No builds found. Run `npm run build` first.\n');
}

if (!ok) {
  process.exit(1);
}
