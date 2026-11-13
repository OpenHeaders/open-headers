/**
 * useFileTreeBehaviour — what a changed-files tree does, whichever way
 * its rows are drawn (by directory, or by what the files belong to):
 * the fold state and Expand All / Collapse All, the rows on the shared
 * selection model (a click selects a row alone, Cmd/Ctrl+click toggles,
 * Shift+click ranges from the anchor; a right-click keeps a selection
 * it lands in), the keys (Up/Down walk the rows, Shift extends; Right
 * expands / steps in, Left collapses / steps to the parent, Enter opens
 * the cursor's file or toggles its row), and what the pane's verbs act
 * on after a gesture — the ONE file (the clicked file while it stays
 * selected, else the first selected file, else none) and the selected
 * rows it was picked from, for a tree whose rows name more than a file.
 * Without a selection handler a click opens a file directly and toggles
 * a row that holds others.
 */

import { clickModifiers, selectOnClick, selectOnStep, useMultiSelection } from '@openheaders/ui/shared/selection';
import type React from 'react';
import { type ForwardedRef, type RefObject, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { type FileTreeRow, leadFilePath, selectedRowsLeadFirst } from './file-tree';

export interface FileTreeViewHandle {
  expandAll: () => void;
  collapseAll: () => void;
}

export interface FileTreeBehaviourInput<Row extends FileTreeRow> {
  /** The visible rows for a fold state, in paint order — a stable function. */
  rowsOf: (collapsed: ReadonlySet<string>) => readonly Row[];
  /** Every key a fold acts on — Collapse All's set. */
  foldKeys: readonly string[];
  onOpenFile: (path: string) => void;
  selectedPath?: string | null;
  /**
   * After a gesture: the file the pane's verbs act on, and the selected
   * rows — the one the gesture landed on first while it stays selected,
   * the rest in paint order. Absent: rows do not select.
   */
  onSelect?: (file: string | null, selected: readonly Row[]) => void;
}

/**
 * What a tree's rows are drawn against — the fold state, the selection
 * and the gestures, on the rows' own keys. The behaviour itself for a
 * tree of one listing; one group's share of it (`grouped-file-tree`)
 * where a tree lists several.
 */
export interface FileTreeRowScope<Row extends FileTreeRow> {
  /** Rows select (the log pane, the Push window); otherwise a click acts. */
  selectable: boolean;
  collapsed: ReadonlySet<string>;
  rows: readonly Row[];
  isSelected: (key: string) => boolean;
  toggleCollapse: (key: string) => void;
  /** A click on a row's body: selects it, or — without selection — opens its file / toggles it. */
  onRowClick: (row: FileTreeRow, event: React.MouseEvent) => void;
  onRowDoubleClick: (row: FileTreeRow) => void;
  onRowContextMenu: (row: FileTreeRow) => void;
  /** A row's key in the tree's one selection — what its `data-row-key` carries. */
  keyOf: (key: string) => string;
}

export interface FileTreeBehaviour<Row extends FileTreeRow> extends FileTreeRowScope<Row> {
  containerRef: RefObject<HTMLDivElement | null>;
  expandAll: () => void;
  collapseAll: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}

const ownKey = (key: string): string => key;

export function useFileTreeBehaviour<Row extends FileTreeRow>(
  { rowsOf, foldKeys, onOpenFile, selectedPath, onSelect }: FileTreeBehaviourInput<Row>,
  handleRef: ForwardedRef<FileTreeViewHandle>,
): FileTreeBehaviour<Row> {
  const containerRef = useRef<HTMLDivElement>(null);
  // Starts fully expanded — the host keys the tree by what it lists, so a fresh listing resets the state.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const rows = useMemo(() => rowsOf(collapsed), [rowsOf, collapsed]);
  const order = useMemo(() => rows.map((row) => row.key), [rows]);
  const { selection, isSelected, click, step, contextMenu } = useMultiSelection(order);
  const selectable = onSelect !== undefined;

  const expandAll = (): void => setCollapsed(new Set());
  const collapseAll = (): void => setCollapsed(new Set(foldKeys));
  useImperativeHandle(
    handleRef,
    () => ({
      expandAll: () => setCollapsed(new Set()),
      collapseAll: () => setCollapsed(new Set(foldKeys)),
    }),
    [foldKeys],
  );

  // A file the pane names from outside (its remembered path) becomes
  // the selection when its row is visible and not yet selected.
  useEffect(() => {
    if (!selectable || selectedPath === null || selectedPath === undefined) return;
    if (!selection.ids.has(selectedPath) && order.includes(selectedPath)) step(selectedPath, false);
  }, [selectable, selectedPath, selection, order, step]);

  const setCollapsedKey = (key: string, collapse: boolean): void =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (collapse) next.add(key);
      else next.delete(key);
      return next;
    });
  const toggleCollapse = (key: string): void => setCollapsedKey(key, !collapsed.has(key));

  const report = (ids: ReadonlySet<string>, preferred: string | null): void =>
    onSelect?.(leadFilePath(rows, ids, preferred), selectedRowsLeadFirst(rows, ids, preferred));

  const landOn = (key: string, extend: boolean): void => {
    const next = selectOnStep(selection, order, key, extend);
    step(key, extend);
    report(next.ids, key);
    containerRef.current?.querySelector(`[data-row-key="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'nearest' });
  };

  const onRowClick = (row: FileTreeRow, event: React.MouseEvent): void => {
    if (!selectable) {
      if (row.kind === 'file') onOpenFile(row.key);
      else toggleCollapse(row.key);
      return;
    }
    const next = selectOnClick(selection, order, row.key, clickModifiers(event));
    click(row.key, event);
    report(next.ids, row.key);
  };

  const onRowDoubleClick = (row: FileTreeRow): void => {
    if (!selectable) return;
    if (row.kind === 'file') onOpenFile(row.key);
    else toggleCollapse(row.key);
  };

  const onRowContextMenu = (row: FileTreeRow): void => {
    if (!selectable) return;
    contextMenu(row.key);
    report(selection.ids.has(row.key) ? selection.ids : new Set([row.key]), row.key);
  };

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (!selectable || rows.length === 0) return;
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(event.key)) return;
    event.preventDefault();
    const index = rows.findIndex((row) => row.key === selection.lead);
    const current = index === -1 ? null : rows[index];
    if (event.key === 'ArrowDown') {
      landOn(rows[Math.min(index + 1, rows.length - 1)].key, event.shiftKey);
      return;
    }
    if (event.key === 'ArrowUp') {
      landOn(rows[Math.max(index - 1, 0)].key, event.shiftKey);
      return;
    }
    if (current === null) {
      landOn(rows[0].key, false);
      return;
    }
    if (event.key === 'ArrowRight') {
      if (current.kind !== 'dir') return;
      if (current.expanded !== true) setCollapsedKey(current.key, false);
      else if (index + 1 < rows.length && rows[index + 1].parentKey === current.key) landOn(rows[index + 1].key, false);
      return;
    }
    if (event.key === 'ArrowLeft') {
      if (current.kind === 'dir' && current.expanded === true) setCollapsedKey(current.key, true);
      else if (current.parentKey !== null) landOn(current.parentKey, false);
      return;
    }
    if (current.kind === 'file') onOpenFile(current.key);
    else toggleCollapse(current.key);
  };

  return {
    containerRef,
    selectable,
    collapsed,
    rows,
    isSelected: (key) => selectable && isSelected(key),
    toggleCollapse,
    expandAll,
    collapseAll,
    onRowClick,
    onRowDoubleClick,
    onRowContextMenu,
    onKeyDown,
    keyOf: ownKey,
  };
}
