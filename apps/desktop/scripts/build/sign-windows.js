/**
 * Authenticode signing for the Windows desktop packages, through Azure
 * Artifact Signing — one implementation for every file a release signs.
 *
 * Two callers:
 *
 * - The release leg, on the unpacked app before its installers are
 *   packaged: every PE file in the tree that carries no signature is
 *   signed — the executables, the native addons, the runtime's own
 *   libraries. A file its vendor already signed keeps that signature.
 *
 *     node scripts/build/sign-windows.js <unpacked dir>
 *
 * - The builder, as its signing hook (`win.signtoolOptions.sign`), for
 *   the files that only exist while it packages: the elevation helper
 *   it copies into the tree, the uninstaller it generates, the
 *   installers themselves. The hook signs only under `OH_WIN_SIGN=1`;
 *   every other build (local, the unsigned lanes, the ARM runner, where
 *   signing does not run) leaves the files as they are.
 *
 * `--list <dir>` prints every PE file under a folder and
 * `--list-unsigned <dir>` the ones with no signature; the leg's
 * signature check reads the first.
 *
 * Signing needs the three `AZURE_*` credentials and the account's three
 * `WIN_SIGN_*` identifiers in the environment. Every signature is
 * timestamped: the service's certificates live a few days, and an
 * untimestamped signature dies with its certificate.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SIGNING_ENV = [
  'AZURE_TENANT_ID',
  'AZURE_CLIENT_ID',
  'AZURE_CLIENT_SECRET',
  'WIN_SIGN_ENDPOINT',
  'WIN_SIGN_ACCOUNT',
  'WIN_SIGN_PROFILE',
];

// Microsoft's signing module, at one version: installed on first use,
// loaded at that version on every use.
const MODULE_VERSION = '0.1.8';
const SIGN_COMMAND = [
  "$ErrorActionPreference = 'Stop'",
  "$ProgressPreference = 'SilentlyContinue'",
  `if (-not (Get-Module -ListAvailable -Name ArtifactSigning | Where-Object { $_.Version -eq '${MODULE_VERSION}' })) {`,
  `  Install-Module -Name ArtifactSigning -RequiredVersion ${MODULE_VERSION} -Force -Repository PSGallery -Scope CurrentUser`,
  '}',
  `Import-Module ArtifactSigning -RequiredVersion ${MODULE_VERSION}`,
  [
    'Invoke-ArtifactSigning',
    '-Endpoint $env:WIN_SIGN_ENDPOINT',
    '-CodeSigningAccountName $env:WIN_SIGN_ACCOUNT',
    '-CertificateProfileName $env:WIN_SIGN_PROFILE',
    '-Files $env:OH_SIGN_FILES',
    '-FileDigest SHA256',
    '-TimestampRfc3161 http://timestamp.acs.microsoft.com',
    '-TimestampDigest SHA256',
  ].join(' '),
].join('\n');

/**
 * `signed` or `unsigned` for a PE image, null for any other file. The
 * signature lives in the certificate table — the fifth data directory
 * of the optional header — so an empty entry there is an unsigned file.
 */
function peSignatureState(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const dos = Buffer.alloc(64);
    if (fs.readSync(fd, dos, 0, dos.length, 0) < dos.length || dos.readUInt16LE(0) !== 0x5a4d) return null;
    // The PE signature (4 bytes), the COFF header (20), then the
    // optional header as far as the certificate table's entry.
    const head = Buffer.alloc(24 + 112 + 5 * 8);
    const read = fs.readSync(fd, head, 0, head.length, dos.readUInt32LE(0x3c));
    if (read < 26 || head.readUInt32LE(0) !== 0x00004550) return null;
    const magic = head.readUInt16LE(24);
    // The directories start 96 bytes into a 32-bit optional header, 112 into a 64-bit one.
    const directories = magic === 0x20b ? 24 + 112 : magic === 0x10b ? 24 + 96 : null;
    if (directories === null) return null;
    const certificateTable = directories + 4 * 8;
    if (read < certificateTable + 8) return null;
    const directoryCount = head.readUInt32LE(directories - 4);
    return directoryCount > 4 && head.readUInt32LE(certificateTable + 4) > 0 ? 'signed' : 'unsigned';
  } finally {
    fs.closeSync(fd);
  }
}

/** Every PE file under `dir` with its signature state, sorted by path. */
function peFiles(dir) {
  const found = [];
  const pending = [dir];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
      } else if (entry.isFile()) {
        const state = peSignatureState(entryPath);
        if (state !== null) found.push({ file: entryPath, state });
      }
    }
  }
  return found.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}

function signFiles(files) {
  const missing = SIGNING_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) throw new Error(`sign-windows: cannot sign without ${missing.join(', ')}`);
  for (const file of files) console.log(`sign-windows: signing ${file}`);
  // Encoded, so no shell or argument quoting stands between this script and PowerShell.
  const encoded = Buffer.from(SIGN_COMMAND, 'utf16le').toString('base64');
  execFileSync('pwsh', ['-NoProfile', '-NonInteractive', '-OutputFormat', 'Text', '-EncodedCommand', encoded], {
    stdio: 'inherit',
    env: { ...process.env, OH_SIGN_FILES: files.join(',') },
  });
}

/** The builder's signing hook: one file per call. */
async function sign(configuration) {
  if (process.env.OH_WIN_SIGN !== '1') return;
  signFiles([configuration.path]);
  if (peSignatureState(configuration.path) === 'unsigned') {
    throw new Error(`sign-windows: ${configuration.path} carries no signature after signing`);
  }
}

function fail(message) {
  console.error(`sign-windows: ${message}`);
  process.exit(1);
}

function main([first, second]) {
  const listing = first === '--list' || first === '--list-unsigned';
  const dir = listing ? second : first;
  if (!dir) fail('usage: sign-windows.js [--list | --list-unsigned] <dir>');
  const root = path.resolve(dir);
  if (!fs.existsSync(root)) fail(`no folder at ${root}`);
  const all = peFiles(root);

  if (listing) {
    for (const { file, state } of all) {
      if (first === '--list' || state === 'unsigned') console.log(file);
    }
    return;
  }

  // A wrong folder must not pass as a tree with nothing left to sign.
  if (all.length === 0) fail(`no PE file under ${root}`);
  const unsigned = all.filter(({ state }) => state === 'unsigned').map(({ file }) => file);
  console.log(`sign-windows: ${unsigned.length} of ${all.length} PE files under ${root} carry no signature`);
  if (unsigned.length === 0) return;
  try {
    signFiles(unsigned);
  } catch (error) {
    fail(error.message.replace(/^sign-windows: /, ''));
  }
  const left = peFiles(root).filter(({ state }) => state === 'unsigned');
  for (const { file } of left) console.error(`sign-windows: still unsigned: ${file}`);
  if (left.length > 0) fail(`${left.length} PE file(s) under ${root} carry no signature after signing`);
  console.log(`sign-windows: every PE file under ${root} is signed`);
}

module.exports = { default: sign };

if (require.main === module) main(process.argv.slice(2));
