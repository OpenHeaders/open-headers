/**
 * Build the single-executable `oh-nm-host` binary with bun (`bun build
 * --compile`) — the same client-tier compile idiom as the CLI's
 * pack-bun (the distribution plan §6). One self-contained, signable
 * binary; the desktop app bundles it under its resources and points
 * every registered NM manifest at it.
 *
 * Takes an optional distribution-matrix target (`mac-arm64`, `mac-x64`,
 * `win-x64`, `win-arm64`, `linux-x64`, `linux-arm64` — the
 * build-h3-helper vocabulary); no argument compiles for the host. A
 * release leg passes its own target, which is its runner's own; the
 * other arch of the same OS still compiles from one machine.
 *
 * Verification drives a host-target artifact through its wire
 * contract: a framed bootstrap request against an unreachable daemon
 * port must answer one framed `{ ok: false, reason: 'unreachable' }`
 * message and exit 0, and a garbage frame must exit non-zero without a
 * response. A Windows artifact is then run once more from a
 * shipped-shaped folder against a live listener, which is the only
 * place the helper's listener check — and its in-process image-name
 * call — runs. A cross-target artifact cannot execute here, so its
 * executable header is asserted against the requested platform + arch
 * instead — a wrong-arch binary fails the build rather than shipping.
 */

import { spawnSync } from 'node:child_process';
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readSync,
  rmSync,
  statSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(packageRoot, 'dist-bun');

/** target name → bun compile triple + expected header identity — the six-target matrix. */
const TARGETS = {
  'mac-arm64': { triple: 'bun-darwin-arm64', platform: 'darwin', arch: 'arm64' },
  'mac-x64': { triple: 'bun-darwin-x64', platform: 'darwin', arch: 'x64' },
  'win-x64': { triple: 'bun-windows-x64', platform: 'win32', arch: 'x64' },
  'win-arm64': { triple: 'bun-windows-arm64', platform: 'win32', arch: 'arm64' },
  'linux-x64': { triple: 'bun-linux-x64', platform: 'linux', arch: 'x64' },
  'linux-arm64': { triple: 'bun-linux-arm64', platform: 'linux', arch: 'arm64' },
};

function hostTarget() {
  const os = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'win' : 'linux';
  return `${os}-${process.arch}`;
}

// Port etiquette: off default 8137, desktop mcp.spec 18137, T3 18238,
// daemon pack 18437, plain pack verify + daemon pack-sea 18537,
// pack-sea 18637, cli pack-bun 18737. Nothing listens here — the
// bootstrap probe must fail with `unreachable`.
const UNREACHABLE_PORT = 18837;

/** The helper's listener check starts PowerShell twice at worst, ten seconds each. */
const SHIPPED_PROBE_TIMEOUT_MS = 60_000;

function fail(message) {
  console.error(`pack-bun: ${message}`);
  process.exit(1);
}

const target = process.argv[2] ?? hostTarget();
if (!TARGETS[target]) fail(`unknown target '${target}' — expected one of ${Object.keys(TARGETS).join(', ')}`);
const crossTarget = target !== hostTarget();

const bunProbe = spawnSync('bun', ['--version'], { encoding: 'utf-8' });
if (bunProbe.error || bunProbe.status !== 0) {
  fail('bun is not on PATH — install bun (https://bun.sh) to build the compiled `oh-nm-host` binary');
}
const bunVersion = bunProbe.stdout.trim();

// ── Compile ──────────────────────────────────────────────────────────

const binaryPath = path.join(outDir, TARGETS[target].platform === 'win32' ? 'oh-nm-host.exe' : 'oh-nm-host');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const build = spawnSync(
  'bun',
  [
    'build',
    '--compile',
    '--minify',
    '--bytecode',
    `--target=${TARGETS[target].triple}`,
    '--outfile',
    binaryPath,
    path.join('src', 'nm-host.ts'),
  ],
  { cwd: packageRoot, stdio: 'inherit' },
);
if (build.status !== 0) fail(`bun build exited ${build.status}`);
if (!existsSync(binaryPath)) fail(`bun build produced no binary at ${binaryPath}`);

// ── Verify: header identity (cross) or wire contract (host) ──────────

function readAt(fd, length, position) {
  const buffer = Buffer.alloc(length);
  readSync(fd, buffer, 0, length, position);
  return buffer;
}

// A cross-compiled binary cannot run on this host — assert the
// executable header instead: the container format and machine type
// must match the requested target.
function verifyBinaryHeader() {
  const { platform, arch } = TARGETS[target];
  const fd = openSync(binaryPath, 'r');
  try {
    if (platform === 'darwin') {
      const header = readAt(fd, 8, 0);
      if (header.readUInt32LE(0) !== 0xfeedfacf) fail('binary is not a 64-bit Mach-O executable');
      const cputype = header.readUInt32LE(4);
      const expected = arch === 'arm64' ? 0x0100000c : 0x01000007;
      if (cputype !== expected) fail(`Mach-O cputype 0x${cputype.toString(16)} does not match target ${target}`);
    } else if (platform === 'linux') {
      const header = readAt(fd, 20, 0);
      if (header.readUInt32BE(0) !== 0x7f454c46) fail('binary is not an ELF executable');
      const machine = header.readUInt16LE(18);
      const expected = arch === 'arm64' ? 0xb7 : 0x3e;
      if (machine !== expected) fail(`ELF machine 0x${machine.toString(16)} does not match target ${target}`);
    } else {
      const dosHeader = readAt(fd, 0x40, 0);
      if (dosHeader.readUInt16LE(0) !== 0x5a4d) fail('binary is not a PE executable (no MZ header)');
      const peHeader = readAt(fd, 6, dosHeader.readUInt32LE(0x3c));
      if (peHeader.readUInt32LE(0) !== 0x00004550) fail('binary is not a PE executable (no PE signature)');
      const machine = peHeader.readUInt16LE(4);
      const expected = arch === 'arm64' ? 0xaa64 : 0x8664;
      if (machine !== expected) fail(`PE machine 0x${machine.toString(16)} does not match target ${target}`);
    }
  } finally {
    closeSync(fd);
  }
}

function frame(value) {
  const json = Buffer.from(JSON.stringify(value), 'utf-8');
  const out = Buffer.allocUnsafe(4 + json.length);
  out.writeUInt32LE(json.length, 0);
  json.copy(out, 4);
  return out;
}

function parseFrames(buffer) {
  const messages = [];
  let offset = 0;
  while (buffer.length - offset >= 4) {
    const length = buffer.readUInt32LE(offset);
    if (buffer.length - offset - 4 < length) break;
    messages.push(JSON.parse(buffer.subarray(offset + 4, offset + 4 + length).toString('utf-8')));
    offset += 4 + length;
  }
  return messages;
}

if (crossTarget) {
  verifyBinaryHeader();
  console.log(`pack-bun: verified — cross-target header matches ${target}; wire probes skipped (cannot run here)`);
} else {
  const unreachable = spawnSync(binaryPath, [], {
    input: frame({ kind: 'bootstrap', url: `ws://127.0.0.1:${UNREACHABLE_PORT}` }),
  });
  if (unreachable.status !== 0) fail(`unreachable probe exited ${unreachable.status}`);
  const responses = parseFrames(unreachable.stdout);
  if (responses.length !== 1) fail(`unreachable probe answered ${responses.length} frames, expected 1`);
  if (responses[0].ok !== false || responses[0].reason !== 'unreachable') {
    fail(`unreachable probe answered ${JSON.stringify(responses[0])}, expected unreachable refusal`);
  }

  const garbage = spawnSync(binaryPath, [], { input: Buffer.from([0xff, 0xff, 0xff, 0xff, 0x00]) });
  if (garbage.status === 0) fail('garbage frame exited 0, expected a protocol-error exit');
  if (garbage.stdout.length !== 0) fail('garbage frame produced a response, expected silence');
  console.log('pack-bun: verified — unreachable refusal framed, garbage frame refused');
  if (TARGETS[target].platform === 'win32') await verifyShippedListenerCheck();
}

// The dev layout skips the listener check, so the probes above never
// reach the in-process image-name call. From a shipped-shaped folder
// (`<root>/resources/nm-host/`) a bootstrap against a live listener
// runs the whole check: this script's own process holds the port, it
// lies outside the folder, and the helper must read that and refuse.
async function verifyShippedListenerCheck() {
  const root = mkdtempSync(path.join(tmpdir(), 'oh-nm-host-shipped-'));
  const server = createServer();
  try {
    const shippedBinary = path.join(root, 'resources', 'nm-host', path.basename(binaryPath));
    mkdirSync(path.dirname(shippedBinary), { recursive: true });
    copyFileSync(binaryPath, shippedBinary);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const { port } = server.address();
    const shipped = spawnSync(shippedBinary, [], {
      input: frame({ kind: 'bootstrap', url: `ws://127.0.0.1:${port}` }),
      timeout: SHIPPED_PROBE_TIMEOUT_MS,
    });
    const stderr = shipped.stderr.toString('utf-8').trim();
    if (shipped.status !== 0) fail(`shipped-layout probe exited ${shipped.status}: ${stderr}`);
    const responses = parseFrames(shipped.stdout);
    if (responses.length !== 1) fail(`shipped-layout probe answered ${responses.length} frames, expected 1`);
    if (responses[0].ok !== false || responses[0].reason !== 'refused') {
      fail(`shipped-layout probe answered ${JSON.stringify(responses[0])}, expected a refusal`);
    }
    if (!stderr.includes('outside install root')) {
      fail(`shipped-layout probe did not read the listener's program: ${stderr}`);
    }
    console.log(`pack-bun: verified — shipped-layout listener check refused a foreign listener (${stderr})`);
  } finally {
    server.close();
    rmSync(root, { recursive: true, force: true });
  }
}

const sizeMb = (statSync(binaryPath).size / (1024 * 1024)).toFixed(1);
console.log(`pack-bun: binary ${binaryPath} (${sizeMb} MB, ${target}, bun ${bunVersion})`);
