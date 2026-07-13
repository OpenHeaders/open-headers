/**
 * CategoryNav — left rail in page-swap mode.
 *
 * Labeled mode renders a one-level tree: top-level categories in
 * registry order, child categories (`CategoryDef.parent`) indented
 * under their parent behind an expand caret. Collapsed mode (labels
 * hidden) falls back to a flat icon rail where every category —
 * children included — gets its own button.
 *
 * While the user is searching, no category is "active" (search results
 * own the right pane); rows show per-category match counts and parents
 * auto-expand when a child has matches.
 */

import { RightOutlined } from '@ant-design/icons';
import { Dropdown, Tooltip, theme } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import type React from 'react';
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useSetting } from '../hooks';
import { categoryNavLabel, resolveLabel } from '../localize';
import type { CategoryDef } from '../types';

interface CategoryNavProps {
  categories: readonly CategoryDef[];
  activeCategoryId: string | null;
  onSelect: (categoryId: string) => void;
  /** Match count per category id while searching; empty otherwise. */
  matchCount: ReadonlyMap<string, number>;
  isSearching: boolean;
  /** Called when ArrowUp is pressed at the first navigable item (return to search). */
  onLeaveTop?: () => void;
}

export interface CategoryNavHandle {
  /** Focus the active button (or the first navigable one if none is active). */
  focusActive: () => void;
}

const CARET_SLOT = 20;

const CategoryNav = forwardRef<CategoryNavHandle, CategoryNavProps>(function CategoryNav(
  { categories, activeCategoryId, onSelect, matchCount, isSearching, onLeaveTop },
  ref,
) {
  const { token } = theme.useToken();
  const t = useT();
  const buttonsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [showLabels, setShowLabels] = useSetting('general.settingsShowCategoryLabels');

  // ── Tree shape ───────────────────────────────────────────────────────
  const tree = useMemo(() => {
    const ids = new Set(categories.map((c) => c.id));
    const top: CategoryDef[] = [];
    const children = new Map<string, CategoryDef[]>();
    for (const cat of categories) {
      if (cat.parent && ids.has(cat.parent)) {
        const list = children.get(cat.parent);
        if (list) list.push(cat);
        else children.set(cat.parent, [cat]);
      } else {
        top.push(cat);
      }
    }
    return { top, children };
  }, [categories]);

  // ── Expansion state ──────────────────────────────────────────────────
  // Manual caret toggles win; otherwise a parent auto-opens while its
  // child is active or while a search has matches inside it.
  const [openOverrides, setOpenOverrides] = useState<ReadonlyMap<string, boolean>>(new Map());

  const childMatchSum = (id: string): number =>
    (tree.children.get(id) ?? []).reduce((sum, c) => sum + (matchCount.get(c.id) ?? 0), 0);

  const isOpen = (id: string): boolean => {
    const override = openOverrides.get(id);
    if (override !== undefined) return override;
    if ((tree.children.get(id) ?? []).some((c) => c.id === activeCategoryId)) return true;
    return isSearching && childMatchSum(id) > 0;
  };

  const toggleOpen = (id: string) => {
    setOpenOverrides((prev) => new Map(prev).set(id, !isOpen(id)));
  };

  const contextMenu: ItemType[] = [
    {
      key: 'labels',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {/* visibility (not conditional render) keeps the glyph's line box
              when unchecked, so the row height and text position never shift. */}
          <span style={{ width: 12, display: 'inline-block', visibility: showLabels ? 'visible' : 'hidden' }}>✓</span>
          {t('workbench.settings.shell.showCategoryNames')}
        </span>
      ),
      onClick: () => setShowLabels(!showLabels),
    },
  ];

  // Visible rows in visual order — the keyboard navigation path.
  const computeNavigable = (): string[] => {
    const hasMatch = (id: string) => (matchCount.get(id) ?? 0) > 0;
    if (!showLabels) {
      return categories.filter((c) => !isSearching || hasMatch(c.id) || childMatchSum(c.id) > 0).map((c) => c.id);
    }
    const ids: string[] = [];
    for (const cat of tree.top) {
      if (!isSearching || hasMatch(cat.id) || childMatchSum(cat.id) > 0) ids.push(cat.id);
      if (isOpen(cat.id)) {
        for (const kid of tree.children.get(cat.id) ?? []) {
          if (!isSearching || hasMatch(kid.id)) ids.push(kid.id);
        }
      }
    }
    return ids;
  };

  useImperativeHandle(ref, () => ({
    focusActive: () => {
      const ids = computeNavigable();
      if (ids.length === 0) return;
      const target = activeCategoryId && ids.includes(activeCategoryId) ? activeCategoryId : ids[0];
      buttonsRef.current.get(target)?.focus();
    },
  }));

  // Arrow keys move selection between navigable categories. Focus follows
  // selection so the next arrow press keeps moving. ArrowUp at the top
  // bubbles back to the search input via onLeaveTop. ArrowRight/ArrowLeft
  // expand/collapse group rows, tree-view-style.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentId: string) => {
    if (showLabels && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      const kids = tree.children.get(currentId) ?? [];
      if (kids.length > 0) {
        e.preventDefault();
        const wantOpen = e.key === 'ArrowRight';
        if (isOpen(currentId) !== wantOpen) toggleOpen(currentId);
      }
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const ids = computeNavigable();
    if (ids.length === 0) return;
    const idx = Math.max(0, ids.indexOf(currentId));
    if (e.key === 'ArrowUp' && idx === 0 && onLeaveTop) {
      e.preventDefault();
      onLeaveTop();
      return;
    }
    e.preventDefault();
    let nextIdx = idx;
    if (e.key === 'ArrowDown') nextIdx = (idx + 1) % ids.length;
    else if (e.key === 'ArrowUp') nextIdx = (idx - 1 + ids.length) % ids.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = ids.length - 1;
    const nextId = ids[nextIdx];
    onSelect(nextId);
    buttonsRef.current.get(nextId)?.focus();
  };

  const renderRow = (cat: CategoryDef, depth: number) => {
    const active = cat.id === activeCategoryId;
    const kids = showLabels ? (tree.children.get(cat.id) ?? []) : [];
    const hasKids = kids.length > 0;
    const open = hasKids && isOpen(cat.id);
    const ownCount = matchCount.get(cat.id) ?? 0;
    const badgeCount = ownCount + (hasKids && !open ? childMatchSum(cat.id) : 0);
    const dimmed = isSearching && ownCount === 0 && (!hasKids || childMatchSum(cat.id) === 0);
    const button = (
      <button
        key={cat.id}
        ref={(el) => {
          if (el) buttonsRef.current.set(cat.id, el);
          else buttonsRef.current.delete(cat.id);
        }}
        type="button"
        onClick={() => onSelect(cat.id)}
        onDoubleClick={hasKids ? () => toggleOpen(cat.id) : undefined}
        onKeyDown={(e) => handleKeyDown(e, cat.id)}
        aria-current={active ? 'true' : undefined}
        aria-expanded={hasKids ? open : undefined}
        aria-label={showLabels ? undefined : resolveLabel(cat, t)}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: showLabels ? 'flex-start' : 'center',
          width: '100%',
          padding: showLabels ? `4px 8px 4px ${8 + depth * CARET_SLOT}px` : '6px 0',
          marginBottom: 1,
          border: 'none',
          borderRadius: 5,
          background: active ? `${token.colorPrimary}cc` : 'transparent',
          color: dimmed ? token.colorTextTertiary : active ? token.colorTextLightSolid : token.colorTextSecondary,
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: 12,
          fontWeight: active ? 500 : 400,
          transition: 'background 80ms ease, color 80ms ease',
        }}
        onMouseEnter={(e) => {
          if (!active) e.currentTarget.style.background = token.colorBgTextHover;
        }}
        onMouseLeave={(e) => {
          if (!active) e.currentTarget.style.background = 'transparent';
        }}
      >
        {showLabels ? (
          // Caret is a click target only; the parent button carries
          // aria-expanded and ArrowRight/ArrowLeft handle keyboard.
          <span
            aria-hidden
            onClick={
              hasKids
                ? (e) => {
                    e.stopPropagation();
                    toggleOpen(cat.id);
                  }
                : undefined
            }
            style={{
              width: CARET_SLOT,
              flex: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: hasKids ? 0.7 : 0,
            }}
          >
            <RightOutlined
              style={{
                fontSize: 10,
                transform: open ? 'rotate(90deg)' : 'none',
                transition: 'transform 100ms ease',
              }}
            />
          </span>
        ) : (
          <span style={{ fontSize: 13, opacity: 0.85, flex: 'none' }}>{cat.icon}</span>
        )}
        {showLabels && (
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {categoryNavLabel(cat, t)}
          </span>
        )}
        {isSearching && badgeCount > 0 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: token.colorTextSecondary,
              background: token.colorFillSecondary,
              padding: showLabels ? '0 5px' : '0 4px',
              borderRadius: 7,
              lineHeight: '14px',
              minWidth: showLabels ? 18 : 14,
              textAlign: 'center',
              flex: 'none',
              position: showLabels ? 'static' : 'absolute',
              top: showLabels ? undefined : 2,
              right: showLabels ? undefined : 2,
            }}
          >
            {badgeCount}
          </span>
        )}
      </button>
    );
    const row = showLabels ? (
      button
    ) : (
      <Tooltip key={cat.id} title={resolveLabel(cat, t)} placement="right">
        {button}
      </Tooltip>
    );
    if (!hasKids || !open) return row;
    return (
      <div key={cat.id}>
        {row}
        {kids.map((kid) => renderRow(kid, depth + 1))}
      </div>
    );
  };

  const rows = showLabels ? tree.top : categories;

  return (
    <Dropdown menu={{ items: contextMenu }} trigger={['contextMenu']}>
      <nav
        className="settings-category-nav"
        aria-label={t('workbench.settings.shell.navAria')}
        style={{
          width: showLabels ? 190 : 38,
          flexShrink: 0,
          padding: showLabels ? 6 : 4,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          overflowY: 'auto', overscrollBehavior: 'none',
          background: token.colorBgContainer,
          transition: 'width 120ms ease, padding 120ms ease',
        }}
      >
        {rows.map((cat) => renderRow(cat, 0))}
      </nav>
    </Dropdown>
  );
});

export default CategoryNav;
