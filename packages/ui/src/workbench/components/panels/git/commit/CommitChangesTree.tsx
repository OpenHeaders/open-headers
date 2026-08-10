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
 * headers; ignored rows are read-only.
 *
 * Interaction model (IDE): click selects any row (the shared
 * grey-echo/vivid-blue selection pair — vivid only while the dock owns
 * focus, so an open context menu greys the band); double-click opens
 * the working diff on files and toggles folders; arrows navigate —
 * Up/Down across visible rows, Right expands / steps in, Left
 * collapses / steps to the parent, Enter opens/toggles, Space flips
 * the row's checkbox (folders and groups flip their whole subtree —
 * checked unless already fully checked). Right-click selects and opens
 * the row context menu (focus moves into the menu).
 */

import { CaretDownOutlined, CaretRightOutlined, FolderOutlined } from '@ant-design/icons';
import type { WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import { Checkbox, Dropdown, theme } from 'antd';
import type { MenuProps } from 'antd';
import type React from 'react';
import { forwardRef, Fragment, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTheme } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { allDirKeys, buildFileTree, type FileTreeNode } from '../file-tree';
import { aggregateChecked, type ChangeGroups, type CheckedState, isRowChecked } from './commit-model';
import { baseName, commitFileRowKey, flatSortedRows, visibleCommitRows } from './commit-tree-nav';
import { FileTypeIcon } from './FileTypeIcon';
import { vcsFileColor, vcsPalette } from './vcs-colors';

export interface CommitChangesTreeProps {
  groups: ChangeGroups;
  checked: CheckedState;
  onSetChecked: (paths: readonly string[], checked: boolean) => void;
  /** Double-click / Enter — open the working diff. */
  onOpenFile: (path: string) => void;
  groupByDirectory: boolean;
  showIgnored: boolean;
  /** Right-click menu for a checkable file row; null = no menu (ignored rows). */
  rowMenu: (row: WorkspaceTreeWorkingChangeWire) => MenuProps | null;
}

export interface CommitChangesTreeHandle {
  expandAll: () => void;
  collapseAll: () => void;
}

const INDENT = 14;
const ROW_FONT = 13;

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
  { groups, checked, onSetChecked, onOpenFile, groupByDirectory, showIgnored, rowMenu },
  handleRef,
) {
  const { token } = theme.useToken();
  const { isDarkMode } = useTheme();
  const t = useT();
  const palette = vcsPalette(isDarkMode);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

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

  // Space toggles the selected row's checkbox: each checkable row key
  // maps to its target path set (a file, a dir's subtree, a group).
  const pathsByRowKey = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const spec of specs) {
      if (!spec.checkable) continue;
      const groupPaths = spec.rows.map((row) => row.path);
      map.set(spec.key, groupPaths);
      map.set(`${spec.key}:__root__`, groupPaths);
      const walk = (nodes: readonly FileTreeNode[]): void => {
        for (const node of nodes) {
          if (node.kind !== 'dir') continue;
          map.set(`${spec.key}:${node.key}`, collectPaths(node));
          walk(node.children);
        }
      };
      walk(trees.get(spec.key) ?? []);
      for (const row of spec.rows) map.set(commitFileRowKey(row.path), [row.path]);
    }
    return map;
  }, [specs, trees]);

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

  const setCollapsedKey = (key: string, value: boolean): void =>
    setCollapsed((prev) => {
      if (prev.has(key) === value) return prev;
      const next = new Set(prev);
      if (value) next.add(key);
      else next.delete(key);
      return next;
    });

  const visibleRows = useMemo(
    () => visibleCommitRows(specs, trees, collapsed, groupByDirectory),
    [specs, trees, collapsed, groupByDirectory],
  );

  const selectRow = useCallback((key: string): void => {
    setSelectedKey(key);
    const container = containerRef.current;
    if (container === null) return;
    container.querySelector(`[data-row-key="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, []);

  // IDE tree keys: Up/Down walk visible rows, Right expands / steps
  // into, Left collapses / steps to the parent, Enter opens files and
  // toggles folders.
  const handleKeyDown = (event: React.KeyboardEvent): void => {
    const keys = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', ' '];
    if (!keys.includes(event.key) || visibleRows.length === 0) return;
    // A focused checkbox keeps its native Space toggle.
    if (event.key === ' ' && event.target instanceof HTMLInputElement) return;
    event.preventDefault();
    if (event.key === ' ') {
      const paths = selectedKey === null ? undefined : pathsByRowKey.get(selectedKey);
      if (paths !== undefined && paths.length > 0) {
        onSetChecked(paths, aggregateChecked(allRows, checked, paths) !== 'all');
      }
      return;
    }
    const index = visibleRows.findIndex((row) => row.key === selectedKey);
    const current = index === -1 ? null : visibleRows[index];
    if (event.key === 'ArrowDown') {
      selectRow(visibleRows[Math.min(index + 1, visibleRows.length - 1)].key);
      return;
    }
    if (event.key === 'ArrowUp') {
      selectRow(visibleRows[Math.max(index - 1, 0)].key);
      return;
    }
    if (current === null) {
      selectRow(visibleRows[0].key);
      return;
    }
    if (event.key === 'ArrowRight') {
      if (current.collapseKey === undefined) return;
      if (current.expanded !== true) setCollapsedKey(current.collapseKey, false);
      else if (index + 1 < visibleRows.length && visibleRows[index + 1].parentKey === current.key) {
        selectRow(visibleRows[index + 1].key);
      }
      return;
    }
    if (event.key === 'ArrowLeft') {
      if (current.collapseKey !== undefined && current.expanded === true) setCollapsedKey(current.collapseKey, true);
      else if (current.parentKey !== null) selectRow(current.parentKey);
      return;
    }
    // Enter
    if (current.kind === 'file' && current.path !== undefined) onOpenFile(current.path);
    else if (current.collapseKey !== undefined) toggleCollapse(current.collapseKey);
  };

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

  const rowClass = (key: string): string => (selectedKey === key ? 'git-tool-row selected' : 'git-tool-row');

  /** "1 file" / "{n} files" — the IDE's singular form at one. */
  const filesCountText = (count: number): string =>
    count === 1 ? t('workbench.commitTool.oneFile') : t('workbench.gitLog.filesCount', { count });

  const directoriesCountText = (count: number): string =>
    count === 1 ? t('workbench.commitTool.oneDirectory') : t('workbench.commitTool.directoriesCount', { count });

  // Group-level count — "1 directory and 6 files" on the group header
  // and its content-root node when the grouped tree carries folder
  // rows; flat mode (no folder rows) keeps the plain file count.
  const groupCountText = (spec: GroupSpec): string => {
    const dirCount = groupByDirectory ? allDirKeys(trees.get(spec.key) ?? []).length : 0;
    const files = filesCountText(spec.rows.length);
    if (dirCount === 0) return files;
    return t('workbench.commitTool.dirsAndFiles', { dirs: directoriesCountText(dirCount), files });
  };

  const renderFileRow = (
    spec: GroupSpec,
    row: WorkspaceTreeWorkingChangeWire,
    depth: number,
    suffix: string,
  ): React.ReactNode => {
    const rowKey = commitFileRowKey(row.path);
    const rowBody = (
      <div
        className={rowClass(rowKey)}
        style={rowStyle(depth)}
        title={row.renamedFrom !== undefined ? `${row.renamedFrom} → ${row.path}` : row.path}
        onClick={() => selectRow(rowKey)}
        onDoubleClick={() => onOpenFile(row.path)}
        onContextMenu={() => selectRow(rowKey)}
        data-testid="commit-tool-file"
        data-path={row.path}
        data-row-key={rowKey}
      >
        {spec.checkable && (
          <Checkbox
            checked={isRowChecked(row, checked)}
            onChange={(event) => onSetChecked([row.path], event.target.checked)}
            data-testid="commit-tool-file-check"
          />
        )}
        <span
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
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
        </span>
      </div>
    );
    const menu = rowMenu(row);
    if (menu === null) return <Fragment key={row.path}>{rowBody}</Fragment>;
    return (
      <Dropdown
        key={row.path}
        menu={menu}
        trigger={['contextMenu']}
        autoFocus
        overlayClassName="commit-tool-row-menu"
        onOpenChange={(open) => {
          if (!open) containerRef.current?.focus({ preventScroll: true });
        }}
      >
        {rowBody}
      </Dropdown>
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
            <div
              className={rowClass(key)}
              style={rowStyle(depth)}
              onClick={() => selectRow(key)}
              onDoubleClick={() => toggleCollapse(key)}
              data-testid="commit-tool-dir"
              data-key={node.key}
              data-row-key={key}
            >
              <button
                type="button"
                aria-label={node.label}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleCollapse(key);
                }}
                style={caretStyle}
              >
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
              <span
                style={{
                  flex: '0 1 auto',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: ROW_FONT,
                }}
              >
                {node.label}
              </span>
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
    flatSortedRows(spec.rows).map((row) => renderFileRow(spec, row, 1, dirSuffix(row.path)));

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
        <div
          className={rowClass(rootKey)}
          style={rowStyle(1)}
          onClick={() => selectRow(rootKey)}
          onDoubleClick={() => toggleCollapse(rootKey)}
          data-testid="commit-tool-root"
          data-row-key={rootKey}
        >
          <button
            type="button"
            aria-label={spec.label}
            onClick={(event) => {
              event.stopPropagation();
              toggleCollapse(rootKey);
            }}
            style={caretStyle}
          >
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
          <span style={{ fontSize: ROW_FONT - 1, color: token.colorTextTertiary }}>{groupCountText(spec)}</span>
        </div>
        {open && renderTreeNodes(spec, trees.get(spec.key) ?? [], 2)}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="commit-tool-tree rules-thin-scrollbar"
      style={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto', paddingBottom: 12 }}
      data-testid="commit-tool-tree"
    >
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
              className={rowClass(spec.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                width: '100%',
                padding: '3px 12px',
                cursor: 'pointer',
              }}
              onClick={() => selectRow(spec.key)}
              onDoubleClick={() => toggleCollapse(spec.key)}
              data-testid={`commit-tool-group-${spec.key}`}
              data-row-key={spec.key}
            >
              <button
                type="button"
                aria-label={spec.label}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleCollapse(spec.key);
                }}
                style={caretStyle}
              >
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
              <span style={{ fontSize: ROW_FONT, fontWeight: 600 }}>{spec.label}</span>
              <span style={{ fontSize: ROW_FONT - 1, color: token.colorTextTertiary }}>{groupCountText(spec)}</span>
            </div>
            {open && (groupByDirectory ? renderRootedTree(spec) : renderFlatRows(spec))}
          </div>
        );
      })}
    </div>
  );
});

export default CommitChangesTree;
