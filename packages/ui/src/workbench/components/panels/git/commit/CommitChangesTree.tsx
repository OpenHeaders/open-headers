/**
 * CommitChangesTree — the Commit window's checkable changes tree (IDE
 * reference, font/size/format-exact): the UI font at 13px (never
 * monospace), per-type file glyphs, and the IDE's default FLAT format —
 * basename + a dim directory suffix (`modules.xml  .idea`) sorted by
 * filename — switching to the compressed directory tree when Group By
 * Directory is on. The Changes group header renders even when empty
 * (the IDE's default changelist); Unversioned / Ignored appear only
 * with rows, and group headers are transparent like tree rows.
 * Checkboxes ride file rows, directory nodes (tri-state), and group
 * headers; ignored rows are read-only. Click selects, double-click
 * opens the working diff.
 */

import { CaretDownOutlined, CaretRightOutlined, FolderOutlined } from '@ant-design/icons';
import type { WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import { Checkbox, theme } from 'antd';
import type React from 'react';
import { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { useTheme } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { allDirKeys, buildFileTree, type FileTreeNode } from '../file-tree';
import { aggregateChecked, type ChangeGroups, type CheckedState, isRowChecked } from './commit-model';
import { FileTypeIcon } from './FileTypeIcon';
import { vcsFileColor, vcsPalette } from './vcs-colors';

export interface CommitChangesTreeProps {
  groups: ChangeGroups;
  checked: CheckedState;
  onSetChecked: (paths: readonly string[], checked: boolean) => void;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  /** Double-click — open the working-tree diff. */
  onOpenFile: (path: string) => void;
  groupByDirectory: boolean;
  showIgnored: boolean;
}

export interface CommitChangesTreeHandle {
  expandAll: () => void;
  collapseAll: () => void;
}

const INDENT = 14;
const ROW_FONT = 13;

/** Basename of a repo-relative path. */
function baseName(filePath: string): string {
  return filePath.slice(filePath.lastIndexOf('/') + 1);
}

/** Parent directory shown as the IDE's dim suffix; empty at the root. */
function dirSuffix(filePath: string): string {
  const cut = filePath.lastIndexOf('/');
  return cut === -1 ? '' : filePath.slice(0, cut);
}

/** Every file path beneath a tree node — the dir checkbox's target set. */
function collectPaths(node: FileTreeNode): string[] {
  if (node.kind === 'file') return [node.path];
  return node.children.flatMap(collectPaths);
}

interface GroupSpec {
  key: 'changes' | 'unversioned' | 'ignored';
  label: string;
  rows: WorkspaceTreeWorkingChangeWire[];
  checkable: boolean;
}

const CommitChangesTree = forwardRef<CommitChangesTreeHandle, CommitChangesTreeProps>(function CommitChangesTree(
  { groups, checked, onSetChecked, selectedPath, onSelectFile, onOpenFile, groupByDirectory, showIgnored },
  handleRef,
) {
  const { token } = theme.useToken();
  const { isDarkMode } = useTheme();
  const t = useT();
  const palette = vcsPalette(isDarkMode);

  // The Changes group is the IDE's default changelist — always present,
  // even empty; the other groups appear only with rows.
  const specs = useMemo<GroupSpec[]>(() => {
    const list: GroupSpec[] = [
      { key: 'changes', label: t('workbench.commitTool.groups.changes'), rows: groups.changes, checkable: true },
    ];
    if (groups.unversioned.length > 0) {
      list.push({
        key: 'unversioned',
        label: t('workbench.commitTool.groups.unversioned'),
        rows: groups.unversioned,
        checkable: true,
      });
    }
    if (showIgnored && groups.ignored.length > 0) {
      list.push({ key: 'ignored', label: t('workbench.commitTool.groups.ignored'), rows: groups.ignored, checkable: false });
    }
    return list;
  }, [groups, showIgnored, t]);

  const trees = useMemo(
    () =>
      groupByDirectory
        ? new Map(specs.map((spec) => [spec.key, buildFileTree(spec.rows, true)]))
        : new Map<GroupSpec['key'], FileTreeNode[]>(),
    [specs, groupByDirectory],
  );
  const allRows = useMemo(() => specs.flatMap((spec) => spec.rows), [specs]);
  const rowsByPath = useMemo(() => new Map(allRows.map((row) => [row.path, row])), [allRows]);

  // Collapse keys are `<group>` for headers, `<group>:__root__` for
  // the content-root node, and `<group>:<dirKey>` for dirs —
  // everything starts expanded (the IDE default).
  const collapseKeys = useMemo(() => {
    const keys: string[] = [];
    for (const spec of specs) {
      keys.push(spec.key, `${spec.key}:__root__`);
      for (const dirKey of allDirKeys(trees.get(spec.key) ?? [])) keys.push(`${spec.key}:${dirKey}`);
    }
    return keys;
  }, [specs, trees]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  useImperativeHandle(
    handleRef,
    () => ({
      expandAll: () => setCollapsed(new Set()),
      collapseAll: () => setCollapsed(new Set(collapseKeys)),
    }),
    [collapseKeys],
  );

  const toggleCollapse = (key: string): void =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const rowStyle = (depth: number): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    padding: `3px 12px 3px ${12 + depth * INDENT}px`,
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: ROW_FONT,
    color: token.colorText,
    background: 'transparent',
  });

  const caretStyle: React.CSSProperties = {
    display: 'inline-flex',
    border: 'none',
    background: 'transparent',
    padding: 0,
    fontSize: 9,
    color: token.colorTextTertiary,
    cursor: 'pointer',
  };

  const bareLabelStyle: React.CSSProperties = {
    border: 'none',
    background: 'transparent',
    padding: 0,
    fontSize: ROW_FONT,
    color: token.colorText,
    cursor: 'pointer',
    textAlign: 'left',
  };

  /** "1 file" / "{n} files" — the IDE's singular form at one. */
  const filesCountText = (count: number): string =>
    count === 1 ? t('workbench.commitTool.oneFile') : t('workbench.gitLog.filesCount', { count });

  const renderFileRow = (
    spec: GroupSpec,
    row: WorkspaceTreeWorkingChangeWire,
    depth: number,
    suffix: string,
  ): React.ReactNode => {
    const isSelected = selectedPath === row.path;
    return (
      <div
        key={row.path}
        className={isSelected ? 'git-tool-row selected' : 'git-tool-row'}
        style={rowStyle(depth)}
        title={row.renamedFrom !== undefined ? `${row.renamedFrom} → ${row.path}` : row.path}
        data-testid="commit-tool-file"
        data-path={row.path}
      >
        {spec.checkable && (
          <Checkbox
            checked={isRowChecked(row, checked)}
            onChange={(event) => onSetChecked([row.path], event.target.checked)}
            data-testid="commit-tool-file-check"
          />
        )}
        <button
          type="button"
          onClick={() => onSelectFile(row.path)}
          onDoubleClick={() => onOpenFile(row.path)}
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            border: 'none',
            background: 'transparent',
            padding: 0,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <FileTypeIcon path={row.path} />
          <span
            style={{
              flex: '0 1 auto',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: ROW_FONT,
              color: vcsFileColor(row, palette),
            }}
          >
            {baseName(row.path)}
          </span>
          {suffix.length > 0 && (
            <span
              style={{
                flex: '0 1 auto',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: ROW_FONT,
                color: token.colorTextTertiary,
              }}
            >
              {suffix}
            </span>
          )}
        </button>
      </div>
    );
  };

  const renderTreeNodes = (spec: GroupSpec, nodes: readonly FileTreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      if (node.kind === 'dir') {
        const key = `${spec.key}:${node.key}`;
        const open = !collapsed.has(key);
        const paths = collectPaths(node);
        const aggregate = aggregateChecked(allRows, checked, paths);
        return (
          <div key={key}>
            <div className="git-tool-row" style={rowStyle(depth)} data-testid="commit-tool-dir" data-key={node.key}>
              <button type="button" aria-label={node.label} onClick={() => toggleCollapse(key)} style={caretStyle}>
                {open ? <CaretDownOutlined /> : <CaretRightOutlined />}
              </button>
              {spec.checkable && (
                <Checkbox
                  checked={aggregate === 'all'}
                  indeterminate={aggregate === 'some'}
                  onChange={(event) => onSetChecked(paths, event.target.checked)}
                  data-testid="commit-tool-dir-check"
                />
              )}
              <FolderOutlined style={{ flex: '0 0 auto', fontSize: 14, color: token.colorTextTertiary }} />
              <button
                type="button"
                onClick={() => toggleCollapse(key)}
                style={{
                  ...bareLabelStyle,
                  flex: '0 1 auto',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {node.label}
              </button>
              <span style={{ flex: '0 0 auto', fontSize: ROW_FONT - 1, color: token.colorTextTertiary }}>
                {filesCountText(node.fileCount)}
              </span>
            </div>
            {open && renderTreeNodes(spec, node.children, depth + 1)}
          </div>
        );
      }
      const row = rowsByPath.get(node.path);
      if (row === undefined) return null;
      return renderFileRow(spec, row, depth, '');
    });

  // The IDE's default flat format: filename + dim directory suffix,
  // sorted by filename.
  const renderFlatRows = (spec: GroupSpec): React.ReactNode =>
    [...spec.rows]
      .sort((a, b) => baseName(a.path).localeCompare(baseName(b.path)) || a.path.localeCompare(b.path))
      .map((row) => renderFileRow(spec, row, 1, dirSuffix(row.path)));

  // The IDE's content-root node under each group when grouping: a
  // nameless folder row carrying only the gray count, its own
  // tri-state checkbox, and the whole tree beneath it.
  const renderRootedTree = (spec: GroupSpec): React.ReactNode => {
    const rootKey = `${spec.key}:__root__`;
    const open = !collapsed.has(rootKey);
    const paths = spec.rows.map((row) => row.path);
    const aggregate = spec.checkable ? aggregateChecked(allRows, checked, paths) : 'none';
    return (
      <div>
        <div className="git-tool-row" style={rowStyle(1)} data-testid="commit-tool-root">
          <button type="button" aria-label={spec.label} onClick={() => toggleCollapse(rootKey)} style={caretStyle}>
            {open ? <CaretDownOutlined /> : <CaretRightOutlined />}
          </button>
          {spec.checkable && (
            <Checkbox
              checked={aggregate === 'all'}
              indeterminate={aggregate === 'some'}
              onChange={(event) => onSetChecked(paths, event.target.checked)}
              data-testid="commit-tool-root-check"
            />
          )}
          <FolderOutlined style={{ flex: '0 0 auto', fontSize: 14, color: token.colorTextTertiary }} />
          <button
            type="button"
            onClick={() => toggleCollapse(rootKey)}
            style={{ ...bareLabelStyle, fontSize: ROW_FONT - 1, color: token.colorTextTertiary }}
          >
            {filesCountText(spec.rows.length)}
          </button>
        </div>
        {open && renderTreeNodes(spec, trees.get(spec.key) ?? [], 2)}
      </div>
    );
  };

  return (
    <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', paddingBottom: 4 }} data-testid="commit-tool-tree">
      {specs.map((spec) => {
        const open = !collapsed.has(spec.key);
        const aggregate = spec.checkable
          ? aggregateChecked(
              allRows,
              checked,
              spec.rows.map((row) => row.path),
            )
          : 'none';
        // An empty group is a plain label row — no caret, no checkbox,
        // no count (the IDE's empty default changelist).
        if (spec.rows.length === 0) {
          return (
            <div
              key={spec.key}
              style={{ display: 'flex', alignItems: 'center', padding: '3px 12px' }}
              data-testid={`commit-tool-group-${spec.key}`}
            >
              <span style={{ fontSize: ROW_FONT, fontWeight: 600, color: token.colorText }}>{spec.label}</span>
            </div>
          );
        }
        return (
          <div key={spec.key}>
            <div
              className="git-tool-row"
              style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '3px 12px' }}
              data-testid={`commit-tool-group-${spec.key}`}
            >
              <button type="button" aria-label={spec.label} onClick={() => toggleCollapse(spec.key)} style={caretStyle}>
                {open ? <CaretDownOutlined /> : <CaretRightOutlined />}
              </button>
              {spec.checkable && (
                <Checkbox
                  checked={aggregate === 'all'}
                  indeterminate={aggregate === 'some'}
                  onChange={(event) =>
                    onSetChecked(
                      spec.rows.map((row) => row.path),
                      event.target.checked,
                    )
                  }
                  data-testid={`commit-tool-group-${spec.key}-check`}
                />
              )}
              <button type="button" onClick={() => toggleCollapse(spec.key)} style={{ ...bareLabelStyle, fontWeight: 600 }}>
                {spec.label}
              </button>
              <span style={{ fontSize: ROW_FONT - 1, color: token.colorTextTertiary }}>
                {filesCountText(spec.rows.length)}
              </span>
            </div>
            {open && (groupByDirectory ? renderRootedTree(spec) : renderFlatRows(spec))}
          </div>
        );
      })}
    </div>
  );
});

export default CommitChangesTree;
