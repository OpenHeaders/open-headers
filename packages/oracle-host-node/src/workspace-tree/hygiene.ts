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

/** Run the pass; answers the files it wrote (authored or appended to). */
export async function ensureTreeHygiene(rootDir: string): Promise<string[]> {
  const written: string[] = [];

  const ignorePath = path.join(rootDir, GITIGNORE_FILE);
  const ignore = await readOrNull(ignorePath);
  const nextIgnore = ignore === null ? WORKSPACE_GITIGNORE_CONTENT : withRequiredIgnoreEntries(ignore);
  if (nextIgnore !== ignore) {
    await fs.writeFile(ignorePath, nextIgnore, 'utf-8');
    written.push(GITIGNORE_FILE);
  }

  const attributesPath = path.join(rootDir, GITATTRIBUTES_FILE);
  if ((await readOrNull(attributesPath)) === null) {
    await fs.writeFile(attributesPath, WORKSPACE_GITATTRIBUTES_CONTENT, 'utf-8');
    written.push(GITATTRIBUTES_FILE);
  }

  return written;
}
