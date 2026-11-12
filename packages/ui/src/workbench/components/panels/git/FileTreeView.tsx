/**
 * FileTreeView — the detail pane's changed-files tree, drawn one of two
 * ways. By what the files belong to in the workbench (Group By
 * Workspace — `NamedFileTree`): the panels' sections, collections and
 * entities by name. Or by path: single-child dir chains fold into one
 * `a/b/c` node with an `N files` badge, or flat full-path rows while
 * Group By Directory is off, filenames behind the Commit tree's
 * file-type icon and colored by porcelain status.
 *
 * Either way the tree behaves the same (`use-file-tree-behaviour`):
 * with a selection handler wired (the log pane, the Push window) the
 * rows ride the shared selection model, the caret and a double-click
 * toggle a row that holds others, a double-click opens a file, the keys
 * walk and fold; the pane's verbs (Show Diff, Jump to Source, the row
 * menu) act on the ONE file the tree reports. Without a selection
 * handler (the compare pane) a click opens the diff directly and the
 * built-in header keeps the expand/collapse pair. Expand All / Collapse
 * All also arrive through the imperative handle when the toolbar lives
 * outside.
 */

import { CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Dropdown, Spin, theme } from 'antd';
import type React from 'react';
import { type ForwardedRef, forwardRef, useCallback, useMemo } from 'react';
import { FileTypeIcon, FolderTypeIcon } from './commit/FileTypeIcon';
import FileTreeFrame from './FileTreeFrame';
import { allDirKeys, buildFileTree, type FileTreeNode, type FileTreeRow, visibleFileTreeRows } from './file-tree';
import { type FileTreeViewProps, fileStatusColor } from './file-tree-view-props';
import { contextMenuAlign } from './git-menu-overflow';
import { WorkspaceFileTree } from './NamedFileTree';
import { type FileTreeViewHandle, useFileTreeBehaviour } from './use-file-tree-behaviour';

export type { FileTreeViewProps } from './file-tree-view-props';
export type { FileTreeViewHandle } from './use-file-tree-behaviour';

const INDENT = 14;

const PathFileTree = ({
  files,
  loadingPath,
  onOpenFile,
  selectedPath,
  onSelectFile,
  groupByDirectory = true,
  showHeader = false,
  rowMenu,
  handleRef,
}: FileTreeViewProps & { handleRef: ForwardedRef<FileTreeViewHandle> }) => {
  const { token } = theme.useToken();
  const t = useT();
  const tree = useMemo(() => buildFileTree(files, groupByDirectory), [files, groupByDirectory]);
  const foldKeys = useMemo(() => allDirKeys(tree), [tree]);
  const rowsOf = useCallback((collapsed: ReadonlySet<string>) => visibleFileTreeRows(tree, collapsed), [tree]);
  const behaviour = useFileTreeBehaviour({ rowsOf, foldKeys, onOpenFile, selectedPath, onSelectFile }, handleRef);
  const { selectable, collapsed, isSelected } = behaviour;
  const rowByKey = useMemo(() => new Map(behaviour.rows.map((row) => [row.key, row])), [behaviour.rows]);
  const rowOf = (key: string, kind: FileTreeRow['kind']): FileTreeRow =>
    rowByKey.get(key) ?? { key, kind, depth: 0, parentKey: null };

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

  const rowClass = (key: string): string => (isSelected(key) ? 'git-tool-row selected' : 'git-tool-row');

  const renderNodes = (nodes: readonly FileTreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      if (node.kind === 'dir') {
        const open = !collapsed.has(node.key);
        const row = rowOf(node.key, 'dir');
        return (
          <div key={node.key}>
            <button
              type="button"
              className={rowClass(node.key)}
              style={rowStyle(depth)}
              onClick={(event) => behaviour.onRowClick(row, event)}
              onDoubleClick={() => behaviour.onRowDoubleClick(row)}
              onContextMenu={() => behaviour.onRowContextMenu(row)}
              data-testid="git-tool-file-dir"
              data-key={node.key}
              data-row-key={node.key}
              data-selected={isSelected(node.key) || undefined}
            >
              {/* The caret toggles on its own click when rows select; a plain row click selects. */}
              <span
                aria-hidden
                style={slotStyle}
                onClick={
                  selectable
                    ? (event) => {
                        event.stopPropagation();
                        behaviour.toggleCollapse(node.key);
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
      const fileRow = rowOf(node.path, 'file');
      const row = (
        <button
          key={node.path}
          type="button"
          className={rowClass(node.path)}
          style={rowStyle(depth)}
          title={node.path}
          onClick={(event) => behaviour.onRowClick(fileRow, event)}
          onDoubleClick={() => behaviour.onRowDoubleClick(fileRow)}
          onContextMenu={() => behaviour.onRowContextMenu(fileRow)}
          data-testid="git-tool-file"
          data-path={node.path}
          data-row-key={node.path}
          data-selected={isSelected(node.path) || undefined}
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
              color: fileStatusColor(node.status, token),
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
    <FileTreeFrame
      containerRef={behaviour.containerRef}
      selectable={selectable}
      showHeader={showHeader}
      onKeyDown={behaviour.onKeyDown}
      onExpandAll={behaviour.expandAll}
      onCollapseAll={behaviour.collapseAll}
    >
      {renderNodes(tree, 0)}
    </FileTreeFrame>
  );
};

const FileTreeView = forwardRef<FileTreeViewHandle, FileTreeViewProps>(function FileTreeView(props, handleRef) {
  return props.groupByWorkspace === true ? (
    <WorkspaceFileTree {...props} handleRef={handleRef} />
  ) : (
    <PathFileTree {...props} handleRef={handleRef} />
  );
});

export default FileTreeView;
