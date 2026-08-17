/**
 * Creates a source code zip for Firefox AMO submission.
 * Firefox requires reviewable source when the extension is built/bundled.
 *
 * The archive is the MINIMAL subset of the monorepo that builds the
 * FIREFOX target only: the extension, the workspace packages in its
 * dependency closure, and the root manifests pnpm needs. Other apps,
 * other browsers' manifests, and internal tooling are not part of that
 * build and are not shipped to reviewers. The bundled pnpm-lock.yaml is
 * regenerated against just the shipped packages so it carries no other
 * importers. Build steps live in the AMO reviewer notes
 * (see apps/extension/STORE_SUBMISSION.md).
 *
 * Usage: npm run source-zip
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
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
const WORKSPACE_PACKAGES = [
  'apps/extension',
  'packages/core',
  'packages/i18n',
  'packages/oracle',
  'packages/oracle-host-browser',
  'packages/rule-engine',
  'packages/ui',
];

// pnpm-lock.yaml is NOT globbed from the repo: the repo lockfile spans
// the whole monorepo. A pruned lockfile covering only the shipped
// packages is generated and appended separately (see prunedLockfile).
const ROOT_MANIFESTS = [
  'package.json',
  'pnpm-workspace.yaml',
  'turbo.json',
  'tsconfig.base.json',
  'biome.json',
  '.npmrc',
  'README.md',
  'LICENSE',
  'NOTICE',
];

const INCLUDE = [...WORKSPACE_PACKAGES.map((pkg) => `${pkg}/**`), ...ROOT_MANIFESTS];

// Globs are matched against repo-root-relative paths. Excludes cover
// dependency installs, machine-generated build output, VCS/IDE/cache
// dirs, release artifacts, and content irrelevant to an AMO build
// review: test suites and their configs, prototypes, and store-process
// docs. Everything needed to `pnpm install` + build stays in.
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
  // Other browsers' manifests — the Firefox build only reads manifests/firefox.
  'apps/extension/manifests/chrome/**',
  'apps/extension/manifests/edge/**',
  'apps/extension/manifests/safari/**',
  // Internal tooling (release, build-report, this script) — pnpm does not
  // run pre/post hooks by default, so `build:firefox` never invokes these.
  'apps/extension/config/**',
  // Test suites and configs — not part of the extension build.
  '**/tests/**',
  '**/vitest.config.ts',
  'apps/extension/playwright.config.ts',
  'apps/extension/tsconfig.test.json',
  // Internal store-process docs and prototypes — not reviewer-relevant.
  'apps/extension/STORE_SUBMISSION.md',
  'apps/extension/docs/**',
  'apps/extension/prototypes/**',
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

/**
 * Regenerates pnpm-lock.yaml against only the shipped workspace packages.
 * The repo lockfile lists every monorepo importer; shipping it would
 * disclose the private package landscape. A skeleton workspace (root
 * manifests + shipped package.json files + the full lockfile as the
 * resolution source) is staged in a temp dir and `pnpm install
 * --lockfile-only` prunes it down to the shipped importers.
 */
function prunedLockfile(): string {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-source-zip-'));
  try {
    for (const file of ['package.json', 'pnpm-workspace.yaml', '.npmrc', 'pnpm-lock.yaml']) {
      fs.copyFileSync(path.join(REPO_ROOT, file), path.join(staging, file));
    }
    for (const pkg of WORKSPACE_PACKAGES) {
      fs.mkdirSync(path.join(staging, pkg), { recursive: true });
      fs.copyFileSync(path.join(REPO_ROOT, pkg, 'package.json'), path.join(staging, pkg, 'package.json'));
    }
    execFileSync('pnpm', ['install', '--lockfile-only', '--ignore-scripts'], { cwd: staging, stdio: 'pipe' });
    return fs.readFileSync(path.join(staging, 'pnpm-lock.yaml'), 'utf8');
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

// ── Main ────────────────────────────────────────────────────────────

fs.mkdirSync(RELEASES, { recursive: true });

const outputPath = path.join(RELEASES, `open-headers-source-v${VERSION}.zip`);
const output = fs.createWriteStream(outputPath);
const archive = archiver('zip', { zlib: { level: 9 } });

console.log(`\n  Firefox Source Zip  v${VERSION}`);
console.log(`  ${'─'.repeat(40)}`);
console.log(`  Root: ${REPO_ROOT}`);
console.log(`  Including: apps/extension + workspace dep packages + root manifests + pruned lockfile`);
console.log(
  `  Excluding: node_modules, build output, tests, prototypes, store docs, VCS/IDE files, releases, non-Firefox manifests, internal tooling\n`,
);

const lockfile = prunedLockfile();

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
archive.append(lockfile, { name: 'pnpm-lock.yaml' });
void archive.finalize();
