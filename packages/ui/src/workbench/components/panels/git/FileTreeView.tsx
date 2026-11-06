/**
 * FileTreeView — the detail pane's changed-paths tree (
 * grouping: single-child dir chains fold into one `a/b/c` node with an
 * `N files` badge, or flat full-path rows while Group By Directory is
 * off), filenames in the UI face behind the Commit tree's file-type
 * icon and colored by porcelain status. With a selection
 * handler wired (the log pane, the Push window) the rows ride the
 * shared selection model: a click selects a row alone, Cmd/Ctrl+click
 * toggles, Shift+click ranges from the anchor across dirs and files;
 * the caret and a double-click toggle a dir, a double-click opens a
 * file; Up/Down walk the rows (Shift extends), Right expands / steps
 * in, Left collapses / steps to the parent, Enter opens the cursor's
 * file or toggles its dir; a right-click keeps a selection it lands in.
 * The pane's verbs (Show Diff, Jump to Source, the row menu) act on
 * ONE file — the tree reports it: the clicked file while it stays
 * selected, else the first selected file, else none. Without a
 * selection handler (the compare pane) a click opens the diff directly
 * and the built-in header keeps the expand/collapse pair. Expand All /
 * Collapse All also arrive through the imperative handle when the
 * toolbar lives outside.
 */

import { CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons';
import { Button, Dropdown, type MenuProps, Spin, theme } from 'antd';
import type React from 'react';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { CollapseAllIcon, ExpandAllIcon } from '@openheaders/ui/shared/icons';
import { clickModifiers, selectOnClick, selectOnStep, useMultiSelection } from '@openheaders/ui/shared/selection';
import { FileTypeIcon, FolderTypeIcon } from './commit/FileTypeIcon';
import { allDirKeys, buildFileTree, type FileTreeNode, leadFilePath, visibleFileTreeRows } from './file-tree';
import { contextMenuAlign } from './git-menu-overflow';

/** Porcelain status letter → theme color, (added green,
 *  modified blue, deleted red, rename/copy amber). */
export function statusColor(status: string, token: ReturnType<typeof theme.useToken>['token']): string {
  switch (status) {
    case 'A':
      return token.colorSuccessText;
    case 'D':
      return token.colorErrorText;
    case 'R':
    case 'C':
      return token.colorWarningText;
    default:
      return token.colorInfoText;
  }
}

export interface FileTreeViewProps {
  files: ReadonlyArray<{ path: string; status: string }>;
  /** Path currently fetching its diff (per-file spinner). */
  loadingPath: string | null;
  onOpenFile: (path: string) => void;
  /** Selection wiring (the log pane): click selects, double-click opens. */
  selectedPath?: string | null;
  /** The file the pane's verbs act on after a gesture — null when no file is selected. */
  onSelectFile?: (path: string | null) => void;
  /** Group By Directory (details eye) — off renders flat full paths. */
  groupByDirectory?: boolean;
  /** Legacy inline header (compare pane) — heading + expand/collapse. */
  showHeader?: boolean;
  /** Right-click menu per file row (the log pane); right-click also
   *  selects the row when selection is wired. Absent = no menu. */
  rowMenu?: (path: string) => MenuProps;
}

export interface FileTreeViewHandle {
  expandAll: () => void;
  collapseAll: () => void;
}

const INDENT = 14;

const FileTreeView = forwardRef<FileTreeViewHandle, FileTreeViewProps>(function FileTreeView(
  { files, loadingPath, onOpenFile, selectedPath, onSelectFile, groupByDirectory = true, showHeader = false, rowMenu },
  handleRef,
) {
  const { token } = theme.useToken();
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const tree = useMemo(() => buildFileTree(files, groupByDirectory), [files, groupByDirectory]);
  const dirKeys = useMemo(() => allDirKeys(tree), [tree]);
  // Starts fully expanded (the reference default) — the orchestrator keys this
  // component by commit sha, so a fresh selection resets the state.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const rows = useMemo(() => visibleFileTreeRows(tree, collapsed), [tree, collapsed]);
  const order = useMemo(() => rows.map((row) => row.key), [rows]);
  const { selection, isSelected, click, step, contextMenu } = useMultiSelection(order);
  const selectable = onSelectFile !== undefined;

  useImperativeHandle(
    handleRef,
    () => ({
      expandAll: () => setCollapsed(new Set()),
      collapseAll: () => setCollapsed(new Set(dirKeys)),
    }),
    [dirKeys],
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
    onSelectFile?.(leadFilePath(rows, ids, preferred));

  const handleRowClick = (key: string, event: React.MouseEvent): void => {
    const next = selectOnClick(selection, order, key, clickModifiers(event));
    click(key, event);
    report(next.ids, key);
  };

  const handleRowContextMenu = (key: string): void => {
    contextMenu(key);
    report(selection.ids.has(key) ? selection.ids : new Set([key]), key);
  };

  const landOn = (key: string, extend: boolean): void => {
    const next = selectOnStep(selection, order, key, extend);
    step(key, extend);
    report(next.ids, key);
    containerRef.current?.querySelector(`[data-row-key="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'nearest' });
  };

  // Tree keys (the Commit tree's): Up/Down walk visible rows, Right
  // expands / steps into, Left collapses / steps to the parent, Enter
  // opens a file and toggles a dir.
  const handleKeyDown = (event: React.KeyboardEvent): void => {
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

  const rowStyle = (depth: number): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    width: '100%',
    padding: `4px 12px 4px ${12 + depth * INDENT}px`,
    lineHeight: '16px',
    minHeight: 24,
    boxSizing: 'border-box',
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: 12,
    color: token.colorText,
  });

  // Every row reserves the caret slot — leaves too — so a file sits one
  // indent step right of its directory (the sidebar trees' slot).
  const slotStyle: React.CSSProperties = {
    flex: 'none',
    width: 12,
    display: 'inline-flex',
    justifyContent: 'center',
    fontSize: 9,
    color: token.colorTextTertiary,
  };

  const rowClass = (key: string): string => (selectable && isSelected(key) ? 'git-tool-row selected' : 'git-tool-row');

  const renderNodes = (nodes: readonly FileTreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      if (node.kind === 'dir') {
        const open = !collapsed.has(node.key);
        return (
          <div key={node.key}>
            <button
              type="button"
              className={rowClass(node.key)}
              style={rowStyle(depth)}
              onClick={(event) => (selectable ? handleRowClick(node.key, event) : toggleCollapse(node.key))}
              onDoubleClick={selectable ? () => toggleCollapse(node.key) : undefined}
              onContextMenu={selectable ? () => handleRowContextMenu(node.key) : undefined}
              data-testid="git-tool-file-dir"
              data-key={node.key}
              data-row-key={node.key}
              data-selected={(selectable && isSelected(node.key)) || undefined}
            >
              {/* The caret toggles on its own click when rows select; a plain row click selects. */}
              <span
                aria-hidden
                style={slotStyle}
                onClick={
                  selectable
                    ? (event) => {
                        event.stopPropagation();
                        toggleCollapse(node.key);
                      }
                    : undefined
                }
              >
                {open ? <CaretDownOutlined /> : <CaretRightOutlined />}
              </span>
              <FolderTypeIcon />
              <span
                style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {node.label}
              </span>
              <span style={{ flex: '0 0 auto', fontSize: 11, color: token.colorTextTertiary }}>
                {node.fileCount === 1
                  ? t('workbench.commitTool.oneFile')
                  : t('workbench.gitLog.filesCount', { count: node.fileCount })}
              </span>
            </button>
            {open && renderNodes(node.children, depth + 1)}
          </div>
        );
      }
      const row = (
        <button
          key={node.path}
          type="button"
          className={rowClass(node.path)}
          style={rowStyle(depth)}
          title={node.path}
          onClick={(event) => (selectable ? handleRowClick(node.path, event) : onOpenFile(node.path))}
          onDoubleClick={selectable ? () => onOpenFile(node.path) : undefined}
          onContextMenu={selectable ? () => handleRowContextMenu(node.path) : undefined}
          data-testid="git-tool-file"
          data-path={node.path}
          data-row-key={node.path}
          data-selected={(selectable && isSelected(node.path)) || undefined}
        >
          <span aria-hidden style={slotStyle} />
          <FileTypeIcon path={node.path} status={node.status} />
          <span
            style={{
              flex: '0 1 auto',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: statusColor(node.status, token),
            }}
          >
            {node.label}
          </span>
          {loadingPath === node.path && <Spin size="small" style={{ flex: '0 0 auto' }} />}
        </button>
      );
      if (rowMenu === undefined) return row;
      return (
        <Dropdown
          key={node.path}
          menu={rowMenu(node.path)}
          trigger={['contextMenu']}
          align={contextMenuAlign}
          classNames={{ root: 'commit-tool-row-menu' }}
        >
          {row}
        </Dropdown>
      );
    });

  return (
    <div style={{ flex: '1 1 55%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {showHeader && (
        <div
          style={{
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px 2px 12px',
          }}
        >
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: token.colorText }}>
            {t('workbench.gitLog.filesHeading')}
          </span>
          <Button
            type="text"
            size="small"
            icon={<ExpandAllIcon />}
            title={t('workbench.gitLog.expandAll')}
            onClick={() => setCollapsed(new Set())}
            data-testid="git-tool-files-expand-all"
          />
          <Button
            type="text"
            size="small"
            icon={<CollapseAllIcon />}
            title={t('workbench.gitLog.collapseAll')}
            onClick={() => setCollapsed(new Set(dirKeys))}
            data-testid="git-tool-files-collapse-all"
          />
        </div>
      )}
      <div
        ref={containerRef}
        tabIndex={selectable ? 0 : undefined}
        onKeyDown={handleKeyDown}
        className={selectable ? 'git-tool-file-tree' : undefined}
        style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', paddingBottom: 4 }}
        data-testid="git-tool-file-tree"
      >
        {renderNodes(tree, 0)}
      </div>
    </div>
  );
});

export default FileTreeView;
