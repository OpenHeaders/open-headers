/**
 * Patches ONE app's entry in a versions manifest and prints the result
 * — the per-app-leg law (DISTRIBUTION_PLAN §3) for release lanes that
 * must not rewrite the whole manifest: the extension-only release
 * updates `extension.latest`/`tag`, the store-version cron updates
 * `extension.stores`, and every other entry rides through byte-exact.
 *
 * The patch deep-merges one level into the app's entry: top-level
 * fields replace, object fields (e.g. `stores`) merge key-wise so a
 * store whose lookup failed keeps its previous value.
 *
 * Usage: node scripts/patch-versions-entry.mjs <manifest-file> <app> <patch-json>
 * The manifest file may hold `{}` when the channel has no manifest yet.
 */

import { readFileSync } from 'node:fs';

function fail(message) {
  console.error(`patch-versions-entry: ${message}`);
  process.exit(1);
}

const [file, app, patchJson] = process.argv.slice(2);
if (!file || !app || !patchJson) fail('usage: patch-versions-entry.mjs <manifest-file> <app> <patch-json>');

let manifest;
let patch;
try {
  manifest = JSON.parse(readFileSync(file, 'utf8'));
} catch (err) {
  fail(`cannot read manifest: ${err instanceof Error ? err.message : err}`);
}
try {
  patch = JSON.parse(patchJson);
} catch {
  fail('patch is not valid JSON');
}
if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest)) fail('manifest is not an object');
if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) fail('patch is not an object');

const entry = { ...(manifest[app] ?? {}) };
for (const [key, value] of Object.entries(patch)) {
  const existing = entry[key];
  if (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof existing === 'object' &&
    existing !== null &&
    !Array.isArray(existing)
  ) {
    entry[key] = { ...existing, ...value };
  } else {
    entry[key] = value;
  }
}
manifest[app] = entry;

console.log(JSON.stringify(manifest, null, 2));
