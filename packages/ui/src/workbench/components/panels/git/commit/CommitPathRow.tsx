/**
 * CommitPathRow — one row of the Commit tree where the files are listed
 * by path, and a git group's header in every shape (font, size and
 * format exact to the reference design): the UI font at 12px on the
 * 24px row, per-type file glyphs, a file as basename + a dim directory
 * suffix in the flat run and under its directory's row in the tree. A
 * root-level file's suffix and the content-root node read the binding's
 * folder name. Checkboxes ride file rows, directory nodes and group
 * headers (tri-state); the ignored group's rows are read-only. An empty
 * group is a plain label — no caret, no checkbox, no count.
 *
 * The row draws and hands every gesture back (`commit-row-scope`); the
 * tree owns the selection, the keys and the one context menu.
 */

import { CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons';
import { Checkbox, Spin } from 'antd';
import type React from 'react';
import CommitFileFace, { COMMIT_ROW_FONT } from './CommitFileFace';
import type { CommitRowScope } from './commit-row-scope';
import { COMMIT_ROW_HEIGHT, type CommitTreeRow } from './commit-tree-rows';
import { FolderTypeIcon } from './FileTypeIcon';

export type CommitPathTreeRow = Exclude<CommitTreeRow, { draw: 'section' | 'named' }>;

export interface CommitPathRowProps {
  row: CommitPathTreeRow;
  scope: CommitRowScope;
}

const INDENT = 14;
const ROW_LINE = 16;
// Every row reserves the caret slot — leaves too — so a child's checkbox
// sits one indent step right of its parent's (the sidebar trees' slot).
const CARET_SLOT = 12;

const HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  width: '100%',
  padding: '4px 12px',
  lineHeight: `${ROW_LINE}px`,
  height: COMMIT_ROW_HEIGHT,
  flex: 'none',
  boxSizing: 'border-box',
  cursor: 'pointer',
};

const ELLIPSIS: React.CSSProperties = {
  flex: '0 1 auto',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: COMMIT_ROW_FONT,
};

/** Parent directory shown as the reference dim suffix; empty at the root. */
function dirSuffix(filePath: string): string {
  const cut = filePath.lastIndexOf('/');
  return cut === -1 ? '' : filePath.slice(0, cut);
}

const rowStyle = (depth: number, color: string): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  width: '100%',
  padding: `4px 12px 4px ${12 + depth * INDENT}px`,
  lineHeight: `${ROW_LINE}px`,
  height: COMMIT_ROW_HEIGHT,
  flex: 'none',
  boxSizing: 'border-box',
  border: 'none',
  textAlign: 'left',
  cursor: 'pointer',
  fontSize: COMMIT_ROW_FONT,
  color,
});

/** The fold mark of a row that holds others: its own press folds, and selects nothing. */
function Caret({ label, open, color, onToggle }: { label: string; open: boolean; color: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      style={{
        display: 'inline-flex',
        justifyContent: 'center',
        flex: 'none',
        width: CARET_SLOT,
        border: 'none',
        background: 'transparent',
        padding: 0,
        fontSize: 9,
        color,
        cursor: 'pointer',
      }}
    >
      {open ? <CaretDownOutlined /> : <CaretRightOutlined />}
    </button>
  );
}

const CommitPathRow: React.FC<CommitPathRowProps> = ({ row, scope }) => {
  const face = scope.groupFace(row.group);
  const placed = { 'data-commit-row': row.key, 'data-group': row.group };

  if (row.draw === 'label') {
    return (
      <div
        {...placed}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 12px',
          lineHeight: `${ROW_LINE}px`,
          height: COMMIT_ROW_HEIGHT,
          flex: 'none',
          boxSizing: 'border-box',
        }}
        data-testid={`commit-tool-group-${row.group}`}
      >
        <span style={{ fontSize: COMMIT_ROW_FONT, fontWeight: 600, color: scope.textColor }}>{face.label}</span>
      </div>
    );
  }

  const className = scope.isSelected(row.key) ? 'git-tool-row selected' : 'git-tool-row';

  if (row.draw === 'file') {
    const change = scope.rowsByPath.get(row.path);
    if (change === undefined) return <div {...placed} style={{ flex: 'none', height: COMMIT_ROW_HEIGHT }} />;
    const suffix = row.flat ? dirSuffix(row.path) || scope.rootLabel : '';
    return (
      <div
        {...placed}
        className={className}
        style={rowStyle(row.depth, scope.textColor)}
        onClick={(event) => scope.onRowClick(row.key, event)}
        onDoubleClick={() => scope.onOpenFile(row.path)}
        onMouseEnter={(event) => scope.onRowEnter(event.currentTarget, row.key, change, suffix)}
        onMouseLeave={() => scope.onRowLeave(row.key)}
        data-testid="commit-tool-file"
        data-path={row.path}
        data-row-key={row.key}
      >
        <span aria-hidden style={{ flex: 'none', width: CARET_SLOT }} />
        {face.checkable && (
          <Checkbox
            checked={scope.isChecked(change)}
            onChange={(event) => scope.onSetChecked([row.path], event.target.checked)}
            data-testid="commit-tool-file-check"
          />
        )}
        <span data-row-content style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <CommitFileFace
            row={change}
            suffix={suffix}
            clip
            t={scope.t}
            textColor={scope.textColor}
            dimColor={scope.dimColor}
            palette={scope.palette}
          />
        </span>
        {scope.loadingPath === row.path && <Spin size="small" style={{ flex: '0 0 auto' }} />}
      </div>
    );
  }

  const open = row.nav.expanded === true;
  const toggle = (): void => scope.onToggleFold(row.key);
  const aggregate = face.checkable ? scope.aggregateOf(row.key) : 'none';
  const checkbox = (testid: string): React.ReactNode =>
    face.checkable && (
      <Checkbox
        checked={aggregate === 'all'}
        indeterminate={aggregate === 'some'}
        onChange={(event) => scope.onSetChecked(scope.pathsOf(row.key), event.target.checked)}
        data-testid={testid}
      />
    );
  const gestures = {
    className,
    onClick: (event: React.MouseEvent) => scope.onRowClick(row.key, event),
    onDoubleClick: toggle,
    'data-row-key': row.key,
  };
  const count: React.CSSProperties = { fontSize: COMMIT_ROW_FONT - 1, color: scope.dimColor };

  if (row.draw === 'group') {
    return (
      <div {...placed} {...gestures} style={HEADER_STYLE} data-testid={`commit-tool-group-${row.group}`}>
        <Caret label={face.label} open={open} color={scope.dimColor} onToggle={toggle} />
        {checkbox(`commit-tool-group-${row.group}-check`)}
        <span style={{ fontSize: COMMIT_ROW_FONT, fontWeight: 600 }}>{face.label}</span>
        <span style={count}>{face.countText}</span>
      </div>
    );
  }

  if (row.draw === 'root') {
    // The reference content-root node: a folder row named after the
    // binding's folder with the group's count and its own tri-state.
    return (
      <div {...placed} {...gestures} style={rowStyle(1, scope.textColor)} data-testid="commit-tool-root">
        <Caret label={face.label} open={open} color={scope.dimColor} onToggle={toggle} />
        {checkbox('commit-tool-root-check')}
        <FolderTypeIcon />
        {scope.rootLabel.length > 0 && (
          <span style={ELLIPSIS} data-testid="commit-tool-root-label">
            {scope.rootLabel}
          </span>
        )}
        <span style={count}>{face.countText}</span>
      </div>
    );
  }

  return (
    <div
      {...placed}
      {...gestures}
      style={rowStyle(row.depth, scope.textColor)}
      data-testid="commit-tool-dir"
      data-key={row.node.key}
    >
      <Caret label={row.node.label} open={open} color={scope.dimColor} onToggle={toggle} />
      {checkbox('commit-tool-dir-check')}
      <FolderTypeIcon />
      <span style={ELLIPSIS}>{row.node.label}</span>
      <span style={{ ...count, flex: '0 0 auto' }}>{scope.filesCountText(row.node.fileCount)}</span>
    </div>
  );
};

export default CommitPathRow;
