/**
 * commit-named-tree — the Commit tree with its files listed by what
 * they belong to in the workbench (`workspace-file-tree`), under each
 * git group on its own: nothing crosses a group, so an entity moved in
 * the workbench reads twice — its old files deleted under Changes, its
 * new ones under Unversioned Files — as git reads it.
 *
 * The rows ride the Commit tree's own keys, so one selection, one
 * keyboard and one checked-set serve every shape: a row that stands for
 * one file is `file:<path>`, a row that holds others `<group>:<node id>`,
 * a section's fold `<group>:section:<id>`. A row's checkbox is the set
 * of files under it. Pure.
 */

import type { WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import {
  type FormerFiles,
  type ListedWorkspace,
  type WorkspaceFileNode,
  type WorkspaceFileSection,
  type WorkspaceFileSectionId,
  workspaceFileTree,
} from '@openheaders/ui/shared/workspace-files';
import {
  type NamedFileRow,
  namedFilesUnder,
  namedFoldKeys,
  namedRowChildren,
  namedRowStatus,
  namedSectionKey,
  visibleNamedSections,
} from '../named-file-tree';
import type { ChangeGroupKey, ChangeGroups } from './commit-model';
import { type CommitVisibleRow, commitFileRowKey } from './commit-tree-nav';
import type { VcsPalette } from './vcs-colors';

/** By git group: its files as the workbench lists what they belong to. */
export type CommitNamedGroups = ReadonlyMap<ChangeGroupKey, readonly WorkspaceFileSection[]>;

const GROUP_KEYS: readonly ChangeGroupKey[] = ['changes', 'unversioned', 'ignored'];

/**
 * Each group's files listed on their own. `former` names the files of
 * an entity the workspace no longer holds — deleted in the working
 * tree, HEAD still has its manifest; it names a file only in the group
 * that lists it.
 */
export function commitNamedGroups(
  groups: ChangeGroups,
  workspace: ListedWorkspace,
  former?: FormerFiles,
): Map<ChangeGroupKey, WorkspaceFileSection[]> {
  return new Map(
    GROUP_KEYS.map((key) => [
      key,
      workspaceFileTree(
        groups[key].map((row) => row.path),
        workspace,
        former,
      ),
    ]),
  );
}

export interface CommitNamedRow extends CommitVisibleRow {
  kind: 'dir' | 'file';
  depth: number;
  /** The row as the named file tree lists it — its section, its node, the entity it is or is a part of. */
  named: NamedFileRow;
}

export interface CommitNamedSection {
  id: WorkspaceFileSectionId;
  /** The section's fold key — and its checkbox's path set. */
  key: string;
  expanded: boolean;
  rows: CommitNamedRow[];
}

/** The Commit tree's key of a row that holds others, or of a section's fold. */
export const commitNamedKey = (group: ChangeGroupKey, id: string): string => `${group}:${id}`;

/** The group's own folds, as the named file tree keys them. */
function foldedIn(group: ChangeGroupKey, collapsed: ReadonlySet<string>): Set<string> {
  const prefix = `${group}:`;
  const own = new Set<string>();
  for (const key of collapsed) if (key.startsWith(prefix)) own.add(key.slice(prefix.length));
  return own;
}

/** A group's visible sections and rows for the tree's fold state. */
export function commitNamedSections(
  group: ChangeGroupKey,
  sections: readonly WorkspaceFileSection[],
  collapsed: ReadonlySet<string>,
): CommitNamedSection[] {
  return visibleNamedSections(sections, foldedIn(group, collapsed)).map((section) => ({
    id: section.id,
    key: commitNamedKey(group, section.key),
    expanded: section.expanded,
    rows: section.rows.map((row): CommitNamedRow => {
      const parentKey = row.parentKey === null ? group : commitNamedKey(group, row.parentKey);
      if (row.kind === 'file') {
        return { key: commitFileRowKey(row.key), kind: 'file', depth: row.depth, parentKey, path: row.key, named: row };
      }
      const key = commitNamedKey(group, row.key);
      return { key, kind: 'dir', depth: row.depth, parentKey, collapseKey: key, expanded: row.expanded, named: row };
    }),
  }));
}

/** Every key a fold acts on in a group — its sections and the rows that hold others. */
export function commitNamedFoldKeys(group: ChangeGroupKey, sections: readonly WorkspaceFileSection[]): string[] {
  return namedFoldKeys(sections).map((key) => commitNamedKey(group, key));
}

/** By key, the files under each section and each row that holds others — a checkbox's set. */
export function commitNamedPaths(
  group: ChangeGroupKey,
  sections: readonly WorkspaceFileSection[],
): Map<string, string[]> {
  const paths = new Map<string, string[]>();
  const walk = (nodes: readonly WorkspaceFileNode[]): void => {
    for (const node of nodes) {
      const held = namedRowChildren(node);
      if (held.length === 0) continue;
      paths.set(commitNamedKey(group, node.id), namedFilesUnder(held));
      walk(held);
    }
  };
  for (const section of sections) {
    paths.set(commitNamedKey(group, namedSectionKey(section.id)), namedFilesUnder(section.nodes));
    walk(section.nodes);
  }
  return paths;
}

/** The tree's selectable rows in paint order: each group's header, then its rows — a section is no row. */
export function visibleCommitNamedRows(
  groups: ReadonlyArray<{ key: ChangeGroupKey; rows: readonly WorkspaceTreeWorkingChangeWire[] }>,
  shown: ReadonlyMap<ChangeGroupKey, readonly CommitNamedSection[]>,
  collapsed: ReadonlySet<string>,
): CommitVisibleRow[] {
  const out: CommitVisibleRow[] = [];
  for (const group of groups) {
    if (group.rows.length === 0) continue;
    const expanded = !collapsed.has(group.key);
    out.push({ key: group.key, kind: 'group', collapseKey: group.key, expanded, parentKey: null });
    if (expanded) for (const section of shown.get(group.key) ?? []) out.push(...section.rows);
  }
  return out;
}

/**
 * The colour a row's name wears: a file's own change; an entity that
 * lists several, added or deleted when all its own files are and
 * modified otherwise; none on a row that only holds others. A group
 * the index does not know reads in that group's one colour.
 */
export function commitNamedTone(
  group: ChangeGroupKey,
  node: WorkspaceFileNode,
  statusOf: (path: string) => string | undefined,
): keyof VcsPalette | undefined {
  const status = namedRowStatus(node, statusOf);
  if (status === undefined) return undefined;
  if (group !== 'changes') return group;
  if (status === 'A') return 'added';
  return status === 'D' ? 'deleted' : 'modified';
}
