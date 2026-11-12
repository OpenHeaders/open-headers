/**
 * FileTreeFrame — a changed-files tree's shell, whichever way its rows
 * are drawn: the scroll host that holds focus for the keys, and the
 * legacy inline header (the compare pane) — the heading with Expand All
 * / Collapse All.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { CollapseAllIcon, ExpandAllIcon } from '@openheaders/ui/shared/icons';
import { Button, theme } from 'antd';
import type React from 'react';
import type { RefObject } from 'react';

export interface FileTreeFrameProps {
  containerRef: RefObject<HTMLDivElement | null>;
  selectable: boolean;
  showHeader: boolean;
  /** Beside the tree's own: the row family the rows are drawn in. */
  className?: string;
  onKeyDown: (event: React.KeyboardEvent) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  children: React.ReactNode;
}

const FileTreeFrame: React.FC<FileTreeFrameProps> = ({
  containerRef,
  selectable,
  showHeader,
  className,
  onKeyDown,
  onExpandAll,
  onCollapseAll,
  children,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const classes = [selectable ? 'git-tool-file-tree' : '', className ?? ''].filter(Boolean).join(' ');
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
            onClick={onExpandAll}
            data-testid="git-tool-files-expand-all"
          />
          <Button
            type="text"
            size="small"
            icon={<CollapseAllIcon />}
            title={t('workbench.gitLog.collapseAll')}
            onClick={onCollapseAll}
            data-testid="git-tool-files-collapse-all"
          />
        </div>
      )}
      <div
        ref={containerRef}
        tabIndex={selectable ? 0 : undefined}
        onKeyDown={onKeyDown}
        className={classes.length > 0 ? classes : undefined}
        style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', paddingBottom: 4 }}
        data-testid="git-tool-file-tree"
      >
        {children}
      </div>
    </div>
  );
};

export default FileTreeFrame;
