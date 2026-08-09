/**
 * RefTree — the Git tool window's left rail, IDE-log shape: a
 * "Branch or tag" search box, the `HEAD (Current Branch)` row, then the
 * Local / Remote / Tags groups whose ref names fold on `/` into
 * collapsible folders (`v5/data-model` = folder `v5` → leaf
 * `data-model`; a remote's first segment is its remote-name folder).
 * The current branch renders bold + ★ with its ancestor folders open by
 * default; every other folder starts collapsed. Searching prunes to
 * matches and renders them fully expanded. Selection scopes the log to
 * that ref; the HEAD row (or re-clicking the selection) clears back to
 * HEAD scope.
 */

import { CaretDownOutlined, CaretRightOutlined, FolderOutlined } from '@ant-design/icons';
import type { WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { Input, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { allFolderKeys, buildRefTree, filterRefTree, folderKeysToRef, type RefTreeNode } from './ref-tree-model';

export interface RefTreeProps {
  refs: WorkspaceTreeRefWire[];
  /** Checked-out branch per `listRefs`/`gitStatus` — the ★ row. */
  currentRef: string | null;
  /** Branch reported by `gitStatus` but absent from `listRefs` (unborn
   *  HEAD — fresh repo, first commit pending). Rendered as the current
   *  Local leaf; selecting it is HEAD scope (its name must never reach
   *  `log`, the membership gate would refuse it). */
  unbornBranch: string | null;
  selectedRef: string | null;
  onSelect: (ref: string | null) => void;
}

const GROUPS = [
  { kind: 'local', labelKey: 'workbench.gitLog.refs.local' },
  { kind: 'remote', labelKey: 'workbench.gitLog.refs.remote' },
  { kind: 'tag', labelKey: 'workbench.gitLog.refs.tags' },
] as const;

const INDENT = 14;

const RefTree: React.FC<RefTreeProps> = ({ refs, currentRef, unbornBranch, selectedRef, onSelect }) => {
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

  const groups = useMemo(
    () =>
      GROUPS.map((group) => {
        const tree = buildRefTree(
          refs.filter((ref) => ref.kind === group.kind),
          group.kind,
        );
        return { ...group, tree: filterRefTree(tree, search) };
      }),
    [refs, search],
  );

  const searching = search.trim() !== '';
  const searchOpen = useMemo(
    () => (searching ? new Set(groups.flatMap((group) => allFolderKeys(group.tree))) : null),
    [searching, groups],
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
      const isActive = node.name === selectedRef;
      return (
        <button
          key={`${node.refKind}:${node.name}`}
          type="button"
          className={isActive ? 'git-tool-row selected' : 'git-tool-row'}
          onClick={() => onSelect(isActive ? null : node.name)}
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
          {isCurrent && (
            <span aria-hidden style={{ flex: '0 0 auto', color: token.colorWarningText }}>
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
        flex: '0 0 220px',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorFillQuaternary,
      }}
      data-testid="git-tool-refs"
    >
      <div style={{ flex: '0 0 auto', padding: '6px 8px 4px' }}>
        <Input
          size="small"
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('workbench.gitLog.refs.search')}
          data-testid="git-tool-refs-search"
        />
      </div>
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '2px 0 4px' }}>
        {!searching && (
          <button
            type="button"
            className={selectedRef === null ? 'git-tool-row selected' : 'git-tool-row'}
            style={{ ...rowStyle(0), fontWeight: 600 }}
            onClick={() => onSelect(null)}
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
                    className="git-tool-row"
                    onClick={() => onSelect(null)}
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
};

export default RefTree;
