/**
 * FileTreeView — the detail pane's top half: the selected commit's
 * changed paths as a compressed directory tree (IDE-log grouping:
 * single-child dir chains fold into one `a/b/c` node with an `N files`
 * badge), filenames colored by porcelain status, expand/collapse-all in
 * the pane's header. Clicking a file opens its old/new diff.
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
import { useMemo, useState } from 'react';
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
}

const INDENT = 14;

const FileTreeView: React.FC<FileTreeViewProps> = ({ files, loadingPath, onOpenFile }) => {
  const { token } = theme.useToken();
  const t = useT();
  const tree = useMemo(() => buildFileTree(files), [files]);
  const dirKeys = useMemo(() => allDirKeys(tree), [tree]);
  // Starts fully expanded (the IDE default) — the orchestrator keys this
  // component by commit sha, so a fresh selection resets the state.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

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
      return (
        <button
          key={node.path}
          type="button"
          className="git-tool-row"
          style={rowStyle(depth)}
          title={node.path}
          onClick={() => onOpenFile(node.path)}
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
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', paddingBottom: 4 }}>
        {renderNodes(tree, 0)}
      </div>
    </div>
  );
};

export default FileTreeView;
