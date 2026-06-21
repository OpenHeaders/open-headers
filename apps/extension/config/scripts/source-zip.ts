/**
 * Creates a source code zip for Firefox AMO submission.
 * Firefox requires reviewable source when the extension is built/bundled.
 *
 * The extension is part of a pnpm monorepo and imports several workspace
 * packages (@openheaders/core, @openheaders/ui, @openheaders/oracle,
 * @openheaders/oracle-host-browser, @openheaders/rule-engine), so the
 * archive must be the WHOLE repository — an apps/extension-only zip won't
 * `pnpm install && build` standalone. Build steps live in the repo README
 * and the AMO reviewer notes (see apps/extension/STORE_SUBMISSION.md).
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

// Globs are matched against repo-root-relative paths. Excludes are limited
// to dependency installs, machine-generated build output, VCS/IDE/cache
// dirs, and release artifacts — everything a reviewer regenerates with
// `pnpm install` + a build. No hand-written source is excluded.
const EXCLUDE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/out/**', // electron-vite / build output
  '**/coverage/**',
  '**/releases/**',
  '**/.git/**',
  '**/.turbo/**',
  '**/.idea/**',
  '**/.vscode/**',
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
console.log(`  Excluding: node_modules, dist/out, .git, IDE files, releases\n`);

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
archive.glob('**/*', { cwd: REPO_ROOT, ignore: EXCLUDE, dot: true });
void archive.finalize();
