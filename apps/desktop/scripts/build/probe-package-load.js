/**
 * Load check for a packaged desktop build — every release leg runs it
 * on its unpacked app before anything is signed or uploaded.
 *
 * Two things in a package are compiled for one arch and are needed
 * before the app can start: the license chunk's bytecode (the main
 * entry's first require) and the better-sqlite3 binary the app picks.
 * Both are loaded here INSIDE the package's own runtime, so a package
 * whose runtime rejects either fails its leg instead of shipping. The
 * runtime's arch is checked against the leg's target first: the load
 * only proves something on the arch the package is for.
 *
 * The terminal's native binaries are loaded too. The app starts without
 * them, so a package that lost them to a file filter would otherwise
 * ship and fail at the first terminal.
 *
 * A macOS bundle is also walked for Mach-O files with no slice for the
 * target's arch. None is ever one the package loads, and macOS warns
 * the user of an Apple Silicon app that carries Intel-only code (a
 * dependency's prebuilt binaries for every platform did that).
 *
 * Dual-mode, like the bytecode step: invoked plain with the builder's
 * output directory and the leg's target it finds the unpacked app and
 * re-executes itself under that app's own binary with
 * `ELECTRON_RUN_AS_NODE=1` — the app itself is never started; invoked
 * with `--inside` it is already in that runtime and does the loads.
 *
 *   node scripts/build/probe-package-load.js <output dir> <target>
 *
 * Targets are the distribution matrix's six (`mac-arm64`, `mac-x64`,
 * `win-x64`, `win-arm64`, `linux-x64`, `linux-arm64`).
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function fail(message) {
  console.error(`probe-package-load: ${message}`);
  process.exit(1);
}

if (process.argv[2] === '--inside') {
  const [resources, expectedArch] = process.argv.slice(3);
  let failed = 0;
  const report = (ok, line) => {
    if (!ok) failed += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${line}`);
  };
  const firstLine = (error) => String(error.message).split('\n')[0].slice(0, 200);

  console.log(
    `runtime: ${process.platform}-${process.arch} abi ${process.versions.modules} electron ${process.versions.electron}`,
  );
  report(process.arch === expectedArch, `the runtime's arch is the target's (${process.arch}, target ${expectedArch})`);

  const chunk = path.join(resources, 'app.asar', 'dist-webpack', 'main', 'license-core.js');
  try {
    const loaded = require(chunk);
    report(true, `license chunk loads (${Object.keys(loaded).length} exports)`);
  } catch (error) {
    report(false, `license chunk: ${firstLine(error)}`);
  }

  // The app's own choice (`openSqliteDatabase`): the stash keyed for
  // this process when the package carries one, the package default
  // otherwise.
  const sqliteDir = path.join(resources, 'app.asar', 'node_modules', 'better-sqlite3');
  const stash = path.join(
    sqliteDir,
    'prebuilds',
    `better_sqlite3-${process.platform}-${process.arch}-abi${process.versions.modules}.node`,
  );
  const binding = fs.existsSync(stash) ? stash : null;
  const bindingName = binding ? `the stash ${path.basename(binding)}` : 'the package default';
  try {
    const Database = require(sqliteDir);
    new Database(':memory:', binding ? { nativeBinding: binding } : {}).close();
    report(true, `database opens (${bindingName})`);
  } catch (error) {
    report(false, `database (${bindingName}): ${firstLine(error)}`);
  }

  // Through the module's own loader, so its search order decides.
  const ptyDir = path.join(resources, 'app.asar', 'node_modules', 'node-pty');
  const ptyBinaries = process.platform === 'win32' ? ['conpty', 'conpty_console_list'] : ['pty'];
  try {
    const { loadNativeModule } = require(path.join(ptyDir, 'lib', 'utils.js'));
    for (const name of ptyBinaries) loadNativeModule(name);
    report(true, `terminal binaries load (${ptyBinaries.join(', ')})`);
  } catch (error) {
    report(false, `terminal binaries: ${firstLine(error)}`);
  }

  process.exit(failed === 0 ? 0 : 1);
}

const { build } = require('../../package.json');

/** Where the builder leaves a target's unpacked app, its binary and its resources. */
function packageLayout(outputDir, target) {
  const [os, arch] = target.split('-');
  if (!['mac', 'win', 'linux'].includes(os) || !['x64', 'arm64'].includes(arch)) {
    fail(`unknown target '${target}' — expected <mac|win|linux>-<x64|arm64>`);
  }
  if (os === 'mac') {
    const bundle = path.join(outputDir, arch === 'x64' ? 'mac' : 'mac-arm64', `${build.productName}.app`);
    const contents = path.join(bundle, 'Contents');
    return {
      arch,
      bundle,
      binary: path.join(contents, 'MacOS', build.productName),
      resources: path.join(contents, 'Resources'),
    };
  }
  const unpacked = path.join(outputDir, arch === 'x64' ? `${os}-unpacked` : `${os}-arm64-unpacked`);
  const binaryName = os === 'win' ? `${build.productName}.exe` : build.linux.executableName;
  return { arch, binary: path.join(unpacked, binaryName), resources: path.join(unpacked, 'resources') };
}

const MACH_O_CPU = { x64: 0x01000007, arm64: 0x0100000c };

/** The cpu types a Mach-O file holds code for; null when the file is not one. */
function machOCpuTypes(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(8);
    if (fs.readSync(fd, head, 0, 8, 0) < 8) return null;
    const magic = head.readUInt32BE(0);
    // One arch, little-endian (64-bit, then 32-bit).
    if (magic === 0xcffaedfe || magic === 0xcefaedfe) return [head.readUInt32LE(4)];
    // Universal: a big-endian table of slices, 20 bytes each (32 in the 64-bit form).
    if (magic === 0xcafebabe || magic === 0xcafebabf) {
      const count = head.readUInt32BE(4);
      // A Java class file opens with the same four bytes; its next field is a version, never this small.
      if (count === 0 || count > 16) return null;
      const entrySize = magic === 0xcafebabe ? 20 : 32;
      const table = Buffer.alloc(count * entrySize);
      if (fs.readSync(fd, table, 0, table.length, 8) < table.length) return null;
      return Array.from({ length: count }, (_, index) => table.readUInt32BE(index * entrySize));
    }
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

/** Every Mach-O file under `dir` with no slice for `arch`, as paths relative to `dir`. */
function machOFilesWithoutArch(dir, arch) {
  const foreign = [];
  const pending = [dir];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
      } else if (entry.isFile()) {
        const cpuTypes = machOCpuTypes(entryPath);
        if (cpuTypes !== null && !cpuTypes.includes(MACH_O_CPU[arch])) foreign.push(path.relative(dir, entryPath));
      }
    }
  }
  return foreign.sort();
}

const [outputDir, target] = process.argv.slice(2);
if (!outputDir || !target) fail('usage: probe-package-load.js <output dir> <target>');

const { arch, bundle, binary, resources } = packageLayout(path.resolve(outputDir), target);
if (!fs.existsSync(binary)) fail(`no unpacked ${target} app at ${binary}`);

console.log(`probe-package-load: ${target} — ${binary}`);
const foreign = bundle ? machOFilesWithoutArch(bundle, arch) : [];
if (bundle) {
  console.log(`${foreign.length === 0 ? 'PASS' : 'FAIL'}  every Mach-O file in the bundle has code for ${arch}`);
  for (const file of foreign) console.log(`      ${file}`);
}

const result = spawnSync(binary, [__filename, '--inside', resources, arch], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  timeout: 120_000,
});
if (result.error) {
  // A package whose run-as-node fuse is off starts the app here instead
  // of the script, and never answers.
  fail(`the ${target} package did not run the check: ${result.error.message}`);
}
if (result.status !== 0) fail(`the ${target} package does not load (exit ${result.status ?? result.signal})`);
if (foreign.length > 0) fail(`the ${target} bundle holds ${foreign.length} Mach-O file(s) with no code for ${arch}`);
console.log(`probe-package-load: the ${target} package loads`);
