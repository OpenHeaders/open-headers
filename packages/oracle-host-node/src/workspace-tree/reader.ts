/**
 * Filesystem tree reader — walks a bound workspace folder into the
 * flat `TreeFile[]` shape core's `readWorkspaceTree` consumes
 * (the git-sync plan §3.1 rung 2: on any external change the tree is truth;
 * this is the read half the cold-boot sweep and the watcher slice
 * both ride).
 *
 * `.oh/` and `.git/` are never walked; everything else is handed to
 * the core reader, which ignores files matching no entity convention.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  OH_SIDECAR_DIR,
  readWorkspaceTree,
  type TreeFile,
  type TreeReadResult,
} from '@openheaders/core/workspace-tree';

const SKIPPED_DIRS: ReadonlySet<string> = new Set([OH_SIDECAR_DIR, '.git']);

/** Collect the tree's files (workspace-relative `/`-separated paths, sorted). */
export async function listWorkspaceTreeFiles(rootDir: string): Promise<TreeFile[]> {
  const out: TreeFile[] = [];
  await walk(rootDir, '', out);
  out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return out;
}

/** Read a bound workspace tree from disk into a snapshot + unknowns + issues. */
export async function readWorkspaceTreeFromDisk(rootDir: string): Promise<TreeReadResult> {
  return readWorkspaceTree(await listWorkspaceTreeFiles(rootDir));
}

async function walk(absDir: string, relDir: string, out: TreeFile[]): Promise<void> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const rel = relDir === '' ? entry.name : `${relDir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (relDir === '' && SKIPPED_DIRS.has(entry.name)) continue;
      await walk(path.join(absDir, entry.name), rel, out);
    } else if (entry.isFile()) {
      const content = await readListed(path.join(absDir, entry.name));
      if (content !== null) out.push({ path: rel, content });
    }
  }
}

/** A listed file's text; null when it went between the listing and the read — it is then not of the tree. */
async function readListed(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') return null;
    throw err;
  }
}
