/**
 * tree-path — the paths a workspace tree can hold.
 *
 * A tree's files live in a folder that is somebody's repository, on any
 * filesystem. A path is the tree's only where it names one file beneath
 * that folder on every one of them, and never a file of git's own
 * directory or of the engine's sidecar: a tree's path comes from a peer
 * — a commit's listing, an entity's `path` — and is joined under the
 * folder as it is written.
 *
 * The rule is the one git's checkout holds a path to before it writes,
 * asked of the text alone so it answers the same on every platform:
 * names divided by `/`, none empty, none `.` or `..`; no control
 * character; no backslash, which divides names on Windows; and no name
 * that is `.git` or `.oh` to a filesystem that folds names — in any
 * case, with dots or spaces after it (Windows drops them), as the short
 * name NTFS gives it, with a stream's name after a colon, or with the
 * code points HFS+ leaves out of a name.
 *
 * It is not a rule of what every platform can store: a name Windows
 * cannot hold and macOS can is a path of the tree.
 */

import type { TreeIssue } from './types';

/** The code points HFS+ leaves out of a name when it compares two. */
const HFS_IGNORED = /[‌-‏‪-‮⁪-⁯﻿]/g;

/**
 * Git's directory and the sidecar (`OH_SIDECAR_DIR`), each also by the
 * short name NTFS gives it, then dots and spaces alone, then nothing or
 * a colon and a stream's name.
 */
const RESERVED_NAME = /^(?:\.git|git~1|\.oh|oh~1)[. ]*(?::.*)?$/i;

/**
 * What of `path` no tree can hold, as a row names it — the name in
 * quotes, or what the name is. Null when `path` is a path of a tree.
 */
export function treePathRefusal(path: string): string | null {
  for (let index = 0; index < path.length; index += 1) {
    const code = path.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return 'a control character';
    if (code === 0x5c) return '"\\"';
  }
  for (const name of path.split('/')) {
    if (name === '') return 'an empty name';
    if (name === '.' || name === '..' || RESERVED_NAME.test(name.replace(HFS_IGNORED, ''))) return `"${name}"`;
  }
  return null;
}

/**
 * The row of a file at a path no tree can hold, at that path: `part`
 * is what of it cannot be (`treePathRefusal`), `left` what came of the
 * file — a reading skipped it, a plan did not write it.
 */
export function treePathIssue(path: string, part: string, left: 'skipped' | 'not written'): TreeIssue {
  return { path, message: `${part} cannot be part of a path — ${left}` };
}
