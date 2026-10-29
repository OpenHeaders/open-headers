/**
 * Gitfile-aware repo-directory resolution (the git-sync plan §3.4
 * layouts). A bound folder's `.git` entry is a DIRECTORY in a plain
 * clone and a one-line FILE (`gitdir: <path>`) in a linked worktree or
 * a submodule checkout. Git itself resolves the file wherever the
 * plane passes `--git-dir <root>/.git` (§7), so every command path
 * already works on both layouts; the plane's own FILESYSTEM probes do
 * not, and resolve here instead:
 *
 *   - `gitDir` is the per-working-tree directory — HEAD, the index and
 *     every in-progress marker (MERGE_HEAD, rebase-merge, …) live
 *     here; in a linked worktree it is `<main>/.git/worktrees/<name>`;
 *   - `commonDir` is the shared directory — objects, refs and
 *     `info/exclude`; it equals `gitDir` outside a linked worktree and
 *     is named by the worktree's `commondir` file inside one.
 *
 * The parse mirrors git's `read_gitfile`: the path after `gitdir: `
 * is taken verbatim, relative paths resolved against the folder that
 * holds the gitfile. A folder with no `.git` entry resolves to the
 * directory a `git init` would create, so probes simply find nothing.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export interface GitDirs {
  /** Per-working-tree git directory: HEAD, index and in-progress markers. */
  gitDir: string;
  /** Shared git directory: objects, refs, `info/exclude`. */
  commonDir: string;
}

const GITFILE_PREFIX = 'gitdir:';

/** The directory a gitfile names, resolved against the folder holding it; null when the content is not a gitfile. */
export function parseGitfile(content: string, holderDir: string): string | null {
  const line = content.split('\n')[0]?.trim() ?? '';
  if (!line.startsWith(GITFILE_PREFIX)) return null;
  const target = line.slice(GITFILE_PREFIX.length).trim();
  if (target.length === 0) return null;
  return path.resolve(holderDir, target);
}

async function readTrimmed(filePath: string): Promise<string | null> {
  try {
    return (await fs.readFile(filePath, 'utf-8')).trim();
  } catch {
    return null;
  }
}

export async function resolveGitDirs(rootDir: string): Promise<GitDirs> {
  const dotGit = path.join(rootDir, '.git');
  let gitDir = dotGit;
  try {
    const stat = await fs.stat(dotGit);
    if (stat.isFile()) {
      const parsed = parseGitfile(await fs.readFile(dotGit, 'utf-8'), rootDir);
      if (parsed !== null) gitDir = parsed;
    }
  } catch {
    // no `.git` yet — the would-be directory; probes find nothing there
  }
  const commondir = await readTrimmed(path.join(gitDir, 'commondir'));
  const commonDir = commondir !== null && commondir.length > 0 ? path.resolve(gitDir, commondir) : gitDir;
  return { gitDir, commonDir };
}
