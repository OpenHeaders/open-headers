/**
 * The files in the classic data folder that are not the app's.
 *
 * On Windows `oh` and the hosts keep a handful of files in
 * `%APPDATA%\openheaders`, and that is the classic install's data folder
 * `%APPDATA%\OpenHeaders` by another spelling. The folder's name is
 * shared, so the two rules that move the data between the classic
 * install and the Windows package tell those files apart: a folder that
 * holds nothing else holds none of the app's data, and the files stay
 * where `oh` reads them whichever way the data goes.
 *
 * Only a folder's own entries are read, and only whole files are moved —
 * by a rename each, within one volume.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONFIG_DIR_FILE_NAMES } from '@openheaders/core/cli-config';

/** Windows ignores case in a file's name. */
const SHARED_NAMES: ReadonlySet<string> = new Set(CONFIG_DIR_FILE_NAMES.map((name) => name.toLowerCase()));

export interface SharedConfigFiles {
  /** The shared files in the folder's root, by the names they have there. */
  readonly names: readonly string[];
  /** Whether the folder holds anything else. */
  readonly alone: boolean;
}

/** What a folder's root holds of the shared files. Null when the folder cannot be listed. */
export function readSharedConfigFiles(dir: string): SharedConfigFiles | null {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  const names = entries
    .filter((entry) => entry.isFile() && SHARED_NAMES.has(entry.name.toLowerCase()))
    .map((entry) => entry.name);
  return { names, alone: names.length === entries.length };
}

/**
 * Moves the named files from one folder's root to another's, making the
 * target folder when there is a file to put in it. Returns the names that
 * stayed where they were.
 */
export function moveSharedConfigFiles(fromDir: string, toDir: string, names: readonly string[]): string[] {
  const left: string[] = [];
  for (const name of names) {
    try {
      fs.mkdirSync(toDir, { recursive: true });
      fs.renameSync(path.join(fromDir, name), path.join(toDir, name));
    } catch {
      left.push(name);
    }
  }
  return left;
}
