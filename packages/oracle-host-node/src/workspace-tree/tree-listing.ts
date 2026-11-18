/**
 * The names of a bound folder — every file under it, and not one read.
 *
 * A bound folder holds whatever its owner keeps there: builds,
 * dependencies, media. What of it is the tree's is decided from the
 * names (`treeDocumentPaths`), so the walk opens no file.
 *
 * `.oh/` and `.git/` are never walked. A link is neither followed nor
 * listed, whatever it points at — on Windows a junction is one too. A
 * directory gone between its parent's listing and its own is not of the
 * tree; one that would not list still stands, and is named: nothing
 * beneath it is known, least of all that it is gone.
 */

import { type Dirent, promises as fs } from 'node:fs';
import * as path from 'node:path';
import { OH_SIDECAR_DIR, type TreeUnread } from '@openheaders/core/workspace-tree';
import { failureCode, isGone } from '../git';

const SKIPPED_DIRS: ReadonlySet<string> = new Set([OH_SIDECAR_DIR, '.git']);

export interface TreeNames {
  /** Every file, workspace-relative with `/` separators. */
  files: string[];
  /** The directories that would not list. */
  unlisted: TreeUnread[];
}

export async function listTreeNames(rootDir: string): Promise<TreeNames> {
  const names: TreeNames = { files: [], unlisted: [] };
  await walk(rootDir, '', names);
  return names;
}

async function walk(absDir: string, relDir: string, names: TreeNames): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(absDir, { withFileTypes: true });
  } catch (err) {
    const code = failureCode(err);
    if (isGone(code)) return;
    names.unlisted.push({ path: relDir, cause: 'unlisted', ...(code !== undefined ? { code } : {}) });
    return;
  }
  for (const entry of entries) {
    const rel = relDir === '' ? entry.name : `${relDir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (relDir === '' && SKIPPED_DIRS.has(entry.name)) continue;
      await walk(path.join(absDir, entry.name), rel, names);
    } else if (entry.isFile()) {
      names.files.push(rel);
    }
  }
}
