/**
 * Whether git wrote the working tree across a stretch of time.
 *
 * A git command that replaces a file of the working tree removes it and
 * creates it anew, so for an instant the file is not there. Every such
 * command — checkout, merge, reset, stash, restore — holds the index's
 * lock from before its first file to after its last, and leaves a new
 * index behind. So a stretch that ends with no lock held and with the
 * index it began with met none of them; any other may have read a tree
 * half written.
 *
 * A lock this process holds is a pass of our own (`index-lock.ts`): no
 * other git process writes the tree under it, and the pass waits for
 * every command it runs. Nothing is met under it.
 */

import { promises as fs } from 'node:fs';
import { resolveGitDirs } from './git-dir';
import { holdsIndexLock, realIndexPath } from './index-lock';

export interface TreeWritesWatch {
  /** True when another git process holds the index's lock now, or replaced the index since the watch began. */
  met(): Promise<boolean>;
}

async function stampOf(file: string): Promise<string | null> {
  try {
    const stat = await fs.stat(file, { bigint: true });
    return `${stat.ino}:${stat.mtimeNs}:${stat.size}`;
  } catch {
    return null;
  }
}

/** Begin watching `rootDir`'s index. A folder with no repo has neither a lock nor an index: nothing is ever met. */
export async function watchTreeWrites(rootDir: string): Promise<TreeWritesWatch> {
  const indexPath = await realIndexPath((await resolveGitDirs(rootDir)).gitDir);
  const lockPath = `${indexPath}.lock`;
  const began = await stampOf(indexPath);
  return {
    // The lock FIRST: a command that ends between the two looks is then seen by its new index.
    met: async () =>
      !holdsIndexLock(lockPath) && ((await stampOf(lockPath)) !== null || (await stampOf(indexPath)) !== began),
  };
}
