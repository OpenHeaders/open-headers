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
 * The two files are deliberately NOT part of the materialized
 * baseline: a baselined file is one the materializer may normalize or
 * delete, and these are the user's.
 *
 * A branch may hold its own `.gitignore`, and git replaces a file by
 * removing it and writing it anew: one read absent, or without an
 * entry, while git writes the tree is git's to finish. A materialize
 * pass hands its look for git's writes; such a file is left and counted
 * held, for the pass to be taken again.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  GITATTRIBUTES_FILE,
  GITIGNORE_FILE,
  WORKSPACE_GITATTRIBUTES_CONTENT,
  WORKSPACE_GITIGNORE_CONTENT,
  withRequiredIgnoreEntries,
} from '@openheaders/core/workspace-tree';

/** The files this pass looks after — never baselined, never deleted by the materializer. */
export const TREE_HYGIENE_FILES: ReadonlySet<string> = new Set([GITIGNORE_FILE, GITATTRIBUTES_FILE]);

async function readOrNull(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export interface TreeHygieneResult {
  /** The files the pass wrote (authored or appended to). */
  written: string[];
  /** The files it would have written while git wrote the tree — left as they were. */
  held: number;
}

/** Run the pass. `gitWrites` is looked at before each write; absent, nothing ever writes. */
export async function ensureTreeHygiene(
  rootDir: string,
  gitWrites?: () => Promise<boolean>,
): Promise<TreeHygieneResult> {
  const written: string[] = [];
  let held = 0;
  const write = async (file: string, content: string): Promise<void> => {
    if ((await gitWrites?.()) === true) {
      held += 1;
      return;
    }
    await fs.writeFile(path.join(rootDir, file), content, 'utf-8');
    written.push(file);
  };

  const ignore = await readOrNull(path.join(rootDir, GITIGNORE_FILE));
  const nextIgnore = ignore === null ? WORKSPACE_GITIGNORE_CONTENT : withRequiredIgnoreEntries(ignore);
  if (nextIgnore !== ignore) await write(GITIGNORE_FILE, nextIgnore);

  if ((await readOrNull(path.join(rootDir, GITATTRIBUTES_FILE))) === null) {
    await write(GITATTRIBUTES_FILE, WORKSPACE_GITATTRIBUTES_CONTENT);
  }

  return { written, held };
}
