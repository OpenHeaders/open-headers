/**
 * The Safari release ritual (the Safari distribution plan §4 F7): build
 * the extension, derive the app's versions with the next upload ordinal,
 * archive the containing app with Xcode, then export it for App Store
 * Connect and upload it with an API key. Runs on a Mac with Xcode, like
 * the other three stores' local rituals.
 *
 * Environment:
 *   APPLE_TEAM_ID     the developer team that signs the archive
 *   ASC_KEY_PATH      the App Store Connect API key (.p8)
 *   ASC_KEY_ID        its key id
 *   ASC_ISSUER_ID     its issuer id
 *
 * Usage:
 *   pnpm run release:safari                 # build + version + archive + upload
 *   pnpm run release:safari -- --skip-build # archive the existing dist/safari
 *   pnpm run release:safari -- --no-upload  # export a signed .pkg locally, no upload
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SAFARI = path.join(ROOT, 'safari');
const PROJECT = path.join(SAFARI, 'OpenHeaders for Safari.xcodeproj');
const SCHEME = 'OpenHeaders for Safari';
const ARCHIVE_DIR = path.join(SAFARI, 'archive');
const ARCHIVE = path.join(ARCHIVE_DIR, 'OpenHeaders for Safari.xcarchive');
const EXPORT_DIR = path.join(ARCHIVE_DIR, 'export');

const skipBuild = process.argv.includes('--skip-build');
const upload = !process.argv.includes('--no-upload');

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`\n  ${name} is not set.\n`);
    process.exit(1);
  }
  return value;
}

function run(file: string, args: string[], cwd = ROOT): void {
  execFileSync(file, args, { cwd, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });
}

const teamId = env('APPLE_TEAM_ID');
const ascKeyPath = env('ASC_KEY_PATH');
const ascKeyId = env('ASC_KEY_ID');
const ascIssuerId = env('ASC_ISSUER_ID');

const authentication = [
  '-authenticationKeyPath',
  ascKeyPath,
  '-authenticationKeyID',
  ascKeyId,
  '-authenticationKeyIssuerID',
  ascIssuerId,
  '-allowProvisioningUpdates',
];

// ── Build ───────────────────────────────────────────────────────────

if (skipBuild) {
  console.log('  Skipping build (--skip-build)\n');
} else {
  console.log('  Building the Safari extension...\n');
  run('pnpm', ['run', 'build:safari']);
}

// ── Version (the ordinal burns on every attempt, uploaded or not) ───

run('pnpm', ['run', 'version:safari', '--', '--bump']);

// ── Archive ─────────────────────────────────────────────────────────

fs.rmSync(ARCHIVE_DIR, { recursive: true, force: true });
fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

console.log('\n  Archiving the containing app...\n');
run('xcodebuild', [
  '-project',
  PROJECT,
  '-scheme',
  SCHEME,
  '-configuration',
  'Release',
  '-archivePath',
  ARCHIVE,
  `DEVELOPMENT_TEAM=${teamId}`,
  ...authentication,
  'archive',
]);

// ── Export + upload ─────────────────────────────────────────────────

const exportOptions = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>app-store-connect</string>
	<key>destination</key>
	<string>${upload ? 'upload' : 'export'}</string>
	<key>teamID</key>
	<string>${teamId}</string>
	<key>signingStyle</key>
	<string>automatic</string>
	<key>uploadSymbols</key>
	<true/>
</dict>
</plist>
`;
const exportOptionsPath = path.join(ARCHIVE_DIR, 'ExportOptions.plist');
fs.writeFileSync(exportOptionsPath, exportOptions);

console.log(`\n  ${upload ? 'Uploading to App Store Connect' : 'Exporting the signed package'}...\n`);
run('xcodebuild', [
  '-exportArchive',
  '-archivePath',
  ARCHIVE,
  '-exportOptionsPlist',
  exportOptionsPath,
  '-exportPath',
  EXPORT_DIR,
  ...authentication,
]);

console.log(
  upload
    ? '\n  Uploaded. Commit safari/upload-ordinal.json with the release; the build appears in App Store Connect after processing.\n'
    : `\n  Exported to ${EXPORT_DIR}. The ordinal was burned for this attempt either way.\n`,
);
