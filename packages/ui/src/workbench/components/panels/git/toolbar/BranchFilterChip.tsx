/**
 * BranchFilterChip — the log toolbar's `Branch:` chip and its IDE
 * picker: Select… (switches the popup to a searchable flat list),
 * the Favorites section (HEAD + starred refs + the current branch's
 * always-★), then one submenu per namespace — Local, each remote's
 * `<remote>/…`, Tags. Picking a ref sets the log scope; HEAD clears
 * it; the chip's × clears without opening.
 */

import type { WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { Input, Menu, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { gitRailFavoriteKey } from '../rail/git-rail-prefs';
import GitFilterChip from './GitFilterChip';

export interface BranchFilterChipProps {
  refs: WorkspaceTreeRefWire[];
  currentRef: string | null;
  /** Favorite keys (`<kind>:<name>`) from the rail prefs. */
  favorites: ReadonlySet<string>;
  scopeRef: string | null;
  /** Kind of the scoped ref — the chip label reads Tag: for tags. */
  scopeKind: WorkspaceTreeRefWire['kind'];
  onScopeChange: (ref: string | null) => void;
}

const STAR = (
  <span aria-hidden style={{ width: 14, display: 'inline-flex', justifyContent: 'center' }}>
    ★
  </span>
);

const BranchFilterChip: React.FC<BranchFilterChipProps> = ({
  refs,
  currentRef,
  favorites,
  scopeRef,
  scopeKind,
  onScopeChange,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'menu' | 'search'>('menu');
  const [search, setSearch] = useState('');

  const close = (): void => {
    setOpen(false);
    setMode('menu');
    setSearch('');
  };

  const favoriteRows = useMemo(() => {
    const rows: Array<{ key: string; name: string }> = [];
    for (const ref of refs) {
      const isCurrent = ref.kind === 'local' && ref.name === currentRef;
      if (isCurrent || favorites.has(gitRailFavoriteKey(ref.kind, ref.name))) {
        rows.push({ key: `${ref.kind}:${ref.name}`, name: ref.name });
      }
    }
    return rows;
  }, [refs, currentRef, favorites]);

  const remotes = useMemo(() => {
    const byRemote = new Map<string, WorkspaceTreeRefWire[]>();
    for (const ref of refs) {
      if (ref.kind !== 'remote') continue;
      const remote = ref.name.split('/')[0] ?? '';
      const rows = byRemote.get(remote);
      if (rows !== undefined) rows.push(ref);
      else byRemote.set(remote, [ref]);
    }
    return [...byRemote.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [refs]);

  const locals = useMemo(() => refs.filter((ref) => ref.kind === 'local'), [refs]);
  const tags = useMemo(() => refs.filter((ref) => ref.kind === 'tag'), [refs]);

  const refItem = (ref: { kind: string; name: string }, starred: boolean): { key: string; label: string; icon?: React.ReactNode } => ({
    key: `ref:${ref.kind}:${ref.name}`,
    label: ref.name,
    ...(starred ? { icon: STAR } : {}),
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
          onScopeChange(null);
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
            { key: 'head', label: 'HEAD', icon: STAR },
            ...favoriteRows.map((row) => ({ key: `ref:${row.key}`, label: row.name, icon: STAR })),
          ],
        },
        { type: 'divider' },
        ...(locals.length > 0
          ? [
              {
                key: 'group-local',
                label: t('workbench.gitLog.refs.local'),
                children: locals.map((ref) => refItem(ref, false)),
              },
            ]
          : []),
        ...remotes.map(([remote, rows]) => ({
          key: `group-remote-${remote}`,
          label: `${remote}/…`,
          children: rows.map((ref) => refItem(ref, false)),
        })),
        ...(tags.length > 0
          ? [
              {
                key: 'group-tags',
                label: t('workbench.gitLog.refs.tags'),
                children: tags.map((ref) => refItem(ref, false)),
              },
            ]
          : []),
      ]}
    />
  );

  const needle = search.trim().toLowerCase();
  const searchRows = needle === '' ? refs : refs.filter((ref) => ref.name.toLowerCase().includes(needle));

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
        {searchRows.map((ref) => (
          <button
            key={`${ref.kind}:${ref.name}`}
            type="button"
            className="git-tool-row"
            onClick={() => {
              onScopeChange(ref.name);
              close();
            }}
            title={ref.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              width: '100%',
              padding: '3px 12px',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: 12,
              color: token.colorText,
            }}
            data-testid="git-tool-chip-branch-row"
            data-ref={ref.name}
          >
            <span style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {ref.name}
            </span>
          </button>
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
        if (!next) {
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
