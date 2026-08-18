/**
 * Build the single-executable `oh-nm-host` binary with bun (`bun build
 * --compile`) — the same client-tier compile idiom as the CLI's
 * pack-bun (the distribution plan §6). One self-contained, signable
 * binary; the desktop app bundles it under its resources and points
 * every registered NM manifest at it.
 *
 * Verification drives the exact artifact through its wire contract: a
 * framed bootstrap request against an unreachable daemon port must
 * answer one framed `{ ok: false, reason: 'unreachable' }` message and
 * exit 0, and a garbage frame must exit non-zero without a response.
 *
 * Run via `pnpm --filter @openheaders/nm-host run pack:bun`. One
 * binary per platform/arch — run on the machine you target.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(packageRoot, 'dist-bun');

// Port etiquette: off default 8137, desktop mcp.spec 18137, T3 18238,
// daemon pack 18437, plain pack verify + daemon pack-sea 18537,
// pack-sea 18637, cli pack-bun 18737. Nothing listens here — the
// bootstrap probe must fail with `unreachable`.
const UNREACHABLE_PORT = 18837;

function fail(message) {
  console.error(`pack-bun: ${message}`);
  process.exit(1);
}

const bunProbe = spawnSync('bun', ['--version'], { encoding: 'utf-8' });
if (bunProbe.error || bunProbe.status !== 0) {
  fail('bun is not on PATH — install bun (https://bun.sh) to build the compiled `oh-nm-host` binary');
}
const bunVersion = bunProbe.stdout.trim();

// ── Compile ──────────────────────────────────────────────────────────

const binaryPath = path.join(outDir, process.platform === 'win32' ? 'oh-nm-host.exe' : 'oh-nm-host');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const build = spawnSync(
  'bun',
  ['build', '--compile', '--minify', '--bytecode', '--outfile', binaryPath, path.join('src', 'nm-host.ts')],
  { cwd: packageRoot, stdio: 'inherit' },
);
if (build.status !== 0) fail(`bun build exited ${build.status}`);
if (!existsSync(binaryPath)) fail(`bun build produced no binary at ${binaryPath}`);

// ── Verify: the binary honors its wire contract ──────────────────────

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

const sizeMb = (statSync(binaryPath).size / (1024 * 1024)).toFixed(1);
console.log('pack-bun: verified — unreachable refusal framed, garbage frame refused');
console.log(`pack-bun: binary ${binaryPath} (${sizeMb} MB, ${process.platform}-${process.arch}, bun ${bunVersion})`);
