import * as path from 'node:path';

/** Explicit repo addressing prefix for every command (the git-sync plan §7). */
export function repoArgs(rootDir: string): string[] {
  return ['--git-dir', path.join(rootDir, '.git'), '--work-tree', rootDir];
}
