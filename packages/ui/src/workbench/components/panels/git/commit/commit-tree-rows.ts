/**
 * commit-tree-rows — the Commit tree's rows as it DRAWS them, top to
 * bottom, for a fold state: ONE flat list across every git group and
 * every shape the tree takes (the flat run, the directory tree, the
 * files by what they belong to in the workbench). The tree mounts the
 * rows in view and no others, so a row carries what drawing it needs
 * and the height it is given; nothing is read back from the page.
 *
 * The keyboard's rows are the drawn rows a selection can land on
 * (`commitNavRows`): a group's header, a content-root node, a
 * directory, a file, a named row. An empty group's plain label and a
 * section's header are drawn and are no row of the keyboard's. Pure.
 */

import type { WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import { isWorkspaceFilePage } from '@openheaders/ui/shared/workspace-files';
import { ROW_HEIGHT, SECTION_HEIGHT } from '../../../sidebar/tree-geometry';
import type { FileTreeDir, FileTreeNode } from '../file-tree';
import type { ChangeGroupKey } from './commit-model';
import type { CommitNamedRow, CommitNamedSection } from './commit-named-tree';
import { type CommitVisibleRow, commitFileRowKey, flatSortedRows, rootCompressed } from './commit-tree-nav';

/** The height of a group's header and of a row listed by path — the IDE's 24px row. */
export const COMMIT_ROW_HEIGHT = 24;

export interface CommitTreeGroup {
  key: ChangeGroupKey;
  rows: readonly WorkspaceTreeWorkingChangeWire[];
}

interface Drawn {
  /** The row's own key in the tree — a selectable row's selection key. */
  key: string;
  group: ChangeGroupKey;
}

export type CommitTreeRow =
  /** An empty group's plain label — the reference's empty default changelist. */
  | (Drawn & { draw: 'label' })
  | (Drawn & { draw: 'group'; nav: CommitVisibleRow })
  /** The content-root node under a group whose directory tree does not fold into one chain. */
  | (Drawn & { draw: 'root'; nav: CommitVisibleRow })
  | (Drawn & { draw: 'dir'; nav: CommitVisibleRow; node: FileTreeDir; depth: number })
  /** A file by its path — `flat`: in the flat run, where its directory trails its name. */
  | (Drawn & { draw: 'file'; nav: CommitVisibleRow; path: string; depth: number; flat: boolean })
  /** A section's header of the files listed by what they belong to. */
  | (Drawn & { draw: 'section'; section: CommitNamedSection; lead: boolean })
  /** A row of the files listed by what they belong to — `lead`: the first thing listed under its group. */
  | (Drawn & { draw: 'named'; nav: CommitNamedRow; lead: boolean });

/** A group's header, or its plain label when it lists nothing; answers whether its rows are drawn. */
function pushHeader(out: CommitTreeRow[], group: CommitTreeGroup, collapsed: ReadonlySet<string>): boolean {
  if (group.rows.length === 0) {
    out.push({ draw: 'label', key: group.key, group: group.key });
    return false;
  }
  const expanded = !collapsed.has(group.key);
  out.push({
    draw: 'group',
    key: group.key,
    group: group.key,
    nav: { key: group.key, kind: 'group', collapseKey: group.key, expanded, parentKey: null },
  });
  return expanded;
}

/**
 * The rows listed by path: under each group's header its files in the
 * flat order, or its directory tree — hung off the header when the
 * tree is one directory chain, under the content-root node otherwise.
 */
export function commitPathTreeRows(
  groups: readonly CommitTreeGroup[],
  trees: ReadonlyMap<ChangeGroupKey, readonly FileTreeNode[]>,
  collapsed: ReadonlySet<string>,
  groupByDirectory: boolean,
): CommitTreeRow[] {
  const out: CommitTreeRow[] = [];
  for (const group of groups) {
    if (!pushHeader(out, group, collapsed)) continue;
    const file = (path: string, depth: number, parentKey: string, flat: boolean): void => {
      const key = commitFileRowKey(path);
      out.push({ draw: 'file', key, group: group.key, path, depth, flat, nav: { key, kind: 'file', parentKey, path } });
    };
    if (!groupByDirectory) {
      for (const row of flatSortedRows(group.rows)) file(row.path, 1, group.key, true);
      continue;
    }
    const walk = (nodes: readonly FileTreeNode[], depth: number, parentKey: string): void => {
      for (const node of nodes) {
        if (node.kind === 'file') {
          file(node.path, depth, parentKey, false);
          continue;
        }
        const key = `${group.key}:${node.key}`;
        const expanded = !collapsed.has(key);
        out.push({
          draw: 'dir',
          key,
          group: group.key,
          node,
          depth,
          nav: { key, kind: 'dir', collapseKey: key, expanded, parentKey },
        });
        if (expanded) walk(node.children, depth + 1, key);
      }
    };
    const nodes = trees.get(group.key) ?? [];
    if (rootCompressed(nodes)) {
      walk(nodes, 1, group.key);
      continue;
    }
    const rootKey = `${group.key}:__root__`;
    const expanded = !collapsed.has(rootKey);
    out.push({
      draw: 'root',
      key: rootKey,
      group: group.key,
      nav: { key: rootKey, kind: 'root', collapseKey: rootKey, expanded, parentKey: group.key },
    });
    if (expanded) walk(nodes, 2, rootKey);
  }
  return out;
}

/**
 * The rows listed by what the files belong to: under each group's
 * header its sections — a header, then the section's rows; a page is
 * its own one row and has no header.
 */
export function commitNamedTreeRows(
  groups: readonly CommitTreeGroup[],
  shown: ReadonlyMap<ChangeGroupKey, readonly CommitNamedSection[]>,
  collapsed: ReadonlySet<string>,
): CommitTreeRow[] {
  const out: CommitTreeRow[] = [];
  for (const group of groups) {
    if (!pushHeader(out, group, collapsed)) continue;
    let lead = true;
    for (const section of shown.get(group.key) ?? []) {
      if (!isWorkspaceFilePage(section.id)) {
        out.push({ draw: 'section', key: section.key, group: group.key, section, lead });
        lead = false;
      }
      for (const row of section.rows) {
        out.push({ draw: 'named', key: row.key, group: group.key, nav: row, lead });
        lead = false;
      }
    }
  }
  return out;
}

/** The rows a selection can land on, in paint order — the keyboard's walk. */
export function commitNavRows(rows: readonly CommitTreeRow[]): CommitVisibleRow[] {
  return rows.flatMap((row) => ('nav' in row ? [row.nav] : []));
}

/** The height a row is given: a path row's and a group header's own, a named row's as the panels' rows lay out. */
export function commitTreeRowHeight(row: CommitTreeRow): number {
  if (row.draw === 'section') return SECTION_HEIGHT;
  if (row.draw === 'named') return isWorkspaceFilePage(row.nav.named.section) ? SECTION_HEIGHT : ROW_HEIGHT;
  return COMMIT_ROW_HEIGHT;
}
