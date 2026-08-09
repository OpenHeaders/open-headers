/**
 * FileTreeView — the detail pane's changed-paths tree (IDE-log
 * grouping: single-child dir chains fold into one `a/b/c` node with an
 * `N files` badge, or flat full-path rows while Group By Directory is
 * off), filenames colored by porcelain status. With a selection
 * handler wired (the log pane), a click selects the row and a
 * double-click opens the diff — the pane toolbar's Show Diff drives
 * the selection; without one (the compare pane) a click opens the diff
 * directly and the built-in header keeps the expand/collapse pair.
 * Expand All / Collapse All also arrive through the imperative handle
 * when the toolbar lives outside.
 */

import {
  ArrowsAltOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  FolderOutlined,
  ShrinkOutlined,
} from '@ant-design/icons';
import { Button, Spin, theme } from 'antd';
import type React from 'react';
import { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { allDirKeys, buildFileTree, type FileTreeNode } from './file-tree';

/** Porcelain status letter → theme color, IDE-style (added green,
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
  onSelectFile?: (path: string) => void;
  /** Group By Directory (details eye) — off renders flat full paths. */
  groupByDirectory?: boolean;
  /** Legacy inline header (compare pane) — heading + expand/collapse. */
  showHeader?: boolean;
}

export interface FileTreeViewHandle {
  expandAll: () => void;
  collapseAll: () => void;
}

const INDENT = 14;

const FileTreeView = forwardRef<FileTreeViewHandle, FileTreeViewProps>(function FileTreeView(
  { files, loadingPath, onOpenFile, selectedPath, onSelectFile, groupByDirectory = true, showHeader = false },
  handleRef,
) {
  const { token } = theme.useToken();
  const t = useT();
  const tree = useMemo(() => buildFileTree(files, groupByDirectory), [files, groupByDirectory]);
  const dirKeys = useMemo(() => allDirKeys(tree), [tree]);
  // Starts fully expanded (the IDE default) — the orchestrator keys this
  // component by commit sha, so a fresh selection resets the state.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  useImperativeHandle(
    handleRef,
    () => ({
      expandAll: () => setCollapsed(new Set()),
      collapseAll: () => setCollapsed(new Set(dirKeys)),
    }),
    [dirKeys],
  );

  const rowStyle = (depth: number): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    width: '100%',
    padding: `2px 12px 2px ${12 + depth * INDENT}px`,
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: 11.5,
    color: token.colorText,
  });

  const renderNodes = (nodes: readonly FileTreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      if (node.kind === 'dir') {
        const open = !collapsed.has(node.key);
        return (
          <div key={node.key}>
            <button
              type="button"
              className="git-tool-row"
              style={rowStyle(depth)}
              onClick={() =>
                setCollapsed((prev) => {
                  const next = new Set(prev);
                  if (next.has(node.key)) next.delete(node.key);
                  else next.add(node.key);
                  return next;
                })
              }
              data-testid="git-tool-file-dir"
              data-key={node.key}
            >
              <span aria-hidden style={{ flex: '0 0 auto', fontSize: 9, color: token.colorTextTertiary }}>
                {open ? <CaretDownOutlined /> : <CaretRightOutlined />}
              </span>
              <FolderOutlined style={{ flex: '0 0 auto', fontSize: 11, color: token.colorTextTertiary }} />
              <span
                style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {node.label}
              </span>
              <span style={{ flex: '0 0 auto', fontSize: 10.5, color: token.colorTextTertiary }}>
                {t('workbench.gitLog.filesCount', { count: node.fileCount })}
              </span>
            </button>
            {open && renderNodes(node.children, depth + 1)}
          </div>
        );
      }
      const selectable = onSelectFile !== undefined;
      const isSelected = selectable && selectedPath === node.path;
      return (
        <button
          key={node.path}
          type="button"
          className={isSelected ? 'git-tool-row selected' : 'git-tool-row'}
          style={rowStyle(depth)}
          title={node.path}
          onClick={() => (selectable ? onSelectFile(node.path) : onOpenFile(node.path))}
          onDoubleClick={selectable ? () => onOpenFile(node.path) : undefined}
          data-testid="git-tool-file"
          data-path={node.path}
        >
          <span
            style={{
              flex: '0 1 auto',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: token.fontFamilyCode,
              color: statusColor(node.status, token),
            }}
          >
            {node.label}
          </span>
          {loadingPath === node.path && <Spin size="small" style={{ flex: '0 0 auto' }} />}
        </button>
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
          <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: token.colorText }}>
            {t('workbench.gitLog.filesHeading')}
          </span>
          <Button
            type="text"
            size="small"
            icon={<ArrowsAltOutlined />}
            title={t('workbench.gitLog.expandAll')}
            onClick={() => setCollapsed(new Set())}
            data-testid="git-tool-files-expand-all"
          />
          <Button
            type="text"
            size="small"
            icon={<ShrinkOutlined />}
            title={t('workbench.gitLog.collapseAll')}
            onClick={() => setCollapsed(new Set(dirKeys))}
            data-testid="git-tool-files-collapse-all"
          />
        </div>
      )}
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', paddingBottom: 4 }}>
        {renderNodes(tree, 0)}
      </div>
    </div>
  );
});

export default FileTreeView;
