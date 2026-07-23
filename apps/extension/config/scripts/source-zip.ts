/**
 * Creates a source code zip for Firefox AMO submission.
 * Firefox requires reviewable source when the extension is built/bundled.
 *
 * The archive is the MINIMAL buildable subset of the monorepo: the
 * extension, the workspace packages in its dependency closure, and the
 * root manifests pnpm needs. Other apps (desktop, cli, daemon, workers)
 * are not part of the extension build and are not shipped to reviewers.
 * Build steps live in the AMO reviewer notes
 * (see apps/extension/STORE_SUBMISSION.md).
 *
 * Usage: npm run source-zip
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const EXT_ROOT = path.resolve(SCRIPT_DIR, '../..'); // apps/extension
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../../../..'); // monorepo root
const RELEASES = path.join(EXT_ROOT, 'releases');
const VERSION: string = JSON.parse(fs.readFileSync(path.join(EXT_ROOT, 'package.json'), 'utf8')).version;

// The buildable subset: the extension, its workspace dependency closure
// (extension → core, i18n, oracle, oracle-host-browser, rule-engine, ui;
// ui → core + i18n; oracle-host-browser → core + oracle), and the root
// manifests pnpm/turbo need to install and build.
const INCLUDE = [
  'apps/extension/**',
  'packages/core/**',
  'packages/i18n/**',
  'packages/oracle/**',
  'packages/oracle-host-browser/**',
  'packages/rule-engine/**',
  'packages/ui/**',
  'package.json',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  'turbo.json',
  'tsconfig.base.json',
  'biome.json',
  '.npmrc',
  'README.md',
  'LICENSE.md',
];

// Globs are matched against repo-root-relative paths. Excludes are limited
// to dependency installs, machine-generated build output, VCS/IDE/cache
// dirs, and release artifacts — everything a reviewer regenerates with
// `pnpm install` + a build. No hand-written source is excluded.
const EXCLUDE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/dist-*/**', // dist-sea, dist-bun, dist-webpack — compiled binaries and bundles
  '**/out/**', // electron-vite / build output
  '**/*.bun-build', // bun compile temp artifacts
  '**/coverage/**',
  '**/releases/**',
  '**/.git/**',
  '**/.turbo/**',
  '**/.idea/**',
  '**/.vscode/**',
  '**/.devtools-profile/**', // playground browser profile
  '**/.wrangler/**',
  '**/playwright-report/**',
  '**/test-results/**',
  // Xcode project for the Safari wrapper — large and not part of the build.
  'apps/extension/manifests/safari/xcode_project/**',
  '**/.DS_Store',
  '**/*.log',
  '**/*.zip',
  '**/*.crx',
  '**/*.pem',
  '**/*.tgz',
  '**/.env*',
  '**/.eslintcache',
];

// ── Helpers ─────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(2)} MB`;
}

// ── Main ────────────────────────────────────────────────────────────

fs.mkdirSync(RELEASES, { recursive: true });

const outputPath = path.join(RELEASES, `open-headers-source-v${VERSION}.zip`);
const output = fs.createWriteStream(outputPath);
const archive = archiver('zip', { zlib: { level: 9 } });

console.log(`\n  Firefox Source Zip  v${VERSION}`);
console.log(`  ${'─'.repeat(40)}`);
console.log(`  Root: ${REPO_ROOT}`);
console.log(`  Including: apps/extension + workspace dep packages + root manifests`);
console.log(`  Excluding: node_modules, build output, VCS/IDE files, releases\n`);

output.on('close', () => {
  console.log(`  Created  ${formatSize(archive.pointer()).padStart(10)}  ${path.basename(outputPath)}`);
  console.log(`  Output: ${RELEASES}\n`);
});

archive.on('error', (err: Error) => {
  console.error('  Failed:', err.message, '\n');
  process.exit(1);
});

archive.on('warning', (err: Error & { code?: string }) => {
  if (err.code !== 'ENOENT') throw err;
});

archive.pipe(output);
for (const pattern of INCLUDE) {
  archive.glob(pattern, { cwd: REPO_ROOT, ignore: EXCLUDE, dot: true });
}
void archive.finalize();
