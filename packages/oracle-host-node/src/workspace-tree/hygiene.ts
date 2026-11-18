/**
 * Tree hygiene on disk — the pass that keeps `.gitignore` and
 * `.gitattributes` doing their job without owning them (the rule is
 * core's `workspace-tree/hygiene.ts`): each file is authored when
 * absent, a `.gitignore` missing a required entry gets it appended,
 * and whatever else the user keeps in either file is never rewritten.
 * Bind runs it once and every materialize pass runs it again, so a
 * deleted file or a dropped entry heals before the next commit can
 * stage a secret.
 *
 * Each is a regular file or nothing (`git/regular-file.ts`): git reads
 * neither through a link, and a commit can leave one at the name — a
 * branch that holds it, checked out by git. A link there is never read
 * and never written through: the pass takes it as no file at all and
 * authors the file in its place, where the link points left as it is.
 * What stands there and is no file — a directory — is not the pass's to
 * replace: it stands, and the pass says its row. A file that stands and
 * would not be read is left as it is.
 *
 * The two files are deliberately NOT part of the materialized
 * baseline: a baselined file is one the materializer may normalize or
 * delete, and these are the user's.
 *
 * A branch may hold its own `.gitignore`, and git replaces a file by
 * removing it and writing it anew: one read absent, or without an
 * entry, while git writes the tree is git's to finish. A materialize
 * pass hands its look for git's writes; such a file is left and counted
 * held, for the pass to be taken again — and so is one another program
 * holds as the pass comes to it.
 *
 * The sidecar's own ignore file is kept with them (`sidecar.ts`): the
 * root `.gitignore` is a file a commit can change, and the sidecar stays
 * out of the user's own git whatever it says.
 */

import * as path from 'node:path';
import {
  GITATTRIBUTES_FILE,
  GITIGNORE_FILE,
  type TreeIssue,
  WORKSPACE_GITATTRIBUTES_CONTENT,
  WORKSPACE_GITIGNORE_CONTENT,
  withRequiredIgnoreEntries,
} from '@openheaders/core/workspace-tree';
import { isBusy, putRegularFile, readRegularFile, TreeBoundary, treeRefusalIssue } from '../git';
import { ensureSidecarIgnore } from './sidecar';

interface HygieneFile {
  file: string;
  /** The file as the pass authors it where none stands. */
  authored: string;
  /** What a file that stands should hold, from what it holds. */
  kept(text: string): string;
}

const HYGIENE_FILES: readonly HygieneFile[] = [
  { file: GITIGNORE_FILE, authored: WORKSPACE_GITIGNORE_CONTENT, kept: withRequiredIgnoreEntries },
  { file: GITATTRIBUTES_FILE, authored: WORKSPACE_GITATTRIBUTES_CONTENT, kept: (text) => text },
];

/** The files this pass looks after — never baselined, never deleted by the materializer. */
export const TREE_HYGIENE_FILES: ReadonlySet<string> = new Set(HYGIENE_FILES.map(({ file }) => file));

export interface TreeHygieneResult {
  /** The files the pass wrote (authored or appended to). */
  written: string[];
  /** The files it would have written while git wrote the tree, or that another program held — left as they were. */
  held: number;
  /** The rows of the files it could not write: what stands at the name is no file. */
  unwritten: TreeIssue[];
}

/** Run the pass. `gitWrites` is looked at before each write; absent, nothing ever writes. */
export async function ensureTreeHygiene(
  rootDir: string,
  gitWrites?: () => Promise<boolean>,
): Promise<TreeHygieneResult> {
  const boundary = new TreeBoundary(rootDir);
  const written: string[] = [];
  const unwritten: TreeIssue[] = [];
  let held = 0;

  for (const { file, authored, kept } of HYGIENE_FILES) {
    const standing = await readRegularFile(path.join(rootDir, file));
    if (standing.kind === 'unread') {
      if (isBusy(standing.code)) held += 1;
      continue;
    }
    const next = standing.kind === 'text' ? kept(standing.text) : authored;
    if (standing.kind === 'text' && next === standing.text) continue;
    if ((await gitWrites?.()) === true) {
      held += 1;
      continue;
    }
    const put = await putRegularFile(boundary, file, next);
    if (put.ok) written.push(file);
    else unwritten.push(treeRefusalIssue(file, put.refusal));
  }
  await ensureSidecarIgnore(rootDir);

  return { written, held, unwritten };
}
