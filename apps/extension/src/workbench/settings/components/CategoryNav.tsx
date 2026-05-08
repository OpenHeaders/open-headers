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
import type { CategoryDef } from '../types';

interface CategoryNavProps {
  categories: readonly CategoryDef[];
  activeCategoryId: string | null;
  onSelect: (categoryId: string) => void;
  /** Match count per category id while searching; empty otherwise. */
  matchCount: ReadonlyMap<string, number>;
  isSearching: boolean;
}

const CategoryNav: React.FC<CategoryNavProps> = ({
  categories,
  activeCategoryId,
  onSelect,
  matchCount,
  isSearching,
}) => {
  const { token } = theme.useToken();

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
            type="button"
            onClick={() => onSelect(cat.id)}
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
};

export default CategoryNav;
