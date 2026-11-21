/**
 * commit-tree-nav — the Commit tree's keyboard-navigation model: the
 * shape of a row a selection can land on (group headers, content-root
 * nodes, dirs, files — listed, in paint order, by `commit-tree-rows`),
 * its keys, plus the flat sort the ungrouped view shares. Pure
 * shaping; no React.
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

/** The reference ordinal case-insensitive compare — non-ASCII sorts after ASCII (`Ünïcode` last). */
function ordinalIgnoreCase(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}

/** The reference flat order: by filename, ties by full path. */
export function flatSortedRows(rows: readonly WorkspaceTreeWorkingChangeWire[]): WorkspaceTreeWorkingChangeWire[] {
  return [...rows].sort(
    (a, b) => ordinalIgnoreCase(baseName(a.path), baseName(b.path)) || ordinalIgnoreCase(a.path, b.path),
  );
}

export function commitFileRowKey(path: string): string {
  return `file:${path}`;
}

/**
 * The reference content-root compression: the nameless root node collapses
 * away when the whole tree is one single-child directory chain — the
 * chain (already compressed by `buildFileTree`) hangs directly off the
 * group header. A lone top-level FILE cannot merge into a chain, so it
 * keeps the root node.
 */
export function rootCompressed(nodes: readonly FileTreeNode[]): boolean {
  return nodes.length === 1 && nodes[0].kind === 'dir';
}
