/**
 * grouped-file-tree — a changed-files tree that lists several sets of
 * files, each under a heading of its own (a merge's change against each
 * parent): the groups' rows as ONE run for the tree's one selection and
 * keyboard, and one group's share of the tree's state for drawing its
 * rows. A group's heading is a row that holds the group's own; a file
 * may sit in several groups, so every row is keyed with its group. Pure.
 */

import type { FileTreeRow } from './file-tree';
import type { FileTreeRowScope } from './use-file-tree-behaviour';

/** One group as the tree walks it. `Shape` is what the group's rows are drawn from. */
export interface FileTreeGroupModel<Row extends FileTreeRow, Shape> {
  id: string;
  title: string;
  fileCount: number;
  /** The commit the group's changes are read against; absent: the commit's first parent. */
  base?: string;
  /** The group's visible rows for a fold state of its own keys, in paint order. */
  rowsOf: (collapsed: ReadonlySet<string>) => readonly Row[];
  /** Every key of the group's own a fold acts on. */
  foldKeys: readonly string[];
  shape: Shape;
}

/** A row of the grouped tree: a group's heading, or one of a group's rows. */
export interface GroupedFileRow<Row extends FileTreeRow> extends FileTreeRow {
  group: string;
  /** The row as its group lists it; absent on the heading. */
  member?: Row;
}

export const groupRowKey = (group: string): string => `group:${group}`;

const memberPrefix = (group: string): string => `in:${group}:`;

export const groupMemberKey = (group: string, key: string): string => `${memberPrefix(group)}${key}`;

/** The tree's fold state as one group reads it — on the group's own keys. */
export function groupCollapsed(collapsed: ReadonlySet<string>, group: string): ReadonlySet<string> {
  const prefix = memberPrefix(group);
  const own = new Set<string>();
  for (const key of collapsed) if (key.startsWith(prefix)) own.add(key.slice(prefix.length));
  return own;
}

export function groupedRows<Row extends FileTreeRow, Shape>(
  groups: readonly FileTreeGroupModel<Row, Shape>[],
  collapsed: ReadonlySet<string>,
): GroupedFileRow<Row>[] {
  return groups.flatMap((group) => {
    const key = groupRowKey(group.id);
    const expanded = !collapsed.has(key);
    const heading: GroupedFileRow<Row> = { key, kind: 'dir', depth: 0, parentKey: null, expanded, group: group.id };
    if (!expanded) return [heading];
    const members = group.rowsOf(groupCollapsed(collapsed, group.id)).map(
      (member): GroupedFileRow<Row> => ({
        key: groupMemberKey(group.id, member.key),
        kind: member.kind,
        depth: member.depth + 1,
        parentKey: member.parentKey === null ? key : groupMemberKey(group.id, member.parentKey),
        ...(member.expanded !== undefined ? { expanded: member.expanded } : {}),
        group: group.id,
        member,
      }),
    );
    return [heading, ...members];
  });
}

/** Every key a fold acts on — the headings and each group's own. */
export function groupedFoldKeys<Row extends FileTreeRow, Shape>(
  groups: readonly FileTreeGroupModel<Row, Shape>[],
): string[] {
  return groups.flatMap((group) => [
    groupRowKey(group.id),
    ...group.foldKeys.map((key) => groupMemberKey(group.id, key)),
  ]);
}

/** One group's share of the tree — what its rows are drawn against, on the group's own keys. */
export function groupScope<Row extends FileTreeRow, Shape>(
  tree: FileTreeRowScope<GroupedFileRow<Row>>,
  group: FileTreeGroupModel<Row, Shape>,
): FileTreeRowScope<Row> {
  const keyOf = (key: string): string => groupMemberKey(group.id, key);
  const inTree = (row: FileTreeRow): FileTreeRow => ({ ...row, key: keyOf(row.key) });
  const collapsed = groupCollapsed(tree.collapsed, group.id);
  return {
    selectable: tree.selectable,
    collapsed,
    rows: group.rowsOf(collapsed),
    isSelected: (key) => tree.isSelected(keyOf(key)),
    toggleCollapse: (key) => tree.toggleCollapse(keyOf(key)),
    onRowClick: (row, event) => tree.onRowClick(inTree(row), event),
    onRowDoubleClick: (row) => tree.onRowDoubleClick(inTree(row)),
    onRowContextMenu: (row) => tree.onRowContextMenu(inTree(row)),
    keyOf,
  };
}
