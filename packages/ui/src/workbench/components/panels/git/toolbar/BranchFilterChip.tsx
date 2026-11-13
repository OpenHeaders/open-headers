/**
 * BranchFilterChip — the log toolbar's `Branch:` chip and its picker,
 * the reference's reading: Select… (the field that takes several refs
 * — `FilterValuesField`), Recent (the scopes applied last, a click
 * applies one again), the Favorites row — a click scopes the log to
 * HEAD and every favorite at once — over HEAD and the favorite refs,
 * and one submenu per namespace: Local, each remote's `<remote>/…`,
 * Tags. Every ref row carries its STAR in the icon slot: gold while the
 * ref is a favorite, an outline on hover while it is not; a star that
 * can be clicked takes a small fill under the pointer, and a click on
 * it toggles the favorite and picks nothing. A row with no star keeps
 * the slot empty, so every label starts on one x. A ref un-starred in
 * the Favorites section stays listed until the menu closes, so the
 * star can be put back. HEAD's star is fixed.
 *
 * Typing with the menu open starts the search list with what was typed
 * — one ref a pick, by namespace: the popup keeps the menu's own size
 * and the list scrolls inside it; emptied, the search gives the menu
 * back with its first row under the keys. The delete key clears the
 * scope, as the popup's last line says.
 *
 * The scope: idle (empty) = the unfiltered all-refs log; picking HEAD
 * or a ref scopes it to that one and the chip reads `Branch: <ref>`; a
 * scope of several reads them joined (`HEAD|main`, cut to a length)
 * with every member in the hover; the × clears back to unfiltered.
 */

import { StarFilled, StarOutlined } from '@ant-design/icons';
import type { WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { Input, Menu, type MenuRef, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { isMac } from '@openheaders/ui/shared/platform';
import { GIT_LOG_SCOPE_HEAD } from '../git-panel-view-store';
import { GIT_TEXT_SIZE } from '../git-type-scale';
import {
  favoritesScope,
  type GitLogScope,
  scopeChipText,
  scopeHoverText,
  scopeMenuText,
} from '../log-scope';
import { gitRailFavoriteKey } from '../rail/git-rail-prefs';
import FilterValuesField from './FilterValuesField';
import GitFilterChip from './GitFilterChip';

type RefKind = WorkspaceTreeRefWire['kind'];

export interface BranchFilterChipProps {
  refs: WorkspaceTreeRefWire[];
  /** Favorite keys (`<kind>:<name>`) — the starred refs, the defaults among them. */
  favorites: ReadonlySet<string>;
  /** A star was clicked. */
  onToggleFavorite: (kind: RefKind, name: string) => void;
  /** The scopes applied last, newest first — the Recent submenu. */
  recent: readonly GitLogScope[];
  /** The log's scope — empty = every ref. */
  scope: GitLogScope;
  onScopeChange: (scope: GitLogScope) => void;
}

interface StarProps {
  on: boolean;
  /** Absent = a fixed star (HEAD's). */
  onToggle?: () => void;
  label: string;
  /** The menu hands its icon slot's class (the gap before the name) to whatever sits in it. */
  className?: string;
}

/** The icon slot's width — a star's, and the empty slot's on a row that has none. */
const STAR_SLOT = 14;

/**
 * The slot's own measure. The menu sizes an item's icon slot and a
 * submenu title's differently; saying it here puts every label on one x.
 */
const SLOT_BOX: React.CSSProperties = { width: STAR_SLOT, minWidth: STAR_SLOT, marginInlineEnd: 8 };

/** The empty slot of a row with no star: its label starts where a starred row's does. */
const StarSlot: React.FC<{ className?: string }> = ({ className }) => (
  <span aria-hidden className={className} style={{ display: 'inline-block', ...SLOT_BOX }} />
);

/** A row's star: the favorite's state and, where it can be toggled, its own click target. */
const Star: React.FC<StarProps> = ({ on, onToggle, label, className }) => {
  const { token } = theme.useToken();
  // In a menu's icon slot the star takes the slot's measure; in the search list the row's own gap spaces it.
  const slot: React.CSSProperties = className === undefined ? { width: STAR_SLOT } : SLOT_BOX;
  const glyph = on ? <StarFilled /> : <StarOutlined />;
  const classes = ['git-branch-star', on ? 'git-branch-star--on' : '', className ?? ''].filter(Boolean).join(' ');
  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: STAR_SLOT,
    color: token.colorWarningText,
  };
  if (onToggle === undefined) {
    return (
      <span aria-hidden className={classes} style={{ ...style, ...slot }}>
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
      style={{ ...style, ...slot, cursor: 'pointer' }}
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
  recent,
  scope,
  onScopeChange,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'menu' | 'search' | 'select'>('menu');
  const [search, setSearch] = useState('');
  // The popup's own box as the menu left it — the search list keeps it and scrolls inside.
  const popupRef = useRef<HTMLDivElement>(null);
  const [menuBox, setMenuBox] = useState<{ width: number; height: number } | null>(null);
  // The menu came back from an emptied search: its first row takes the
  // focus, and with it the keys (a focused row is the menu's active one).
  const menuRef = useRef<MenuRef>(null);
  const [fromSearch, setFromSearch] = useState(false);
  // The Favorites section as it stood when the menu opened: a ref
  // un-starred there keeps its row (and its star to put back) until the
  // menu closes.
  const [listed, setListed] = useState<readonly WorkspaceTreeRefWire[]>([]);

  const isFavorite = (ref: WorkspaceTreeRefWire): boolean => favorites.has(gitRailFavoriteKey(ref.kind, ref.name));

  const toMenu = (): void => {
    setMode('menu');
    setSearch('');
  };

  const close = (): void => {
    setOpen(false);
    setFromSearch(false);
    toMenu();
  };

  useEffect(() => {
    if (open && mode === 'menu' && fromSearch) menuRef.current?.focus();
  }, [open, mode, fromSearch]);

  // Typing with the menu open is a search (the reference): the first
  // printable key opens the list with it; the field takes the rest.
  // The delete key clears a held scope and closes.
  useEffect(() => {
    if (!open || mode !== 'menu') return;
    const onKey = (event: KeyboardEvent): void => {
      if ((event.key === 'Backspace' || event.key === 'Delete') && scope.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        onScopeChange([]);
        setOpen(false);
        return;
      }
      if (event.key.length !== 1 || event.key === ' ' || event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      event.stopPropagation();
      const box = popupRef.current;
      setMenuBox(box === null ? null : { width: box.offsetWidth, height: box.offsetHeight });
      setMode('search');
      setSearch(event.key);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, mode, scope, onScopeChange]);

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
      ref={menuRef}
      selectable={false}
      style={{ minWidth: 240, maxHeight: 420, overflowY: 'auto', boxShadow: 'none', border: 'none' }}
      onClick={({ key, domEvent }) => {
        if (key === 'select') {
          // Opened by Enter, the field mounts and takes the focus inside this
          // very key press — which would then write its line break into it.
          domEvent.preventDefault();
          setMode('select');
          return;
        }
        if (key === 'favorites') {
          onScopeChange(favoritesScope(refs, favorites));
          close();
          return;
        }
        if (key === 'head') {
          onScopeChange([GIT_LOG_SCOPE_HEAD]);
          close();
          return;
        }
        if (key.startsWith('recent:')) {
          const again = recent[Number(key.slice('recent:'.length))];
          if (again !== undefined) onScopeChange(again);
          close();
          return;
        }
        if (key.startsWith('ref:')) {
          onScopeChange([key.slice(key.indexOf(':', 4) + 1)]);
          close();
        }
      }}
      items={[
        { key: 'select', label: t('workbench.gitLog.menu.select'), icon: <StarSlot /> },
        ...(recent.length > 0
          ? [
              {
                key: 'group-recent',
                label: t('workbench.gitBranch.group.recent'),
                icon: <StarSlot />,
                children: recent.map((entry, index) => ({
                  key: `recent:${index}`,
                  label: (
                    <span title={scopeHoverText(entry) ?? undefined} data-testid="git-tool-chip-branch-recent">
                      {scopeMenuText(entry)}
                    </span>
                  ),
                })),
              },
            ]
          : []),
        {
          key: 'favorites',
          label: <span data-testid="git-tool-chip-branch-favorites">{t('workbench.gitLog.menu.favorites')}</span>,
          icon: <StarSlot />,
        },
        { key: 'head', label: 'HEAD', icon: <Star on label="HEAD" /> },
        ...listed.map(refItem),
        { type: 'divider' },
        ...namespaces.map((namespace) => ({
          key: namespace.key,
          label: namespace.label,
          icon: <StarSlot />,
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
    <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', minWidth: 240 }}>
      <div style={{ padding: '6px 8px 4px' }}>
        <Input
          size="small"
          autoFocus
          allowClear
          value={search}
          onChange={(e) => {
            // Emptied — by the keys or the field's × — the search gives the menu back.
            if (e.target.value === '') {
              setFromSearch(true);
              toMenu();
            } else setSearch(e.target.value);
          }}
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
                  onScopeChange([ref.name]);
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

  // The popup's last line, under the menu and under the search list alike.
  const clearHint = (
    <div
      style={{
        flex: '0 0 auto',
        padding: '4px 12px 5px',
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        fontSize: 12,
        color: token.colorTextTertiary,
      }}
      data-testid="git-tool-chip-branch-hint"
    >
      {t('workbench.gitLog.menu.clearHint', { key: isMac ? '⌫' : 'Backspace' })}
    </div>
  );

  // Every name the Select… field may hold.
  const names = useMemo(() => [...new Set([GIT_LOG_SCOPE_HEAD, ...refs.map((ref) => ref.name)])], [refs]);

  // The chip reads Tag: while its one scoped ref is a tag.
  const scopedTag = scope.length === 1 && refs.find((ref) => ref.name === scope[0])?.kind === 'tag';

  return (
    <GitFilterChip
      label={scopedTag ? t('workbench.gitLog.chip.tag') : t('workbench.gitLog.chip.branch')}
      value={scopeChipText(scope)}
      valueTitle={scopeHoverText(scope) ?? undefined}
      onClear={() => onScopeChange([])}
      open={open}
      onOpenChange={(next, info) => {
        // The Dropdown closes on any click in a menu it hosts; a row that
        // picks closes the chip itself, and Select… and a star keep it open.
        if (!next && info.source === 'menu') return;
        setOpen(next);
        if (next) setListed(refs.filter(isFavorite));
        else {
          setFromSearch(false);
          toMenu();
        }
      }}
      popupRender={() => (
        <div
          ref={popupRef}
          style={{
            background: token.colorBgElevated,
            borderRadius: token.borderRadiusLG,
            boxShadow: token.boxShadowSecondary,
            overflow: 'hidden',
            // The search list lives in the box the menu had.
            ...(mode === 'search' && menuBox !== null
              ? { display: 'flex', flexDirection: 'column', width: menuBox.width, height: menuBox.height }
              : {}),
          }}
          data-testid="git-tool-chip-branch-popup"
          data-mode={mode}
        >
          {mode === 'menu' ? (
            <>
              {menuContent}
              {clearHint}
            </>
          ) : mode === 'select' ? (
            <FilterValuesField
              names={names}
              values={scope}
              bar
              strict
              onFinish={(next) => {
                onScopeChange(next);
                close();
              }}
              testid="git-tool-chip-branch-select"
            />
          ) : (
            <>
              {searchContent}
              {clearHint}
            </>
          )}
        </div>
      )}
      testid="git-tool-scope-chip"
    />
  );
};

export default BranchFilterChip;
