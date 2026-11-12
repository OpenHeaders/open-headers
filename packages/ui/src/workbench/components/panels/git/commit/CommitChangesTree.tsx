/**
 * CommitChangesTree — the Commit window's checkable changes tree (font,
 * size and format exact to the reference design): the UI font at 12px on the
 * sidebar trees' 24px row (never monospace), per-type file glyphs,
 * and the reference default FLAT format — basename + a dim directory
 * suffix (`modules.xml  .idea`) sorted by filename — switching to the
 * compressed directory tree when Group By Directory is on, or — Group
 * By Workspace, `named` — each group's files listed by what they belong
 * to in the workbench, in the panels' own rows (`CommitNamedRows`). A
 * root-level file's suffix (and the grouped tree's content-root node)
 * reads the binding's folder name — the reference names the content root.
 * The Changes group header renders even when empty
 * (the reference default changelist); Unversioned / Ignored appear only
 * with rows, and group headers are transparent like tree rows. The
 * content-root node compresses away when a group's tree is one
 * single-child directory chain (the reference folds the root into the
 * chain); Ignored Files counts read plain files. Checkboxes ride file
 * rows, directory nodes (tri-state), and group headers; ignored rows
 * are read-only.
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
 */

import { CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons';
import type { WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import { Checkbox, Dropdown, theme } from 'antd';
import type { MenuProps } from 'antd';
import type React from 'react';
import { forwardRef, Fragment, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useMultiSelection } from '@openheaders/ui/shared/selection';
import { allDirKeys, buildFileTree, type FileTreeNode } from '../file-tree';
import { contextMenuAlign } from '../git-menu-overflow';
import { namedSections } from '../named-file-tree';
import {
  aggregateChecked,
  type ChangeGroupKey,
  type ChangeGroups,
  type CheckedState,
  type CommitMenuTarget,
  isRowChecked,
} from './commit-model';
import {
  type CommitNamedGroups,
  commitNamedFoldKeys,
  commitNamedPaths,
  commitNamedSections,
  visibleCommitNamedRows,
} from './commit-named-tree';
import { baseName, commitFileRowKey, flatSortedRows, rootCompressed, visibleCommitRows } from './commit-tree-nav';
import CommitNamedRows from './CommitNamedRows';
import { FileTypeIcon, FolderTypeIcon } from './FileTypeIcon';
import { ignoreSourceLabel } from './ignore-source-label';
import { vcsFileColor, vcsPalette } from './vcs-colors';

export interface CommitChangesTreeProps {
  groups: ChangeGroups;
  checked: CheckedState;
  onSetChecked: (paths: readonly string[], checked: boolean) => void;
  /** Double-click / Enter — open the working diff. */
  onOpenFile: (path: string) => void;
  groupByDirectory: boolean;
  /**
   * Group By Workspace: each group's files as the workbench lists what
   * they belong to — Group By Directory then shapes only the user's own
   * files. Absent: the files are listed by path.
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
const INDENT = 14;
const ROW_FONT = 12;
const ROW_LINE = 16;
const ROW_MIN_HEIGHT = 24;
// Every row reserves the caret slot — leaves too — so a child's checkbox
// sits one indent step right of its parent's (the sidebar trees' slot).
const CARET_SLOT = 12;

/** Parent directory shown as the reference dim suffix; empty at the root. */
function dirSuffix(filePath: string): string {
  const cut = filePath.lastIndexOf('/');
  return cut === -1 ? '' : filePath.slice(0, cut);
}

/** Every file path beneath a tree node — the dir checkbox's target set. */
function collectPaths(node: FileTreeNode): string[] {
  if (node.kind === 'file') return [node.path];
  return node.children.flatMap(collectPaths);
}

/** The hovered clipped row the overlay expands. */
interface ExpandedRow {
  key: string;
  left: number;
  top: number;
  height: number;
  row: WorkspaceTreeWorkingChangeWire;
  suffix: string;
}

/** True when any ellipsized span inside `element` hides part of its text. */
function hasClippedChild(element: HTMLElement): boolean {
  for (const child of element.querySelectorAll<HTMLElement>('span')) {
    if (child.scrollWidth > child.clientWidth + 1) return true;
  }
  return false;
}

interface GroupSpec {
  key: ChangeGroupKey;
  label: string;
  rows: WorkspaceTreeWorkingChangeWire[];
  checkable: boolean;
  /** reference anatomy: Ignored Files counts read plain files ("6 files"), never "N directories and…". */
  countDirs: boolean;
}

const CommitChangesTree = forwardRef<CommitChangesTreeHandle, CommitChangesTreeProps>(function CommitChangesTree(
  {
    groups,
    checked,
    onSetChecked,
    onOpenFile,
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
  const [expanded, setExpanded] = useState<ExpandedRow | null>(null);

  useEffect(() => {
    if (expanded === null) return;
    const container = containerRef.current;
    const clear = (): void => setExpanded(null);
    container?.addEventListener('scroll', clear, { passive: true });
    window.addEventListener('resize', clear);
    return () => {
      container?.removeEventListener('scroll', clear);
      window.removeEventListener('resize', clear);
    };
  }, [expanded]);

  // The Changes group is the reference default changelist — always present,
  // even empty; the other groups appear only with rows.
  const specs = useMemo<GroupSpec[]>(() => {
    const list: GroupSpec[] = [
      {
        key: 'changes',
        label: t('workbench.commitTool.groups.changes'),
        rows: groups.changes,
        checkable: true,
        countDirs: true,
      },
    ];
    if (groups.unversioned.length > 0) {
      list.push({
        key: 'unversioned',
        label: t('workbench.commitTool.groups.unversioned'),
        rows: groups.unversioned,
        checkable: true,
        countDirs: true,
      });
    }
    if (showIgnored && groups.ignored.length > 0) {
      list.push({
        key: 'ignored',
        label: t('workbench.commitTool.groups.ignored'),
        rows: groups.ignored,
        checkable: false,
        countDirs: false,
      });
    }
    return list;
  }, [groups, showIgnored, t]);

  // By what the files belong to: each group's sections, the user's own
  // files shaped by Group By Directory; null while listed by path.
  const namedByGroup = useMemo(
    () =>
      named === undefined
        ? null
        : new Map(specs.map((spec) => [spec.key, namedSections(named.get(spec.key) ?? [], groupByDirectory)])),
    [named, specs, groupByDirectory],
  );
  const trees = useMemo(
    () =>
      groupByDirectory && namedByGroup === null
        ? new Map(specs.map((spec) => [spec.key, buildFileTree(spec.rows, true)]))
        : new Map<GroupSpec['key'], FileTreeNode[]>(),
    [specs, groupByDirectory, namedByGroup],
  );
  const allRows = useMemo(() => specs.flatMap((spec) => spec.rows), [specs]);
  const rowsByPath = useMemo(() => new Map(allRows.map((row) => [row.path, row])), [allRows]);

  // Space toggles the selected row's checkbox: each checkable row key
  // maps to its target path set (a file, a dir's subtree, a group — and,
  // by what the files belong to, a named row's or a section's files).
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
      for (const [key, paths] of commitNamedPaths(spec.key, namedByGroup?.get(spec.key) ?? [])) map.set(key, paths);
      for (const row of spec.rows) map.set(commitFileRowKey(row.path), [row.path]);
    }
    return map;
  }, [specs, trees, namedByGroup]);

  // Collapse keys are `<group>` for headers, `<group>:__root__` for
  // the content-root node, and `<group>:<dirKey>` for dirs — by what
  // the files belong to, a group's sections and its rows that hold
  // others (`commit-named-tree`). Everything starts expanded (the
  // reference default).
  const collapseKeys = useMemo(() => {
    const keys: string[] = [];
    for (const spec of specs) {
      keys.push(spec.key);
      const sections = namedByGroup?.get(spec.key);
      if (sections !== undefined) {
        keys.push(...commitNamedFoldKeys(spec.key, sections));
        continue;
      }
      if (!rootCompressed(trees.get(spec.key) ?? [])) keys.push(`${spec.key}:__root__`);
      for (const dirKey of allDirKeys(trees.get(spec.key) ?? [])) keys.push(`${spec.key}:${dirKey}`);
    }
    return keys;
  }, [specs, trees, namedByGroup]);
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

  const namedShown = useMemo(
    () =>
      namedByGroup === null
        ? null
        : new Map(specs.map((spec) => [spec.key, commitNamedSections(spec.key, namedByGroup.get(spec.key) ?? [], collapsed)])),
    [specs, namedByGroup, collapsed],
  );
  const visibleRows = useMemo(
    () =>
      namedShown === null
        ? visibleCommitRows(specs, trees, collapsed, groupByDirectory)
        : visibleCommitNamedRows(specs, namedShown, collapsed),
    [specs, trees, collapsed, groupByDirectory, namedShown],
  );

  const rowOrder = useMemo(() => visibleRows.map((row) => row.key), [visibleRows]);
  const { selection, isSelected, click: clickRow, step, contextMenu: contextMenuRow } = useMultiSelection(rowOrder);
  // The keyboard cursor — the row Enter opens and the arrows move from.
  const selectedKey = selection.lead;

  // The keyboard lands on a row: plain collapses the selection onto it,
  // Shift extends the range from the anchor.
  const selectRow = useCallback(
    (key: string, extend = false): void => {
      step(key, extend);
      const container = containerRef.current;
      if (container === null) return;
      container.querySelector(`[data-row-key="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'nearest' });
    },
    [step],
  );

  // The file rows the selection covers — every selected key's paths
  // (a dir or group brings its subtree), ignored rows excluded.
  const selectionRows = useMemo<WorkspaceTreeWorkingChangeWire[]>(() => {
    if (selection.ids.size === 0) return [];
    const paths = new Set<string>();
    for (const key of selection.ids) for (const path of pathsByRowKey.get(key) ?? []) paths.add(path);
    const rows: WorkspaceTreeWorkingChangeWire[] = [];
    for (const row of allRows) if (paths.has(row.path) && !row.ignored) rows.push(row);
    return rows;
  }, [selection, pathsByRowKey, allRows]);
  // The multi-row menu target — one selected row keeps its own anatomy.
  const selectedRows = selection.ids.size < 2 ? EMPTY_ROWS : selectionRows;

  useEffect(() => {
    onSelectionChange?.(selectionRows);
  }, [onSelectionChange, selectionRows]);

  /** The row's menu target — the multi-row union when the row sits in a wider selection. */
  const menuTargetFor = (key: string, single: CommitMenuTarget): CommitMenuTarget =>
    selectedRows.length > 0 && isSelected(key) ? { kind: 'files', rows: selectedRows } : single;

  // Tree keys: Up/Down walk visible rows, Right expands / steps
  // into, Left collapses / steps to the parent, Enter opens files and
  // toggles folders.
  const handleKeyDown = (event: React.KeyboardEvent): void => {
    const keys = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', ' '];
    if (!keys.includes(event.key) || visibleRows.length === 0) return;
    // A focused checkbox keeps its native Space toggle.
    if (event.key === ' ' && event.target instanceof HTMLInputElement) return;
    event.preventDefault();
    if (event.key === ' ') {
      const paths: string[] = [];
      for (const key of selection.ids) paths.push(...(pathsByRowKey.get(key) ?? []));
      if (paths.length > 0) onSetChecked(paths, aggregateChecked(allRows, checked, paths) !== 'all');
      return;
    }
    const index = visibleRows.findIndex((row) => row.key === selectedKey);
    const current = index === -1 ? null : visibleRows[index];
    if (event.key === 'ArrowDown') {
      selectRow(visibleRows[Math.min(index + 1, visibleRows.length - 1)].key, event.shiftKey);
      return;
    }
    if (event.key === 'ArrowUp') {
      selectRow(visibleRows[Math.max(index - 1, 0)].key, event.shiftKey);
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
    padding: `4px 12px 4px ${12 + depth * INDENT}px`,
    lineHeight: `${ROW_LINE}px`,
    minHeight: ROW_MIN_HEIGHT,
    boxSizing: 'border-box',
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: ROW_FONT,
    color: token.colorText,
  });

  const caretStyle: React.CSSProperties = {
    display: 'inline-flex',
    justifyContent: 'center',
    flex: 'none',
    width: CARET_SLOT,
    border: 'none',
    background: 'transparent',
    padding: 0,
    fontSize: 9,
    color: token.colorTextTertiary,
    cursor: 'pointer',
  };

  const rowClass = (key: string): string => (isSelected(key) ? 'git-tool-row selected' : 'git-tool-row');

  /**
   * The row's context menu wrapper — focus returns to the tree when the
   * menu closes, unless the verb already moved it (Commit File… focuses
   * the message box; the close must not steal it back).
   */
  const withMenu = (target: CommitMenuTarget, body: React.ReactElement): React.ReactNode => {
    const menu = rowMenu(target);
    if (menu === null) return body;
    return (
      <Dropdown
        menu={menu}
        trigger={['contextMenu']}
        align={contextMenuAlign}
        autoFocus
        classNames={{ root: 'commit-tool-row-menu' }}
        onOpenChange={(open) => {
          if (open) return;
          const active = document.activeElement;
          const idle = active === null || active === document.body || active.closest('.commit-tool-row-menu') !== null;
          if (idle) containerRef.current?.focus({ preventScroll: true });
        }}
      >
        {body}
      </Dropdown>
    );
  };

  /** "1 file" / "{n} files" — the reference singular form at one. */
  const filesCountText = (count: number): string =>
    count === 1 ? t('workbench.commitTool.oneFile') : t('workbench.gitLog.filesCount', { count });

  const directoriesCountText = (count: number): string =>
    count === 1 ? t('workbench.commitTool.oneDirectory') : t('workbench.commitTool.directoriesCount', { count });

  // Group-level count — "1 directory and 6 files" on the group header
  // and its content-root node when the grouped tree carries folder
  // rows; flat mode (no folder rows) and Ignored Files (plain file
  // count per the reference) skip the directories part.
  const groupCountText = (spec: GroupSpec): string => {
    const dirCount = groupByDirectory && spec.countDirs ? allDirKeys(trees.get(spec.key) ?? []).length : 0;
    const files = filesCountText(spec.rows.length);
    if (dirCount === 0) return files;
    return t('workbench.commitTool.dirsAndFiles', { dirs: directoriesCountText(dirCount), files });
  };

  /**
   * One row's content — the type icon, the colored filename, the
   * rename note, the dim directory suffix and an ignored row's source.
   * `clip` renders the in-tree form (the filename holds its width, the
   * suffix takes the ellipsis); off, the expanded overlay's full form.
   */
  const renderRowContent = (row: WorkspaceTreeWorkingChangeWire, suffix: string, clip: boolean): React.ReactNode => {
    const dim: React.CSSProperties = clip
      ? {
          flex: '0 1 auto',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: ROW_FONT,
          color: token.colorTextTertiary,
        }
      : { flex: '0 0 auto', whiteSpace: 'nowrap', fontSize: ROW_FONT, color: token.colorTextTertiary };
    return (
      <>
        <FileTypeIcon path={row.path} status={row.status} symlink={row.symlink} />
        <span
          style={{
            flex: '0 0 auto',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: ROW_FONT,
            color: vcsFileColor(row, palette),
          }}
        >
          {baseName(row.path)}
        </span>
        {row.renamedFrom !== undefined && (
          <span
            style={{ flex: '0 0 auto', whiteSpace: 'nowrap', fontSize: ROW_FONT, color: token.colorText }}
            data-testid="commit-tool-renamed-from"
          >
            {t('workbench.commitTool.renamedFrom', { name: baseName(row.renamedFrom) })}
          </span>
        )}
        {suffix.length > 0 && <span style={dim}>{suffix}</span>}
        {row.ignored && row.ignoreSource !== undefined && (
          <span style={dim} data-testid="commit-tool-ignore-source">
            {ignoreSourceLabel(t, row.ignoreSource)}
          </span>
        )}
      </>
    );
  };

  // The expanding hover overlay: a row whose content is clipped shows
  // its full form over itself on hover, reaching past the panel edge
  // (the reference gesture); a row that fits shows nothing. Measured
  // on enter only; a scroll or the pointer leaving the row clears it.
  const revealClippedRow = (
    rowElement: HTMLElement,
    key: string,
    row: WorkspaceTreeWorkingChangeWire,
    suffix: string,
  ): void => {
    const content = rowElement.querySelector<HTMLElement>('[data-row-content]');
    if (content === null) return;
    const clipped = content.scrollWidth > content.clientWidth + 1 || hasClippedChild(content);
    if (!clipped) return;
    const rowRect = rowElement.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    setExpanded({ key, left: contentRect.left, top: rowRect.top, height: rowRect.height, row, suffix });
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
        onClick={(event) => clickRow(rowKey, event)}
        onDoubleClick={() => onOpenFile(row.path)}
        onContextMenu={() => contextMenuRow(rowKey)}
        onMouseEnter={(event) => revealClippedRow(event.currentTarget, rowKey, row, suffix)}
        onMouseLeave={() => setExpanded((prev) => (prev !== null && prev.key === rowKey ? null : prev))}
        data-testid="commit-tool-file"
        data-path={row.path}
        data-row-key={rowKey}
      >
        <span aria-hidden style={{ flex: 'none', width: CARET_SLOT }} />
        {spec.checkable && (
          <Checkbox
            checked={isRowChecked(row, checked)}
            onChange={(event) => onSetChecked([row.path], event.target.checked)}
            data-testid="commit-tool-file-check"
          />
        )}
        <span
          data-row-content
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {renderRowContent(row, suffix, true)}
        </span>
      </div>
    );
    return <Fragment key={row.path}>{withMenu(menuTargetFor(rowKey, { kind: 'file', row }), rowBody)}</Fragment>;
  };

  const renderTreeNodes = (spec: GroupSpec, nodes: readonly FileTreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      if (node.kind === 'dir') {
        const key = `${spec.key}:${node.key}`;
        const open = !collapsed.has(key);
        const paths = collectPaths(node);
        const aggregate = aggregateChecked(allRows, checked, paths);
        const dirRow = (
            <div
              className={rowClass(key)}
              style={rowStyle(depth)}
              onClick={(event) => clickRow(key, event)}
              onDoubleClick={() => toggleCollapse(key)}
              onContextMenu={() => contextMenuRow(key)}
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
              <FolderTypeIcon />
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
        );
        return (
          <div key={key}>
            {withMenu(menuTargetFor(key, { kind: 'dir', group: spec.key, path: node.key, paths }), dirRow)}
            {open && renderTreeNodes(spec, node.children, depth + 1)}
          </div>
        );
      }
      const row = rowsByPath.get(node.path);
      if (row === undefined) return null;
      return renderFileRow(spec, row, depth, '');
    });

  // The reference default flat format: filename + dim directory suffix,
  // sorted by filename; a root-level file names the content root.
  const renderFlatRows = (spec: GroupSpec): React.ReactNode =>
    flatSortedRows(spec.rows).map((row) => renderFileRow(spec, row, 1, dirSuffix(row.path) || rootLabel));

  // The reference content-root node under each group when grouping: a
  // folder row named after the binding's folder with the gray count,
  // its own tri-state checkbox, and the whole tree beneath it.
  const renderRootedTree = (spec: GroupSpec): React.ReactNode => {
    const rootKey = `${spec.key}:__root__`;
    const open = !collapsed.has(rootKey);
    const paths = spec.rows.map((row) => row.path);
    const aggregate = spec.checkable ? aggregateChecked(allRows, checked, paths) : 'none';
    const rootRow = (
        <div
          className={rowClass(rootKey)}
          style={rowStyle(1)}
          onClick={(event) => clickRow(rootKey, event)}
          onDoubleClick={() => toggleCollapse(rootKey)}
          onContextMenu={() => contextMenuRow(rootKey)}
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
          <FolderTypeIcon />
          {rootLabel.length > 0 && (
            <span
              style={{
                flex: '0 1 auto',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: ROW_FONT,
              }}
              data-testid="commit-tool-root-label"
            >
              {rootLabel}
            </span>
          )}
          <span style={{ fontSize: ROW_FONT - 1, color: token.colorTextTertiary }}>{groupCountText(spec)}</span>
        </div>
    );
    return (
      <div>
        {withMenu(menuTargetFor(rootKey, { kind: 'group', group: spec.key, paths }), rootRow)}
        {open && renderTreeNodes(spec, trees.get(spec.key) ?? [], 2)}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`commit-tool-tree rules-thin-scrollbar${namedShown === null ? '' : ' rules-sidebar-content'}`}
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
        // no count (the reference empty default changelist).
        if (spec.rows.length === 0) {
          return (
            <Fragment key={spec.key}>
              {withMenu(
                { kind: 'group', group: spec.key, paths: [] },
                <div
                  style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px 12px',
                lineHeight: `${ROW_LINE}px`,
                minHeight: ROW_MIN_HEIGHT,
                boxSizing: 'border-box',
              }}
                  data-testid={`commit-tool-group-${spec.key}`}
                >
                  <span style={{ fontSize: ROW_FONT, fontWeight: 600, color: token.colorText }}>{spec.label}</span>
                </div>,
              )}
            </Fragment>
          );
        }
        const groupPaths = spec.rows.map((row) => row.path);
        const groupRow = (
            <div
              className={rowClass(spec.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                width: '100%',
                padding: '4px 12px',
                lineHeight: `${ROW_LINE}px`,
                minHeight: ROW_MIN_HEIGHT,
                boxSizing: 'border-box',
                cursor: 'pointer',
              }}
              onClick={(event) => clickRow(spec.key, event)}
              onDoubleClick={() => toggleCollapse(spec.key)}
              onContextMenu={() => contextMenuRow(spec.key)}
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
        );
        return (
          <div key={spec.key}>
            {withMenu(menuTargetFor(spec.key, { kind: 'group', group: spec.key, paths: groupPaths }), groupRow)}
            {open &&
              (namedShown !== null ? (
                <CommitNamedRows
                  group={spec.key}
                  checkable={spec.checkable}
                  sections={namedShown.get(spec.key) ?? []}
                  rowsByPath={rowsByPath}
                  pathsByRowKey={pathsByRowKey}
                  aggregateOf={(paths) => aggregateChecked(allRows, checked, paths)}
                  onSetChecked={onSetChecked}
                  isSelected={isSelected}
                  onToggleFold={toggleCollapse}
                  onRowClick={clickRow}
                  onRowContextMenu={contextMenuRow}
                  onOpenFile={onOpenFile}
                  withMenu={(key, target, body) => withMenu(menuTargetFor(key, target), body)}
                />
              ) : groupByDirectory ? (
                rootCompressed(trees.get(spec.key) ?? []) ? (
                  renderTreeNodes(spec, trees.get(spec.key) ?? [], 1)
                ) : (
                  renderRootedTree(spec)
                )
              ) : (
                renderFlatRows(spec)
              ))}
          </div>
        );
      })}
      {expanded !== null &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: expanded.left - 6,
              top: expanded.top,
              height: expanded.height,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 10px 0 6px',
              boxSizing: 'border-box',
              background: token.colorBgElevated,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: token.borderRadiusSM,
              boxShadow: token.boxShadowSecondary,
              whiteSpace: 'nowrap',
              fontSize: ROW_FONT,
              lineHeight: `${ROW_LINE}px`,
              color: token.colorText,
              zIndex: token.zIndexPopupBase,
              pointerEvents: 'none',
            }}
            data-testid="commit-tool-row-expanded"
            data-path={expanded.row.path}
          >
            {renderRowContent(expanded.row, expanded.suffix, false)}
          </div>,
          document.body,
        )}
    </div>
  );
});

export default CommitChangesTree;
