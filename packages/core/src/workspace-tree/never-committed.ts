/**
 * never-committed — the files of a bound folder no commit holds: all of
 * the engine's sidecar, and every secret file.
 *
 * The folder's `.gitignore` says so to git (`WORKSPACE_GITIGNORE_CONTENT`),
 * and that file is the user's and their peers' to write: a later line of
 * it takes an entry back, a `.gitignore` deeper in the folder does, and
 * a link at its name is read by no git. So whatever takes files out of
 * the working tree asks this rule as well, of the path's text alone —
 * the same answer whatever an ignore file holds.
 *
 * Names compare as a filesystem that folds case compares them, the reach
 * git gives the ignore entries on one.
 */

import { OH_SIDECAR_DIR, SECRET_FILE_SUFFIX } from './layout';

/**
 * Whether `path` is a file no commit holds: one beneath a directory
 * named as the sidecar is, at any depth, or one named as a secret file
 * is. `/`-divided; a directory's own row (`.oh/`) answers for what is
 * in it.
 */
export function isNeverCommittedPath(path: string): boolean {
  const names = path.toLowerCase().split('/');
  const file = names.pop() ?? '';
  return file.endsWith(SECRET_FILE_SUFFIX) || names.includes(OH_SIDECAR_DIR);
}
