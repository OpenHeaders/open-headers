/**
 * CategoryNav — left rail in page-swap mode.
 *
 * Renders every registered category. Clicking one swaps the right pane.
 * While the user is searching, no category is "active" (search results
 * own the right pane); each category shows a small match-count badge so
 * the user can pivot directly into the matching surface.
 */

import { theme } from 'antd';
import type React from 'react';
import { forwardRef, useImperativeHandle, useRef } from 'react';
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

const CategoryNav = forwardRef<CategoryNavHandle, CategoryNavProps>(function CategoryNav(
  { categories, activeCategoryId, onSelect, matchCount, isSearching, onLeaveTop },
  ref,
) {
  const { token } = theme.useToken();
  const buttonsRef = useRef<Map<string, HTMLButtonElement>>(new Map());

  const computeNavigable = (): string[] =>
    categories.filter((c) => !isSearching || (matchCount.get(c.id) ?? 0) > 0).map((c) => c.id);

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
  // bubbles back to the search input via onLeaveTop.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentId: string) => {
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

  return (
    <nav
      className="settings-category-nav"
      aria-label="Settings categories"
      style={{
        width: 220,
        flexShrink: 0,
        padding: 8,
        borderRight: `1px solid ${token.colorBorderSecondary}`,
        overflowY: 'auto',
        background: token.colorBgContainer,
      }}
    >
      {categories.map((cat: CategoryDef) => {
        const active = cat.id === activeCategoryId;
        const count = matchCount.get(cat.id) ?? 0;
        const dimmed = isSearching && count === 0;
        return (
          <button
            key={cat.id}
            ref={(el) => {
              if (el) buttonsRef.current.set(cat.id, el);
              else buttonsRef.current.delete(cat.id);
            }}
            type="button"
            onClick={() => onSelect(cat.id)}
            onKeyDown={(e) => handleKeyDown(e, cat.id)}
            aria-current={active ? 'true' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '6px 10px',
              marginBottom: 1,
              border: 'none',
              borderRadius: 6,
              background: active ? token.colorFillSecondary : 'transparent',
              color: dimmed ? token.colorTextTertiary : active ? token.colorText : token.colorTextSecondary,
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 13,
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
            <span style={{ fontSize: 14, opacity: 0.85, flex: 'none' }}>{cat.icon}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cat.label}
            </span>
            {isSearching && count > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: token.colorTextSecondary,
                  background: token.colorFillSecondary,
                  padding: '0 6px',
                  borderRadius: 8,
                  lineHeight: '16px',
                  minWidth: 18,
                  textAlign: 'center',
                  flex: 'none',
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
});

export default CategoryNav;
