/**
 * CommitChangesTree — the Commit window's checkable changes tree: the
 * git groups (Changes, Unversioned Files, Ignored Files) over their
 * files in the reference default FLAT format — basename + a dim
 * directory suffix, sorted by filename — as the compressed directory
 * tree when Group Files by Directory is on, or — the Workspace view
 * mode, `named` — each group's files listed by what they belong to in
 * the workbench.
 *
 * The tree is ONE flat list of rows (`use-commit-tree-model`,
 * `commit-tree-rows`) and mounts the rows in view and no others
 * (`shared/virtual-window`): a working tree of any size costs what the
 * viewport shows — on the first draw, on every gesture, and while the
 * window stands hidden behind another. A row is drawn by its shape's
 * component (`CommitPathRow`, `CommitNamedRow`) at the height the model
 * places it by, and keeps nothing of its own.
 *
 * Interaction model (reference): click selects any row (the shared
 * grey-echo/vivid-blue selection pair — vivid only while the dock owns
 * focus, so an open context menu greys the band); Cmd/Ctrl+click
 * toggles a row in or out of the selection and Shift+click selects the
 * range from the anchor (the shared selection model); double-click
 * opens the working diff on files and toggles folders; arrows navigate
 * — Up/Down across visible rows (Shift extends the range), Right
 * expands / steps in, Left collapses / steps to the parent, Enter
 * opens/toggles the lead, Space flips the selection's checkboxes
 * (folders and groups flip their whole subtree — checked unless
 * already fully checked). Right-click keeps a selection it lands in
 * (the menu reads Commit Files… over the union) or selects the row
 * alone, and opens the row context menu (focus moves into the menu).
 * One menu serves the tree — it is made for the row it opens on
 * (`commit-menu-target`).
 */

import type { WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import { useTheme } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useMultiSelection } from '@openheaders/ui/shared/selection';
import { nearestScrollTopForRow, useVirtualRowWindow } from '@openheaders/ui/shared/virtual-window';
import type { MenuProps } from 'antd';
import { Dropdown, theme } from 'antd';
import type React from 'react';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { contextMenuAlign } from '../git-menu-overflow';
import CommitNamedRow from './CommitNamedRow';
import CommitPathRow from './CommitPathRow';
import CommitRowReveal, { useCommitRowReveal } from './CommitRowReveal';
import { commitRowMenuTarget } from './commit-menu-target';
import {
  aggregateChecked,
  type ChangeGroups,
  type CheckedState,
  type CommitMenuTarget,
  checkAggregates,
  isRowChecked,
} from './commit-model';
import type { CommitNamedGroups } from './commit-named-tree';
import type { CommitGroupFace, CommitRowScope } from './commit-row-scope';
import { commitTreeRowHeight } from './commit-tree-rows';
import { commitFilesCountText, useCommitTreeModel } from './use-commit-tree-model';
import { vcsPalette } from './vcs-colors';

export interface CommitChangesTreeProps {
  groups: ChangeGroups;
  checked: CheckedState;
  onSetChecked: (paths: readonly string[], checked: boolean) => void;
  /** Double-click / Enter — open the working diff. */
  onOpenFile: (path: string) => void;
  /** The file whose working diff is being read — its row says so at its end; null when none is. */
  loadingPath?: string | null;
  groupByDirectory: boolean;
  /**
   * The Workspace view mode: each group's files as the workbench
   * lists what they belong to — Group Files by Directory then shapes
   * only the user's own files. Absent: the files are listed by path.
   */
  named?: CommitNamedGroups;
  showIgnored: boolean;
  /** The binding's folder name — a root-level file's dim suffix and the content-root node's label. */
  rootLabel?: string;
  /** Right-click menu for a row — a file, a directory node or a group header (ignored files get the Stop Ignoring variant); null = no menu. */
  rowMenu: (target: CommitMenuTarget) => MenuProps | null;
  /** The file rows the selection covers (a dir or group brings its subtree), ignored rows excluded — the toolbar's target. */
  onSelectionChange?: (rows: readonly WorkspaceTreeWorkingChangeWire[]) => void;
}

export interface CommitChangesTreeHandle {
  expandAll: () => void;
  collapseAll: () => void;
}

const EMPTY_ROWS: WorkspaceTreeWorkingChangeWire[] = [];
const NO_PATHS: readonly string[] = [];
const NO_MENU: MenuProps = { items: [] };
const NO_FACE: CommitGroupFace = { label: '', checkable: false, countText: '' };

const CommitChangesTree = forwardRef<CommitChangesTreeHandle, CommitChangesTreeProps>(function CommitChangesTree(
  {
    groups,
    checked,
    onSetChecked,
    onOpenFile,
    loadingPath = null,
    groupByDirectory,
    named,
    showIgnored,
    rootLabel = '',
    rowMenu,
    onSelectionChange,
  },
  handleRef,
) {
  const { token } = theme.useToken();
  const { isDarkMode } = useTheme();
  const t = useT();
  const palette = vcsPalette(isDarkMode);
  const containerRef = useRef<HTMLDivElement>(null);
  const model = useCommitTreeModel({ groups, named, groupByDirectory, showIgnored });
  const { rows, navRows, indexByKey, allRows, rowsByPath, pathsByRowKey } = model;
  const reveal = useCommitRowReveal(containerRef);

  useImperativeHandle(handleRef, () => ({ expandAll: model.expandAll, collapseAll: model.collapseAll }), [
    model.expandAll,
    model.collapseAll,
  ]);

  // The rows in view: each row's height is the model's, so the window is placed without reading a row back.
  // The rows not mounted stand as padding above and below — held to its height where the scroller lays its
  // children out as a flex column (the named shape's), which would squeeze an empty block to nothing.
  const heights = useMemo(() => rows.map(commitTreeRowHeight), [rows]);
  const rowWindow = useVirtualRowWindow(containerRef, heights, true);
  // A scroll is drawn inside its event: the frame painted for it shows the rows of where it went.
  const handleScroll = (): void => flushSync(rowWindow.onScroll);

  const rowOrder = useMemo(() => navRows.map((row) => row.key), [navRows]);
  const { selection, isSelected, click: clickRow, step, contextMenu: contextMenuRow } = useMultiSelection(rowOrder);
  // The keyboard cursor — the row Enter opens and the arrows move from.
  const selectedKey = selection.lead;

  // The keyboard lands on a row — plain collapses the selection onto it,
  // Shift extends the range from the anchor — and the row comes into
  // view by its place in the list: it need not be mounted.
  const selectRow = (key: string, extend = false): void => {
    step(key, extend);
    const container = containerRef.current;
    const index = indexByKey.get(key);
    if (container === null || index === undefined || container.clientHeight === 0) return;
    const top = nearestScrollTopForRow(rowWindow.prefix, index, container.scrollTop, container.clientHeight);
    if (top !== container.scrollTop) container.scrollTop = top;
  };

  // The file rows the selection covers — every selected key's paths
  // (a dir or group brings its subtree), ignored rows excluded.
  const selectionRows = useMemo<WorkspaceTreeWorkingChangeWire[]>(() => {
    if (selection.ids.size === 0) return [];
    const paths = new Set<string>();
    for (const key of selection.ids) for (const path of pathsByRowKey.get(key) ?? []) paths.add(path);
    const covered: WorkspaceTreeWorkingChangeWire[] = [];
    for (const row of allRows) if (paths.has(row.path) && !row.ignored) covered.push(row);
    return covered;
  }, [selection, pathsByRowKey, allRows]);
  // The multi-row menu target — one selected row keeps its own anatomy.
  const selectedRows = selection.ids.size < 2 ? EMPTY_ROWS : selectionRows;

  useEffect(() => {
    onSelectionChange?.(selectionRows);
  }, [onSelectionChange, selectionRows]);

  // Tree keys: Up/Down walk visible rows, Right expands / steps
  // into, Left collapses / steps to the parent, Enter opens files and
  // toggles folders.
  const handleKeyDown = (event: React.KeyboardEvent): void => {
    const keys = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', ' '];
    if (!keys.includes(event.key) || navRows.length === 0) return;
    // A focused checkbox keeps its native Space toggle.
    if (event.key === ' ' && event.target instanceof HTMLInputElement) return;
    event.preventDefault();
    if (event.key === ' ') {
      const paths: string[] = [];
      for (const key of selection.ids) paths.push(...(pathsByRowKey.get(key) ?? []));
      if (paths.length > 0) onSetChecked(paths, aggregateChecked(allRows, checked, paths) !== 'all');
      return;
    }
    const index = navRows.findIndex((row) => row.key === selectedKey);
    const current = index === -1 ? null : navRows[index];
    if (event.key === 'ArrowDown') {
      selectRow(navRows[Math.min(index + 1, navRows.length - 1)].key, event.shiftKey);
      return;
    }
    if (event.key === 'ArrowUp') {
      selectRow(navRows[Math.max(index - 1, 0)].key, event.shiftKey);
      return;
    }
    if (current === null) {
      selectRow(navRows[0].key);
      return;
    }
    if (event.key === 'ArrowRight') {
      if (current.collapseKey === undefined) return;
      if (current.expanded !== true) model.setFolded(current.collapseKey, false);
      else if (index + 1 < navRows.length && navRows[index + 1].parentKey === current.key) {
        selectRow(navRows[index + 1].key);
      }
      return;
    }
    if (event.key === 'ArrowLeft') {
      if (current.collapseKey !== undefined && current.expanded === true) model.setFolded(current.collapseKey, true);
      else if (current.parentKey !== null) selectRow(current.parentKey);
      return;
    }
    // Enter
    if (current.kind === 'file' && current.path !== undefined) onOpenFile(current.path);
    else if (current.collapseKey !== undefined) model.toggleFold(current.collapseKey);
  };

  // The row the menu is of. A right-click outside every row opens none.
  const [menu, setMenu] = useState<{ key: string; open: boolean } | null>(null);

  // The right-click rule: a row outside the selection becomes the
  // selection alone, one inside it keeps the set. Read on the way DOWN,
  // so the menu that opens on the same click is this row's — and a menu
  // already open moves to the row, where nothing says "open" again.
  const handleContextMenu = (event: React.MouseEvent): void => {
    const host = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-commit-row]') : null;
    const key = host?.dataset.commitRow ?? null;
    setMenu((prev) => (key === null ? null : { key, open: prev?.open ?? false }));
    if (key === null) return;
    const row = rows[indexByKey.get(key) ?? -1];
    if (row !== undefined && 'nav' in row) contextMenuRow(key);
  };

  // Focus returns to the tree when the menu closes, unless the verb
  // already moved it (Commit File… focuses the message box; the close
  // must not steal it back).
  const handleMenuOpenChange = (open: boolean): void => {
    setMenu((prev) => (prev === null ? null : { ...prev, open }));
    if (open) return;
    const active = document.activeElement;
    const idle = active === null || active === document.body || active.closest('.commit-tool-row-menu') !== null;
    if (idle) containerRef.current?.focus({ preventScroll: true });
  };

  // The menu of the row it opens on: the row's own target, or — the row
  // sitting in a wider selection — the union of the selection's files.
  const menuLookup = useMemo(() => ({ rowsByPath, groups: model.groups }), [rowsByPath, model.groups]);
  const menuRow = menu === null ? undefined : rows[indexByKey.get(menu.key) ?? -1];
  const ownTarget = menuRow === undefined ? null : commitRowMenuTarget(menuLookup, menuRow);
  const menuTarget: CommitMenuTarget | null =
    ownTarget !== null && menuRow !== undefined && selectedRows.length > 0 && isSelected(menuRow.key)
      ? { kind: 'files', rows: selectedRows }
      : ownTarget;
  const rowMenuProps = menuTarget === null ? null : rowMenu(menuTarget);

  const aggregateOf = useMemo(
    () => checkAggregates(rowsByPath, checked, pathsByRowKey),
    [rowsByPath, checked, pathsByRowKey],
  );
  const scope: CommitRowScope = {
    t,
    textColor: token.colorText,
    dimColor: token.colorTextTertiary,
    palette,
    rootLabel,
    loadingPath,
    rowsByPath,
    groupFace: (group) => model.faces.get(group) ?? NO_FACE,
    filesCountText: (count) => commitFilesCountText(t, count),
    isSelected,
    isChecked: (row) => isRowChecked(row, checked),
    aggregateOf,
    pathsOf: (key) => pathsByRowKey.get(key) ?? NO_PATHS,
    onSetChecked,
    onToggleFold: model.toggleFold,
    onRowClick: clickRow,
    onOpenFile,
    onRowEnter: reveal.enter,
    onRowLeave: reveal.leave,
  };

  return (
    <Dropdown
      menu={rowMenuProps ?? NO_MENU}
      open={menu?.open === true && rowMenuProps !== null}
      trigger={['contextMenu']}
      align={contextMenuAlign}
      autoFocus
      classNames={{ root: 'commit-tool-row-menu' }}
      onOpenChange={handleMenuOpenChange}
    >
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        onContextMenuCapture={handleContextMenu}
        className={`commit-tool-tree rules-thin-scrollbar${model.named ? ' rules-sidebar-content' : ''}`}
        style={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto', paddingBottom: 12 }}
        data-testid="commit-tool-tree"
      >
        <div aria-hidden style={{ flex: 'none', height: rowWindow.topPadPx }} />
        {rows
          .slice(rowWindow.start, rowWindow.end)
          .map((row) =>
            row.draw === 'section' || row.draw === 'named' ? (
              <CommitNamedRow key={row.key} row={row} scope={scope} />
            ) : (
              <CommitPathRow key={row.key} row={row} scope={scope} />
            ),
          )}
        <div aria-hidden style={{ flex: 'none', height: rowWindow.bottomPadPx }} />
        <CommitRowReveal revealed={reveal.revealed} t={t} palette={palette} />
      </div>
    </Dropdown>
  );
});

export default CommitChangesTree;
