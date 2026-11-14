/**
 * Removal of a file from the working tree, with the directories it
 * leaves empty — as git itself removes a file: a directory is not
 * tracked, so one that holds nothing after the removal goes too, up to
 * the tree's root (never the root). A directory that still holds
 * anything, whoever put it there, stands.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

/** Remove the file at the repo-relative `filePath`; a file that is not there is no error. */
export async function removeWorkingFile(rootDir: string, filePath: string): Promise<void> {
  const root = path.resolve(rootDir);
  const target = path.join(root, ...filePath.split('/'));
  await fs.rm(target, { force: true });
  for (let dir = path.dirname(target); dir !== root && dir.startsWith(root); dir = path.dirname(dir)) {
    try {
      await fs.rmdir(dir);
    } catch {
      return;
    }
  }
}
