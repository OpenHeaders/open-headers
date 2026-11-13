/**
 * BranchFilterChip — the log toolbar's `Branch:` chip and its picker,
 * the reference's reading: Select… (the searchable list), the
 * Favorites section — HEAD, then the favorite refs — and one submenu
 * per namespace: Local, each remote's `<remote>/…`, Tags. Every ref
 * row carries its STAR in the icon slot: gold while the ref is a
 * favorite, an outline on hover while it is not; a click on the star
 * toggles the favorite and picks nothing. A ref un-starred in the
 * Favorites section stays listed until the menu closes, so the star
 * can be put back. HEAD's star is fixed. Typing with the menu open
 * starts the search with what was typed.
 *
 * Scope triad: idle (null) = the unfiltered all-refs log; picking HEAD
 * or a ref scopes it and the chip reads `Branch: <scope>`; the ×
 * clears back to unfiltered.
 */

import { StarFilled, StarOutlined } from '@ant-design/icons';
import type { WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { Input, Menu, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { GIT_LOG_SCOPE_HEAD } from '../git-panel-view-store';
import { GIT_TEXT_SIZE } from '../git-type-scale';
import { gitRailFavoriteKey } from '../rail/git-rail-prefs';
import GitFilterChip from './GitFilterChip';

type RefKind = WorkspaceTreeRefWire['kind'];

export interface BranchFilterChipProps {
  refs: WorkspaceTreeRefWire[];
  /** Favorite keys (`<kind>:<name>`) — the starred refs, the defaults among them. */
  favorites: ReadonlySet<string>;
  /** A star was clicked. */
  onToggleFavorite: (kind: RefKind, name: string) => void;
  scopeRef: string | null;
  /** Kind of the scoped ref — the chip label reads Tag: for tags. */
  scopeKind: RefKind;
  onScopeChange: (ref: string | null) => void;
}

interface StarProps {
  on: boolean;
  /** Absent = a fixed star (HEAD's). */
  onToggle?: () => void;
  label: string;
  /** The menu hands its icon slot's class (the gap before the name) to whatever sits in it. */
  className?: string;
}

/** A row's star: the favorite's state and, where it can be toggled, its own click target. */
const Star: React.FC<StarProps> = ({ on, onToggle, label, className }) => {
  const { token } = theme.useToken();
  const glyph = on ? <StarFilled /> : <StarOutlined />;
  const classes = ['git-branch-star', on ? 'git-branch-star--on' : '', className ?? ''].filter(Boolean).join(' ');
  const style: React.CSSProperties = {
    display: 'inline-flex',
    justifyContent: 'center',
    width: 14,
    color: token.colorWarningText,
  };
  if (onToggle === undefined) {
    return (
      <span aria-hidden className={classes} style={style}>
        {glyph}
      </span>
    );
  }
  return (
    <span
      role="button"
      tabIndex={-1}
      aria-label={label}
      aria-pressed={on}
      className={classes}
      data-testid="git-tool-chip-branch-star"
      data-on={on}
      style={{ ...style, cursor: 'pointer' }}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.stopPropagation();
        onToggle();
      }}
    >
      {glyph}
    </span>
  );
};

const BranchFilterChip: React.FC<BranchFilterChipProps> = ({
  refs,
  favorites,
  onToggleFavorite,
  scopeRef,
  scopeKind,
  onScopeChange,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'menu' | 'search'>('menu');
  const [search, setSearch] = useState('');
  // The Favorites section as it stood when the menu opened: a ref
  // un-starred there keeps its row (and its star to put back) until the
  // menu closes.
  const [listed, setListed] = useState<readonly WorkspaceTreeRefWire[]>([]);

  const isFavorite = (ref: WorkspaceTreeRefWire): boolean => favorites.has(gitRailFavoriteKey(ref.kind, ref.name));

  const close = (): void => {
    setOpen(false);
    setMode('menu');
    setSearch('');
  };

  // Typing with the menu open is a search (the reference): the first
  // printable key opens the list with it; the field takes the rest.
  useEffect(() => {
    if (!open || mode !== 'menu') return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key.length !== 1 || event.key === ' ' || event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      event.stopPropagation();
      setMode('search');
      setSearch(event.key);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, mode]);

  const namespaces = useMemo(() => {
    const byRemote = new Map<string, WorkspaceTreeRefWire[]>();
    for (const ref of refs) {
      if (ref.kind !== 'remote') continue;
      const remote = ref.name.split('/')[0] ?? '';
      const rows = byRemote.get(remote);
      if (rows !== undefined) rows.push(ref);
      else byRemote.set(remote, [ref]);
    }
    return [
      { key: 'group-local', label: t('workbench.gitLog.refs.local'), rows: refs.filter((ref) => ref.kind === 'local') },
      ...[...byRemote.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([remote, rows]) => ({ key: `group-remote-${remote}`, label: `${remote}/…`, rows })),
      { key: 'group-tags', label: t('workbench.gitLog.refs.tags'), rows: refs.filter((ref) => ref.kind === 'tag') },
    ].filter((namespace) => namespace.rows.length > 0);
  }, [refs, t]);

  const star = (ref: WorkspaceTreeRefWire): React.ReactNode => (
    <Star
      on={isFavorite(ref)}
      onToggle={() => onToggleFavorite(ref.kind, ref.name)}
      label={t('workbench.gitLog.rail.toggleFavorite')}
    />
  );

  const refItem = (ref: WorkspaceTreeRefWire): { key: string; label: string; icon: React.ReactNode } => ({
    key: `ref:${ref.kind}:${ref.name}`,
    label: ref.name,
    icon: star(ref),
  });

  const menuContent = (
    <Menu
      selectable={false}
      style={{ minWidth: 240, maxHeight: 420, overflowY: 'auto', boxShadow: 'none', border: 'none' }}
      onClick={({ key }) => {
        if (key === 'select') {
          setMode('search');
          return;
        }
        if (key === 'head') {
          onScopeChange(GIT_LOG_SCOPE_HEAD);
          close();
          return;
        }
        if (key.startsWith('ref:')) {
          onScopeChange(key.slice(key.indexOf(':', 4) + 1));
          close();
        }
      }}
      items={[
        { key: 'select', label: t('workbench.gitLog.menu.select') },
        { type: 'divider' },
        {
          type: 'group',
          label: t('workbench.gitLog.menu.favorites'),
          children: [
            { key: 'head', label: 'HEAD', icon: <Star on label="HEAD" /> },
            ...listed.map((ref) => ({ ...refItem(ref), key: `ref:${ref.kind}:${ref.name}` })),
          ],
        },
        { type: 'divider' },
        ...namespaces.map((namespace) => ({
          key: namespace.key,
          label: namespace.label,
          children: namespace.rows.map(refItem),
        })),
      ]}
    />
  );

  const needle = search.trim().toLowerCase();
  const matches = (ref: WorkspaceTreeRefWire): boolean => needle === '' || ref.name.toLowerCase().includes(needle);
  const found = namespaces
    .map((namespace) => ({ ...namespace, rows: namespace.rows.filter(matches) }))
    .filter((namespace) => namespace.rows.length > 0);

  const searchContent = (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 240, maxHeight: 420 }}>
      <div style={{ padding: '6px 8px 4px' }}>
        <Input
          size="small"
          autoFocus
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('workbench.gitLog.refs.search')}
          data-testid="git-tool-chip-branch-search"
        />
      </div>
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '2px 0 4px' }}>
        {found.map((namespace) => (
          <div key={namespace.key} data-testid="git-tool-chip-branch-section">
            <div style={{ padding: '4px 12px 2px', fontSize: 12, fontWeight: 600, color: token.colorTextTertiary }}>
              {namespace.label}
            </div>
            {namespace.rows.map((ref) => (
              <button
                key={`${ref.kind}:${ref.name}`}
                type="button"
                className="git-tool-row git-branch-row"
                onClick={() => {
                  onScopeChange(ref.name);
                  close();
                }}
                title={ref.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '3px 12px',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: GIT_TEXT_SIZE,
                  color: token.colorText,
                }}
                data-testid="git-tool-chip-branch-row"
                data-ref={ref.name}
              >
                {star(ref)}
                <span style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ref.name}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <GitFilterChip
      label={
        scopeRef !== null && scopeKind === 'tag' ? t('workbench.gitLog.chip.tag') : t('workbench.gitLog.chip.branch')
      }
      value={scopeRef}
      onClear={() => onScopeChange(null)}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setListed(refs.filter(isFavorite));
        else {
          setMode('menu');
          setSearch('');
        }
      }}
      popupRender={() => (
        <div
          style={{
            background: token.colorBgElevated,
            borderRadius: token.borderRadiusLG,
            boxShadow: token.boxShadowSecondary,
            overflow: 'hidden',
          }}
        >
          {mode === 'menu' ? menuContent : searchContent}
        </div>
      )}
      testid="git-tool-scope-chip"
    />
  );
};

export default BranchFilterChip;
