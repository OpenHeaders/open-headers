/**
 * paths-tree — the Paths chip's Select in Tree…: what a checked row
 * filters the log by. A folder is ONE path (its closing slash kept, as
 * the chip reads it), never the sum of its files — files come and go
 * through a history, the folder stands. In the tree that lists files by
 * what they belong to, a collection, a folder and an entity kept in a
 * directory of its own filter by that directory; one kept as files of a
 * shared directory (an environment, a page) by those files. Pure.
 */

import { isEntityTreePath, type WorkspaceFileNode } from '@openheaders/ui/shared/workspace-files';
import { namedDirectoryPath, namedFilesUnder } from '../named-file-tree';

/** A folder's key as a filter path. */
export function folderPath(key: string): string {
  return `${key}/`;
}

/** The directory every one of the files is in or under — '' when they share none. */
export function commonDirectory(files: readonly string[]): string {
  if (files.length === 0) return '';
  const dirs = files.map((file) => file.split('/').slice(0, -1));
  const shared: string[] = [];
  for (let at = 0; at < dirs[0].length; at += 1) {
    const segment = dirs[0][at];
    if (!dirs.every((dir) => dir[at] === segment)) break;
    shared.push(segment);
  }
  return shared.join('/');
}

/** The paths a checked row of the named tree filters by. */
export function namedRowPaths(node: WorkspaceFileNode): string[] {
  if (node.type === 'file' || node.type === 'part') return [node.file];
  if (node.type === 'directory') return [folderPath(namedDirectoryPath(node))];
  const files = namedFilesUnder([node]);
  const directory = commonDirectory(files);
  // Deeper than the tree's own root: the entity's (or the container's) own directory.
  return directory.includes('/') && isEntityTreePath(directory) ? [folderPath(directory)] : files;
}

/** The checked paths after one row's box is flipped: its paths all in, each under the row's name, or all out. */
export function withRowChecked(
  checked: ReadonlyMap<string, string | null>,
  paths: readonly string[],
  name: string | null,
  on: boolean,
): Map<string, string | null> {
  const next = new Map(checked);
  for (const path of paths) {
    if (on) next.set(path, name);
    else next.delete(path);
  }
  return next;
}

/** The names the checked paths were picked under — a path picked as itself has none. */
export function pickedNames(checked: ReadonlyMap<string, string | null>): Record<string, string> {
  const names: Record<string, string> = {};
  for (const [path, name] of checked) {
    if (name !== null) names[path] = name;
  }
  return names;
}
