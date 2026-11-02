/**
 * RefTree — the Git tool window's branches tree, log-window shape: a
 * "Branch or tag" search box, the `HEAD (Current Branch)` row, then the
 * Local / Remote / Tags groups whose ref names fold on `/` into
 * collapsible folders (`v5/data-model` = folder `v5` → leaf
 * `data-model`; a remote's first segment is its remote-name folder) —
 * or flat full-name rows while Group By Directory is off. The reference
 * tree anatomy: every row reserves the caret slot, group rows are
 * plain tree rows, their children sit one indent step in, and a leaf
 * carries a branch / tag glyph in the icon slot. The current branch
 * renders bold + ★ in that slot with its ancestor folders open by
 * default; favorite refs carry the gold ★ too. Searching prunes to
 * matches and renders them fully expanded.
 *
 * Selection is the TREE selection (the activity bar's target), owned
 * by the rail orchestrator — what a click DOES (scope the log /
 * navigate to the head) is the gear's single-click setting, decided
 * above. Expand All / Collapse All arrive through the imperative
 * handle (the bar sits outside this scroll area).
 */

import {
  BranchesOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  FolderOutlined,
  SearchOutlined,
  TagOutlined,
} from '@ant-design/icons';
import type { WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { Dropdown, Input, type MenuProps, theme } from 'antd';
import type React from 'react';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { contextMenuAlign } from '../git-menu-overflow';
import { gitRailFavoriteKey } from './git-rail-prefs';
import type { RefTreeSelection } from './ref-row-menu';
import { allFolderKeys, buildRefTree, filterRefTree, folderKeysToRef, type RefTreeNode } from './ref-tree-model';

export type { RefTreeSelection } from './ref-row-menu';

export interface RefTreeProps {
  refs: WorkspaceTreeRefWire[];
  /** Checked-out branch per `listRefs`/`gitStatus` — the ★ row. */
  currentRef: string | null;
  /** Branch reported by `gitStatus` but absent from `listRefs` (unborn
   *  HEAD — fresh repo, first commit pending). Rendered as the current
   *  Local leaf, selectable and scopeable like any row — the log view
   *  answers the unborn scope with the no-matches empty state (the
   *  reference posture) instead of asking `log` (the membership gate would
   *  refuse the name). */
  unbornBranch: string | null;
  /** The detached HEAD's commit (§3.4): the HEAD row reads `HEAD · <sha> (detached)` instead of naming a branch. */
  detachedSha: string | null;
  /** The tree selection (highlight + bar target); null selects HEAD. */
  selected: RefTreeSelection | null;
  /** Favorite keys (`<kind>:<name>`) — gold ★ rows. */
  favorites: ReadonlySet<string>;
  /** Group By Directory (gear toggle) — off renders flat full names. */
  groupByDirectory: boolean;
  /** Show Tags (gear toggle) — off drops the Tags group. */
  showTags: boolean;
  onLeafClick: (node: RefTreeSelection) => void;
  /** HEAD row (and the unborn-branch row) — clears selection + scope. */
  onHeadClick: () => void;
  /** Right-click on a ref row (the unborn row included): the row
   *  becomes the selection without the single-click gesture, and the
   *  menu built here opens beside it. */
  onLeafContextMenu: (node: RefTreeSelection) => void;
  rowMenu: (node: RefTreeSelection) => MenuProps;
}

export interface RefTreeHandle {
  expandAll: () => void;
  collapseAll: () => void;
}

const GROUPS = [
  { kind: 'local', labelKey: 'workbench.gitLog.refs.local' },
  { kind: 'remote', labelKey: 'workbench.gitLog.refs.remote' },
  { kind: 'tag', labelKey: 'workbench.gitLog.refs.tags' },
] as const;

const INDENT = 14;
// Every row reserves the caret slot — leaves and the HEAD row too — so
// a child's icon sits one indent step right of its parent's (the reference
// tree, the sidebar trees' slot).
const CARET_SLOT = 12;

const RefTree = forwardRef<RefTreeHandle, RefTreeProps>(function RefTree(
  {
    refs,
    currentRef,
    unbornBranch,
    detachedSha,
    selected,
    favorites,
    groupByDirectory,
    showTags,
    onLeafClick,
    onHeadClick,
    onLeafContextMenu,
    rowMenu,
  },
  handleRef,
) {
  const { token } = theme.useToken();
  const t = useT();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [autoExpanded, setAutoExpanded] = useState<ReadonlySet<string>>(new Set());

  // The current branch's ancestor folders start open (the reference default);
  // everything else starts collapsed. Collapsed-state is tracked as an
  // explicit user override set so a branch switch reopens the new
  // ancestry without stomping folders the user closed by hand.
  useEffect(() => {
    if (currentRef !== null) setAutoExpanded(new Set(folderKeysToRef(currentRef, 'local')));
  }, [currentRef]);

  const visibleGroups = useMemo(() => GROUPS.filter((group) => showTags || group.kind !== 'tag'), [showTags]);

  const groups = useMemo(
    () =>
      visibleGroups.map((group) => {
        const tree = buildRefTree(
          refs.filter((ref) => ref.kind === group.kind),
          group.kind,
          groupByDirectory,
        );
        return { ...group, tree: filterRefTree(tree, search) };
      }),
    [refs, search, visibleGroups, groupByDirectory],
  );

  const searching = search.trim() !== '';
  const searchOpen = useMemo(
    () => (searching ? new Set(groups.flatMap((group) => allFolderKeys(group.tree))) : null),
    [searching, groups],
  );

  // Expand All / Collapse All (activity bar): folders AND the three
  // namespace groups — the reference gesture flattens everything at once.
  useImperativeHandle(
    handleRef,
    () => ({
      expandAll: () => {
        setCollapsed(new Set());
        setAutoExpanded(new Set(groups.flatMap((group) => allFolderKeys(group.tree))));
      },
      collapseAll: () => {
        setCollapsed(
          new Set([...groups.flatMap((group) => allFolderKeys(group.tree)), ...groups.map((g) => `group:${g.kind}`)]),
        );
        setAutoExpanded(new Set());
      },
    }),
    [groups],
  );

  const isOpen = (key: string): boolean => {
    if (searchOpen !== null) return searchOpen.has(key);
    if (collapsed.has(key)) return false;
    return autoExpanded.has(key) ? true : false;
  };

  const toggle = (key: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (isOpen(key)) next.add(key);
      else next.delete(key);
      return next;
    });
    setAutoExpanded((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  /** The row menu wrapper — antd composes the trigger with the row's own onContextMenu. */
  const withRowMenu = (node: RefTreeSelection, row: React.ReactElement): React.ReactNode => (
    <Dropdown
      key={`${node.kind}:${node.name}`}
      menu={rowMenu(node)}
      trigger={['contextMenu']}
      align={contextMenuAlign}
      classNames={{ root: 'commit-tool-row-menu' }}
    >
      {row}
    </Dropdown>
  );

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

  const slotStyle: React.CSSProperties = {
    flex: 'none',
    width: CARET_SLOT,
    display: 'inline-flex',
    justifyContent: 'center',
    fontSize: 9,
    color: token.colorTextTertiary,
  };

  /** The caret slot: a caret on folders and groups, empty on leaves. */
  const caretSlot = (open: boolean | null): React.ReactNode => (
    <span aria-hidden style={slotStyle}>
      {open === null ? null : open ? <CaretDownOutlined /> : <CaretRightOutlined />}
    </span>
  );

  const labelStyle: React.CSSProperties = {
    flex: '1 1 auto',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  /** The leaf's icon slot: ★ on the current branch and favorites, the ref-kind glyph otherwise. */
  const leafIcon = (kind: WorkspaceTreeRefWire['kind'], starred: boolean): React.ReactNode => {
    if (starred) {
      return (
        <span aria-hidden data-testid="git-tool-ref-star" style={{ flex: '0 0 auto', color: token.colorWarningText }}>
          ★
        </span>
      );
    }
    const Glyph = kind === 'tag' ? TagOutlined : BranchesOutlined;
    return <Glyph style={{ flex: '0 0 auto', fontSize: 11, color: token.colorTextTertiary }} />;
  };

  const renderNodes = (nodes: readonly RefTreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      if (node.kind === 'folder') {
        const open = isOpen(node.key);
        return (
          <div key={node.key}>
            <button
              type="button"
              className="git-tool-row"
              style={rowStyle(depth)}
              onClick={() => toggle(node.key)}
              data-testid="git-tool-ref-folder"
              data-key={node.key}
            >
              {caretSlot(open)}
              <FolderOutlined style={{ flex: '0 0 auto', fontSize: 11, color: token.colorTextTertiary }} />
              <span style={labelStyle}>{node.label}</span>
            </button>
            {open && renderNodes(node.children, depth + 1)}
          </div>
        );
      }
      const isCurrent = node.refKind === 'local' && node.name === currentRef;
      const isActive = selected !== null && node.name === selected.name && node.refKind === selected.kind;
      const isFavorite = favorites.has(gitRailFavoriteKey(node.refKind, node.name));
      const leaf: RefTreeSelection = { name: node.name, kind: node.refKind };
      return withRowMenu(
        leaf,
        <button
          type="button"
          className={isActive ? 'git-tool-row selected' : 'git-tool-row'}
          onClick={() => onLeafClick(leaf)}
          onContextMenu={() => onLeafContextMenu(leaf)}
          title={node.name}
          style={{ ...rowStyle(depth), fontWeight: isCurrent ? 600 : 400 }}
          data-testid="git-tool-ref-row"
          data-ref={node.name}
          data-kind={node.refKind}
        >
          {caretSlot(null)}
          {leafIcon(node.refKind, isCurrent || isFavorite)}
          <span style={labelStyle}>{node.label}</span>
        </button>,
      );
    });

  const empty = refs.length === 0 && unbornBranch === null;

  return (
    <div
      style={{
        flex: '1 1 auto',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
      data-testid="git-tool-refs"
    >
      {/* The rail's slice of the shared top band — same height and
          rule as the log/details toolbars so the row reads as one. */}
      <div
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          height: 33,
          padding: '0 8px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Input
          size="small"
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('workbench.gitLog.refs.search')}
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          data-testid="git-tool-refs-search"
        />
      </div>
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '2px 0 4px' }}>
        {!searching && (
          <button
            type="button"
            className={selected === null ? 'git-tool-row selected' : 'git-tool-row'}
            style={rowStyle(0)}
            onClick={onHeadClick}
            data-testid="git-tool-ref-head"
            data-detached={detachedSha !== null ? 'true' : undefined}
          >
            {caretSlot(null)}
            <span style={labelStyle}>
              {detachedSha !== null
                ? t('workbench.gitLog.refs.headDetached', { sha: detachedSha.slice(0, 8) })
                : t('workbench.gitLog.refs.head')}
            </span>
          </button>
        )}
        {empty ? (
          <div
            style={{ padding: '10px 12px', fontSize: 12, color: token.colorTextSecondary }}
            data-testid="git-tool-refs-empty"
          >
            {t('workbench.gitLog.refs.empty')}
          </div>
        ) : (
          groups.map((group) => {
            const showUnborn = group.kind === 'local' && unbornBranch !== null && !searching;
            if (group.tree.length === 0 && !showUnborn) return null;
            const groupKey = `group:${group.kind}`;
            const open = searching ? true : !collapsed.has(groupKey);
            return (
              <div key={group.kind} data-testid="git-tool-ref-group" data-kind={group.kind}>
                <button
                  type="button"
                  className="git-tool-row"
                  onClick={() => {
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(groupKey)) next.delete(groupKey);
                      else next.add(groupKey);
                      return next;
                    });
                  }}
                  style={rowStyle(0)}
                  data-testid="git-tool-ref-group-header"
                >
                  {caretSlot(open)}
                  <span style={labelStyle}>{t(group.labelKey)}</span>
                </button>
                {open &&
                  showUnborn &&
                  unbornBranch !== null &&
                  withRowMenu(
                    { name: unbornBranch, kind: 'local' },
                    <button
                      type="button"
                      className={
                        selected !== null && selected.kind === 'local' && selected.name === unbornBranch
                          ? 'git-tool-row selected'
                          : 'git-tool-row'
                      }
                      onClick={() => onLeafClick({ name: unbornBranch, kind: 'local' })}
                      onContextMenu={() => onLeafContextMenu({ name: unbornBranch, kind: 'local' })}
                      title={unbornBranch}
                      style={{ ...rowStyle(1), fontWeight: 600 }}
                      data-testid="git-tool-ref-row"
                      data-ref={unbornBranch}
                      data-kind="local"
                    >
                      {caretSlot(null)}
                      {leafIcon('local', true)}
                      <span style={labelStyle}>{unbornBranch}</span>
                    </button>,
                  )}
                {open && renderNodes(group.tree, 1)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

export default RefTree;
