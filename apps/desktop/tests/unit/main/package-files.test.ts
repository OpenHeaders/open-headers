/**
 * The package's file filter for the native modules: their sources and
 * the compiler's intermediates stay out, every binary and every script
 * a module runs stays in. The paths are real ones, read from a Windows
 * and a macOS package. Dependency files are matched the way the builder
 * matches them: a permissive first pattern, then every exclusion of
 * `build.files`, the last matching pattern deciding.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_DIR = path.resolve(__dirname, '../../..');

interface Pattern {
  negate: boolean;
  match(file: string): boolean;
}
interface MinimatchModule {
  Minimatch: new (pattern: string, options: { dot: boolean }) => Pattern;
}
interface BuildConfig {
  build: { files: string[] };
}

// The builder's own matcher, at the version the builder uses.
const builderRequire = createRequire(createRequire(path.join(APP_DIR, 'noop.js')).resolve('app-builder-lib'));
const { Minimatch }: MinimatchModule = builderRequire('minimatch');

const { build }: BuildConfig = JSON.parse(readFileSync(path.join(APP_DIR, 'package.json'), 'utf8'));
const patterns = ['**/*', ...build.files.filter((pattern) => pattern.startsWith('!'))].map(
  (pattern) => new Minimatch(pattern, { dot: true }),
);

function packed(file: string): boolean {
  let match = false;
  for (const pattern of patterns) {
    if (match !== pattern.negate) continue;
    match = pattern.match(file);
  }
  return match;
}

const KEPT = [
  'node_modules/better-sqlite3/package.json',
  'node_modules/better-sqlite3/lib/database.js',
  'node_modules/better-sqlite3/build/Release/better_sqlite3.node',
  'node_modules/better-sqlite3/bin/win32-arm64-149/better-sqlite3.node',
  'node_modules/better-sqlite3/prebuilds/better_sqlite3-win32-arm64-abi149.node',
  'node_modules/better-sqlite3/prebuilds/better_sqlite3-darwin-arm64-abi149.node',
  'node_modules/node-pty/package.json',
  'node_modules/node-pty/lib/index.js',
  'node_modules/node-pty/lib/worker/conoutSocketWorker.js',
  'node_modules/node-pty/build/Release/pty.node',
  'node_modules/node-pty/build/Release/spawn-helper',
  'node_modules/node-pty/build/Release/conpty.node',
  'node_modules/node-pty/build/Release/conpty_console_list.node',
  'node_modules/node-pty/build/Release/winpty-agent.exe',
  'node_modules/node-pty/build/Release/winpty.dll',
  'node_modules/node-pty/third_party/conpty/1.23.251008001/win10-arm64/OpenConsole.exe',
  'node_modules/node-pty/third_party/conpty/1.23.251008001/win10-arm64/conpty.dll',
  'node_modules/@openheaders/windows-foreground/index.js',
  'node_modules/@openheaders/windows-foreground/binding.js',
  'node_modules/@openheaders/windows-foreground/build/Release/foreground.node',
  'node_modules/@openheaders/process-reader/build/Release/process_reader.node',
  'node_modules/@openheaders/windows-process-reader/build/Release/windows_process_reader.node',
];

const LEFT_OUT = [
  'node_modules/better-sqlite3/deps/sqlite3/sqlite3.c',
  'node_modules/better-sqlite3/deps/sqlite3.gyp',
  'node_modules/better-sqlite3/src/better_sqlite3.cpp',
  'node_modules/better-sqlite3/build/Release/obj/gen/sqlite3/sqlite3.c',
  'node_modules/better-sqlite3/build/Release/obj/global_intermediate/sqlite3/sqlite3.c',
  'node_modules/better-sqlite3/build/Release/obj/better_sqlite3/better_sqlite3.tlog/CL.read.1.tlog',
  'node_modules/better-sqlite3/build/Release/better_sqlite3.iobj',
  'node_modules/better-sqlite3/build/Release/better_sqlite3.ipdb',
  'node_modules/better-sqlite3/build/Release/better_sqlite3.exp',
  'node_modules/better-sqlite3/build/Release/sqlite3.lib',
  'node_modules/better-sqlite3/build/better_sqlite3.vcxproj',
  'node_modules/better-sqlite3/build/better_sqlite3.vcxproj.filters',
  'node_modules/better-sqlite3/build/deps/sqlite3.Makefile',
  'node_modules/better-sqlite3/build/deps/Release/obj/sqlite3/sqlite3.tlog/CL.read.1.tlog',
  'node_modules/node-pty/deps/.editorconfig',
  'node_modules/node-pty/src/unixTerminal.ts',
  'node_modules/node-pty/build/pty.vcxproj',
  'node_modules/node-pty/build/Release/pty.ipdb',
  'node_modules/node-pty/build/Release/winpty-agent.iobj',
  'node_modules/node-pty/build/Release/winpty.lib',
  'node_modules/node-pty/build/Release/obj/pty/pty.tlog/CL.read.1.tlog',
  'node_modules/node-pty/build/deps/winpty/src/winpty-agent.vcxproj',
  'node_modules/@openheaders/windows-foreground/src/common.h',
  'node_modules/@openheaders/windows-foreground/build/foreground.vcxproj',
  'node_modules/@openheaders/windows-foreground/build/Release/foreground.iobj',
  'node_modules/@openheaders/windows-foreground/build/Release/obj/foreground/foreground.tlog/link.read.1.tlog',
  'node_modules/@openheaders/windows-process-reader/build/Release/windows_process_reader.lib',
];

describe('the package file filter for native modules', () => {
  it.each(KEPT)('packs %s', (file) => {
    expect(packed(file)).toBe(true);
  });

  it.each(LEFT_OUT)('leaves out %s', (file) => {
    expect(packed(file)).toBe(false);
  });
});
