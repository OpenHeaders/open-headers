/**
 * RefTree — the Git tool window's branches tree, IDE-log shape: a
 * "Branch or tag" search box, the `HEAD (Current Branch)` row, then the
 * Local / Remote / Tags groups whose ref names fold on `/` into
 * collapsible folders (`v5/data-model` = folder `v5` → leaf
 * `data-model`; a remote's first segment is its remote-name folder) —
 * or flat full-name rows while Group By Directory is off. The current
 * branch renders bold + ★ with its ancestor folders open by default;
 * favorite refs carry the gold ★ too. Searching prunes to matches and
 * renders them fully expanded.
 *
 * Selection is the TREE selection (the activity bar's target), owned
 * by the rail orchestrator — what a click DOES (scope the log /
 * navigate to the head) is the gear's single-click setting, decided
 * above. Expand All / Collapse All arrive through the imperative
 * handle (the bar sits outside this scroll area).
 */

import { CaretDownOutlined, CaretRightOutlined, FolderOutlined, SearchOutlined } from '@ant-design/icons';
import type { WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { Input, theme } from 'antd';
import type React from 'react';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { gitRailFavoriteKey } from './git-rail-prefs';
import { allFolderKeys, buildRefTree, filterRefTree, folderKeysToRef, type RefTreeNode } from './ref-tree-model';

/** One selectable tree row — the activity bar's action target. */
export interface RefTreeSelection {
  name: string;
  kind: WorkspaceTreeRefWire['kind'];
}

export interface RefTreeProps {
  refs: WorkspaceTreeRefWire[];
  /** Checked-out branch per `listRefs`/`gitStatus` — the ★ row. */
  currentRef: string | null;
  /** Branch reported by `gitStatus` but absent from `listRefs` (unborn
   *  HEAD — fresh repo, first commit pending). Rendered as the current
   *  Local leaf, selectable and scopeable like any row — the log view
   *  answers the unborn scope with the no-matches empty state (the
   *  IDE posture) instead of asking `log` (the membership gate would
   *  refuse the name). */
  unbornBranch: string | null;
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

const RefTree = forwardRef<RefTreeHandle, RefTreeProps>(function RefTree(
  { refs, currentRef, unbornBranch, selected, favorites, groupByDirectory, showTags, onLeafClick, onHeadClick },
  handleRef,
) {
  const { token } = theme.useToken();
  const t = useT();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [autoExpanded, setAutoExpanded] = useState<ReadonlySet<string>>(new Set());

  // The current branch's ancestor folders start open (the IDE default);
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
  // namespace groups — the IDE gesture flattens everything at once.
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

  const rowStyle = (depth: number): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    width: '100%',
    padding: `2px 12px 2px ${12 + depth * INDENT}px`,
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: 12,
    color: token.colorText,
  });

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
              <span aria-hidden style={{ flex: '0 0 auto', fontSize: 9, color: token.colorTextTertiary }}>
                {open ? <CaretDownOutlined /> : <CaretRightOutlined />}
              </span>
              <FolderOutlined style={{ flex: '0 0 auto', fontSize: 11, color: token.colorTextTertiary }} />
              <span
                style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {node.label}
              </span>
            </button>
            {open && renderNodes(node.children, depth + 1)}
          </div>
        );
      }
      const isCurrent = node.refKind === 'local' && node.name === currentRef;
      const isActive = selected !== null && node.name === selected.name && node.refKind === selected.kind;
      const isFavorite = favorites.has(gitRailFavoriteKey(node.refKind, node.name));
      return (
        <button
          key={`${node.refKind}:${node.name}`}
          type="button"
          className={isActive ? 'git-tool-row selected' : 'git-tool-row'}
          onClick={() => onLeafClick({ name: node.name, kind: node.refKind })}
          title={node.name}
          style={{ ...rowStyle(depth), fontWeight: isCurrent ? 600 : 400 }}
          data-testid="git-tool-ref-row"
          data-ref={node.name}
          data-kind={node.refKind}
        >
          <span
            style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {node.label}
          </span>
          {(isCurrent || isFavorite) && (
            <span aria-hidden data-testid="git-tool-ref-star" style={{ flex: '0 0 auto', color: token.colorWarningText }}>
              ★
            </span>
          )}
        </button>
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
            style={{ ...rowStyle(0), fontWeight: 600 }}
            onClick={onHeadClick}
            data-testid="git-tool-ref-head"
          >
            <span
              style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {t('workbench.gitLog.refs.head')}
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
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    width: '100%',
                    padding: '6px 12px 2px',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                    color: token.colorTextSecondary,
                  }}
                  data-testid="git-tool-ref-group-header"
                >
                  <span aria-hidden style={{ flex: '0 0 auto', fontSize: 9 }}>
                    {open ? <CaretDownOutlined /> : <CaretRightOutlined />}
                  </span>
                  {t(group.labelKey)}
                </button>
                {open && showUnborn && (
                  <button
                    type="button"
                    className={
                      selected !== null && selected.kind === 'local' && selected.name === unbornBranch
                        ? 'git-tool-row selected'
                        : 'git-tool-row'
                    }
                    onClick={() => {
                      if (unbornBranch !== null) onLeafClick({ name: unbornBranch, kind: 'local' });
                    }}
                    title={unbornBranch ?? undefined}
                    style={{ ...rowStyle(0), fontWeight: 600 }}
                    data-testid="git-tool-ref-row"
                    data-ref={unbornBranch ?? ''}
                    data-kind="local"
                  >
                    <span
                      style={{
                        flex: '1 1 auto',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {unbornBranch}
                    </span>
                    <span aria-hidden style={{ flex: '0 0 auto', color: token.colorWarningText }}>
                      ★
                    </span>
                  </button>
                )}
                {open && renderNodes(group.tree, 0)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

export default RefTree;
