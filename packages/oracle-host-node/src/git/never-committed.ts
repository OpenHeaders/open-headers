/**
 * What no git command of ours takes out of the working tree — the
 * sidecar and the secret files (core's `never-committed.ts`), said to
 * git on the command itself.
 *
 * The folder's `.gitignore` holds the same two entries, and it is a file
 * of the working tree: a peer's commit can put a line after them that
 * takes them back, or a link at its name, which git reads nothing of. A
 * command that stages, stashes or removes what git calls untracked would
 * then take the vault with it. What the command is told here holds
 * whatever an ignore file says.
 *
 * Git is told in the place it asks, and that is one of three:
 *
 *   - a command over the WHOLE tree (`add -A`, `stash push`, `status`)
 *     takes the tree with two exclude pathspecs. Each is a glob: a
 *     pathspec that names the sidecar outright fails the command where
 *     the folder's `.gitignore` ignores it;
 *   - a command over NAMED paths (a commit of checked files, Add to VCS)
 *     takes the names the rule does not name, and no exclude: git reads
 *     an exclude no longer than the directory the named paths share as
 *     one that matches everything, and stages nothing (run on 2.54: one
 *     new file under a directory of sixteen characters, beside the
 *     secrets' exclude). The whole tree shares no directory. What a
 *     directory among the names brings is the caller's to put back
 *     (`commitWorkspaceTree`). With no name left there is nothing to
 *     run;
 *   - `clean` removes an untracked directory whole and asks no pathspec
 *     of what lies in it — it gets the ignore entries themselves, as its
 *     own `-e`, which no ignore file's line overrides. Git folds an
 *     entry's case only where the filesystem folds names, and the rule
 *     folds it everywhere, so each letter is a class of its two cases
 *     (run on a case-sensitive volume: the plain entries let `.OH/` and
 *     `X.SECRET.YAML` go). An entry names a directory as well as a file,
 *     so clean keeps what a directory named as a secret file holds: more
 *     than the rule asks, never less.
 */

import {
  isNeverCommittedPath,
  OH_SIDECAR_DIR,
  REQUIRED_IGNORE_ENTRIES,
  SECRET_FILE_SUFFIX,
} from '@openheaders/core/workspace-tree';

/** The pathspecs of a command over the whole tree, run in the folder. */
export const WHOLE_TREE_PATHSPECS: readonly string[] = [
  '.',
  `:(exclude,top,glob,icase)**/${OH_SIDECAR_DIR}/**`,
  `:(exclude,top,glob,icase)**/*${SECRET_FILE_SUFFIX}`,
];

/** The names of `paths` a command over named paths is handed. None left: the command is not run. */
export function namedPaths(paths: readonly string[]): string[] {
  return paths.filter((filePath) => !isNeverCommittedPath(filePath));
}

/** An ignore entry that reads the same on a filesystem that folds case and on one that does not. */
const inEitherCase = (entry: string): string =>
  entry.replace(/[a-z]/gi, (letter) => `[${letter.toLowerCase()}${letter.toUpperCase()}]`);

/** The same for `git clean`, as its options. */
export const NEVER_CLEANED_OPTIONS: readonly string[] = REQUIRED_IGNORE_ENTRIES.flatMap((entry) => [
  '-e',
  inEitherCase(entry),
]);
