/**
 * PathFileRows — a changed-files tree's rows by path: a directory row
 * with its `N files` badge and the rows under it, a file behind the
 * Commit tree's file-type icon, its name in its change's colour. Drawn
 * against a row scope (`use-file-tree-behaviour`), so the same rows
 * serve a tree of one listing and one group of a tree that lists
 * several.
 */

import { CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Dropdown, type MenuProps, Spin, theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { FileTypeIcon, FolderTypeIcon } from './commit/FileTypeIcon';
import type { FileTreeNode, FileTreeRow } from './file-tree';
import { fileStatusColor } from './file-tree-view-props';
import { contextMenuAlign } from './git-menu-overflow';
import type { FileTreeRowScope } from './use-file-tree-behaviour';

const INDENT = 14;

export interface PathFileRowsProps {
  nodes: readonly FileTreeNode[];
  scope: FileTreeRowScope<FileTreeRow>;
  /** The depth the top rows sit at — one, under a group's heading. */
  depth?: number;
  /** Path currently fetching its diff (per-file spinner). */
  loadingPath: string | null;
  /** Right-click menu of a file's row; absent = no menu. */
  rowMenu?: (path: string) => MenuProps;
}

const PathFileRows: React.FC<PathFileRowsProps> = ({ nodes, scope, depth = 0, loadingPath, rowMenu }) => {
  const { token } = theme.useToken();
  const t = useT();
  const { selectable, collapsed, isSelected, keyOf } = scope;
  const rowByKey = useMemo(() => new Map(scope.rows.map((row) => [row.key, row])), [scope.rows]);
  const rowOf = (key: string, kind: FileTreeRow['kind']): FileTreeRow =>
    rowByKey.get(key) ?? { key, kind, depth: 0, parentKey: null };

  const rowStyle = (at: number): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    width: '100%',
    padding: `4px 12px 4px ${12 + at * INDENT}px`,
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

  const renderNodes = (list: readonly FileTreeNode[], at: number): React.ReactNode =>
    list.map((node) => {
      if (node.kind === 'dir') {
        const open = !collapsed.has(node.key);
        const row = rowOf(node.key, 'dir');
        return (
          <div key={node.key}>
            <button
              type="button"
              className={rowClass(node.key)}
              style={rowStyle(at)}
              onClick={(event) => scope.onRowClick(row, event)}
              onDoubleClick={() => scope.onRowDoubleClick(row)}
              onContextMenu={() => scope.onRowContextMenu(row)}
              data-testid="git-tool-file-dir"
              data-key={node.key}
              data-row-key={keyOf(node.key)}
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
                        scope.toggleCollapse(node.key);
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
            {open && renderNodes(node.children, at + 1)}
          </div>
        );
      }
      const fileRow = rowOf(node.path, 'file');
      const row = (
        <button
          key={node.path}
          type="button"
          className={rowClass(node.path)}
          style={rowStyle(at)}
          title={node.path}
          onClick={(event) => scope.onRowClick(fileRow, event)}
          onDoubleClick={() => scope.onRowDoubleClick(fileRow)}
          onContextMenu={() => scope.onRowContextMenu(fileRow)}
          data-testid="git-tool-file"
          data-path={node.path}
          data-row-key={keyOf(node.path)}
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

  return <>{renderNodes(nodes, depth)}</>;
};

export default PathFileRows;
