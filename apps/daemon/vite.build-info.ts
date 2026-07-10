/**
 * Build metadata injected as `__BUILD_INFO__` — shared by the two
 * build configs (plain-Node bundles and the SEA bundle) so both
 * distributions stamp identically. Reading git is best-effort — dev
 * clones without git (rare) get placeholders instead of crashing the
 * build.
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface BuildInfo {
  version: string;
  commit: string;
  commitFull: string;
  build: number;
  date: string;
  channel: 'stable';
}

function git(cmd: string, cwd: string, fallback: string): string {
  try {
    return execSync(`git ${cmd}`, { cwd, encoding: 'utf8' }).trim();
  } catch {
    return fallback;
  }
}

export function readBuildInfo(packageDir: string): BuildInfo {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(packageDir, 'package.json'), 'utf8')) as { version: string };
  return {
    version: pkg.version,
    commit: git('rev-parse --short=7 HEAD', packageDir, '0000000'),
    commitFull: git('rev-parse HEAD', packageDir, '0'.repeat(40)),
    build: Number.parseInt(git('rev-list --count HEAD', packageDir, '0'), 10) || 0,
    date: new Date().toISOString(),
    channel: 'stable',
  };
}
