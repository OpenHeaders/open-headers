/**
 * Release-channel bytecode step for the license-enforcement chunk.
 *
 * The main-process build emits every license-critical module (core
 * licensing, the seat gate, the license slot + refresh agent) as one
 * `dist-webpack/main/license-core.js` chunk in ALL builds. On the
 * release channel (`OH_DESKTOP_CHANNEL=release`, set only by the
 * release workflow) this script compiles that chunk to V8 bytecode
 * with the SAME Electron binary the build ships — bytecode is
 * V8-version-tied, so the system Node must never do the compile —
 * then replaces the chunk with a two-line stub that loads the `.jsc`
 * through bytenode. Every require edge into the chunk stays valid;
 * local and e2e builds keep the plain-JS chunk untouched.
 *
 * Dual-mode: invoked plain (from predist) it gates on the channel and
 * re-executes itself under `ELECTRON_RUN_AS_NODE=1`; invoked with
 * `--compile` it is already inside Electron and does the work.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const mainDir = path.join(__dirname, '..', '..', 'dist-webpack', 'main');
const chunkPath = path.join(mainDir, 'license-core.js');
const bytecodePath = path.join(mainDir, 'license-core.jsc');

if (process.argv.includes('--compile')) {
  const bytenode = require('bytenode');
  const source = fs.readFileSync(chunkPath, 'utf8');
  if (source.includes('license-core.jsc')) {
    throw new Error('license-core.js is already the loader stub — rebuild before recompiling');
  }
  bytenode.compileFile({ filename: chunkPath, output: bytecodePath, compileAsModule: true });
  const compiled = fs.statSync(bytecodePath).size;
  if (compiled === 0) {
    throw new Error('bytenode produced an empty license-core.jsc');
  }
  fs.writeFileSync(chunkPath, "'use strict';\nrequire('bytenode');\nmodule.exports = require('./license-core.jsc');\n");
  console.log(`Compiled license-core.js (${source.length} bytes) -> license-core.jsc (${compiled} bytes) + stub`);
  process.exit(0);
}

if (process.env.OH_DESKTOP_CHANNEL !== 'release') {
  console.log('compile-license-bytecode: not the release channel, keeping plain JS');
  process.exit(0);
}

if (!fs.existsSync(chunkPath)) {
  console.error('compile-license-bytecode: dist-webpack/main/license-core.js missing — chunking regressed');
  process.exit(1);
}

// require('electron') outside Electron resolves to the binary path.
const electron = require('electron');
execFileSync(electron, [__filename, '--compile'], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
});

const stub = fs.readFileSync(chunkPath, 'utf8');
if (!fs.existsSync(bytecodePath) || !stub.includes('license-core.jsc')) {
  console.error('compile-license-bytecode: compile step did not produce the bytecode + stub pair');
  process.exit(1);
}
