/**
 * commit-tree-nav — the Commit tree's keyboard-navigation model: the
 * ordered list of VISIBLE selectable rows (group headers, content-root
 * nodes, dirs, files) for the current collapse state, plus the flat
 * sort the ungrouped view shares. Pure shaping; no React.
 */

import type { WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import type { FileTreeNode } from '../file-tree';

export interface CommitVisibleRow {
  /** Selection key — the group key, `<group>:__root__`, `<group>:<dirKey>`, or `file:<path>`. */
  key: string;
  kind: 'group' | 'root' | 'dir' | 'file';
  /** Collapse-set key for expandable rows. */
  collapseKey?: string;
  expanded?: boolean;
  parentKey: string | null;
  path?: string;
}

/** Basename of a repo-relative path. */
export function baseName(filePath: string): string {
  return filePath.slice(filePath.lastIndexOf('/') + 1);
}

/** The IDE's flat order: by filename, ties by full path. */
export function flatSortedRows(rows: readonly WorkspaceTreeWorkingChangeWire[]): WorkspaceTreeWorkingChangeWire[] {
  return [...rows].sort((a, b) => baseName(a.path).localeCompare(baseName(b.path)) || a.path.localeCompare(b.path));
}

export function commitFileRowKey(path: string): string {
  return `file:${path}`;
}

/**
 * The IDE's content-root compression: the nameless root node collapses
 * away when the whole tree is one single-child directory chain — the
 * chain (already compressed by `buildFileTree`) hangs directly off the
 * group header. A lone top-level FILE cannot merge into a chain, so it
 * keeps the root node.
 */
export function rootCompressed(nodes: readonly FileTreeNode[]): boolean {
  return nodes.length === 1 && nodes[0].kind === 'dir';
}

/**
 * Every selectable row in display order for the current collapse
 * state. Empty groups render as plain label rows and are skipped; a
 * group whose tree compresses the root node carries no `__root__` row.
 */
export function visibleCommitRows(
  groups: ReadonlyArray<{ key: string; rows: readonly WorkspaceTreeWorkingChangeWire[] }>,
  trees: ReadonlyMap<string, readonly FileTreeNode[]>,
  collapsed: ReadonlySet<string>,
  groupByDirectory: boolean,
): CommitVisibleRow[] {
  const out: CommitVisibleRow[] = [];
  for (const group of groups) {
    if (group.rows.length === 0) continue;
    const expanded = !collapsed.has(group.key);
    out.push({ key: group.key, kind: 'group', collapseKey: group.key, expanded, parentKey: null });
    if (!expanded) continue;
    if (!groupByDirectory) {
      for (const row of flatSortedRows(group.rows)) {
        out.push({ key: commitFileRowKey(row.path), kind: 'file', parentKey: group.key, path: row.path });
      }
      continue;
    }
    const walk = (nodes: readonly FileTreeNode[], parentKey: string): void => {
      for (const node of nodes) {
        if (node.kind === 'dir') {
          const key = `${group.key}:${node.key}`;
          const open = !collapsed.has(key);
          out.push({ key, kind: 'dir', collapseKey: key, expanded: open, parentKey });
          if (open) walk(node.children, key);
        } else {
          out.push({ key: commitFileRowKey(node.path), kind: 'file', parentKey, path: node.path });
        }
      }
    };
    const nodes = trees.get(group.key) ?? [];
    if (rootCompressed(nodes)) {
      walk(nodes, group.key);
      continue;
    }
    const rootKey = `${group.key}:__root__`;
    const rootExpanded = !collapsed.has(rootKey);
    out.push({ key: rootKey, kind: 'root', collapseKey: rootKey, expanded: rootExpanded, parentKey: group.key });
    if (rootExpanded) walk(nodes, rootKey);
  }
  return out;
}
