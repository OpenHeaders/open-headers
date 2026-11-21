/**
 * commit-menu-target — what a right-click on a row of the Commit tree
 * lands on, read from the row as the tree draws it
 * (`commit-tree-rows`): a file, a directory with the files under it, a
 * group, a named row that holds several. Made for the one row the menu
 * opens on, when it opens — never for a row that is only drawn. A
 * section's header has no menu. Pure.
 */

import type { WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import { fileTreePaths } from '../file-tree';
import { namedDirectoryPath, namedFilesUnder, namedRowChildren } from '../named-file-tree';
import { workspaceFileEntityRef } from '../workspace-file-entity-ref';
import type { CommitMenuTarget } from './commit-model';
import type { CommitNamedRow } from './commit-named-tree';
import type { CommitTreeGroup, CommitTreeRow } from './commit-tree-rows';

export interface CommitMenuLookup {
  rowsByPath: ReadonlyMap<string, WorkspaceTreeWorkingChangeWire>;
  groups: readonly CommitTreeGroup[];
}

function groupPaths(lookup: CommitMenuLookup, row: CommitTreeRow): string[] {
  return (lookup.groups.find((group) => group.key === row.group)?.rows ?? []).map((change) => change.path);
}

function namedTarget(lookup: CommitMenuLookup, row: CommitTreeRow, named: CommitNamedRow): CommitMenuTarget | null {
  const { node, section, entity: owner } = named.named;
  const entity = owner === undefined ? undefined : workspaceFileEntityRef(section, owner);
  const jump = entity !== undefined ? { entity } : {};
  if (named.kind === 'file') {
    const change = lookup.rowsByPath.get(named.named.key);
    return change === undefined ? null : { kind: 'file', row: change, ...jump };
  }
  const paths = namedFilesUnder(namedRowChildren(node));
  if (node.type === 'directory') return { kind: 'dir', group: row.group, path: namedDirectoryPath(node), paths };
  return {
    kind: 'named',
    group: row.group,
    rows: paths.flatMap((path) => lookup.rowsByPath.get(path) ?? []),
    ...jump,
  };
}

/** The row's own target; null for a row that carries no menu. */
export function commitRowMenuTarget(lookup: CommitMenuLookup, row: CommitTreeRow): CommitMenuTarget | null {
  switch (row.draw) {
    case 'label':
      return { kind: 'group', group: row.group, paths: [] };
    case 'group':
    case 'root':
      return { kind: 'group', group: row.group, paths: groupPaths(lookup, row) };
    case 'dir':
      return { kind: 'dir', group: row.group, path: row.node.key, paths: fileTreePaths(row.node) };
    case 'file': {
      const change = lookup.rowsByPath.get(row.path);
      return change === undefined ? null : { kind: 'file', row: change };
    }
    case 'section':
      return null;
    case 'named':
      return namedTarget(lookup, row, row.nav);
  }
}
