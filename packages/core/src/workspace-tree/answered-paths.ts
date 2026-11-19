/**
 * answered-paths — which of a listing's document paths its READING
 * answers for.
 *
 * `treeDocumentPaths` names the files a reading takes in: every file of
 * a directory that holds an entity manifest, since a codec is handed all
 * of them and takes the ones it knows. What it did not take — a note
 * kept beside a rule, a link in a collection's directory — is in no
 * entity and in no flush: the engine neither holds it nor writes it.
 * Such a file is the user's own, like any file outside a document's
 * directory, and a pass that carries the user's own files across
 * carries it.
 *
 * A reading answers for a file beside a manifest where it would write
 * the file back — the plan of what was read holds it — and where it
 * holds the entity back: every file of a directory that has a row is
 * that entity's until it reads. A root document, an environment file
 * and a manifest are a document's by their name alone
 * (`isDocumentByName`).
 */

import { isDocumentByName } from './document-paths';
import { planWorkspaceTree } from './plan';
import type { TreeReadResult } from './types';

const dirOf = (path: string): string => {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.slice(0, idx);
};

/**
 * The paths among `named` — the document paths of one listing
 * (`treeDocumentPaths`) — that `read`, the reading of that listing,
 * answers for. A tree whose own manifest did not read is no tree to
 * plan: every path its names say.
 */
export function readDocumentPaths(
  named: Iterable<string>,
  read: Pick<TreeReadResult, 'state' | 'unknowns' | 'issues'>,
): Set<string> {
  const { workspace } = read.state;
  if (workspace === null) return new Set(named);
  const planned = new Set(planWorkspaceTree({ ...read.state, workspace }, read.unknowns).map((file) => file.path));
  const heldBack = new Set(read.issues.map((issue) => dirOf(issue.path)));
  const answered = new Set<string>();
  for (const path of named) {
    if (isDocumentByName(path) || planned.has(path) || heldBack.has(dirOf(path))) answered.add(path);
  }
  return answered;
}
