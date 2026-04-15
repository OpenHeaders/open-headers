/**
 * CategoryNav — left rail with scroll-spy highlight.
 *
 * Renders registered categories in `order`. Clicking a category scrolls
 * its section into view; scrolling the content pane updates the
 * highlighted category via IntersectionObserver.
 */

import { theme } from 'antd';
import type React from 'react';
import { allCategories } from '../registry';
import type { CategoryDef } from '../types';

interface CategoryNavProps {
  activeCategoryId: string | null;
  onSelect: (categoryId: string) => void;
  /** Which categories are currently non-empty (have at least one matching result). */
  visibleCategoryIds: ReadonlySet<string>;
}

const CategoryNav: React.FC<CategoryNavProps> = ({ activeCategoryId, onSelect, visibleCategoryIds }) => {
  const { token } = theme.useToken();
  const categories = allCategories();

  return (
    <nav
      className="settings-category-nav"
      aria-label="Settings categories"
      style={{
        width: 200,
        flexShrink: 0,
        padding: '12px 0',
        borderRight: `1px solid ${token.colorBorderSecondary}`,
        overflowY: 'auto',
        background: token.colorBgContainer,
      }}
    >
      {categories.map((cat: CategoryDef) => {
        if (!visibleCategoryIds.has(cat.id)) return null;
        const active = cat.id === activeCategoryId;
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
              padding: '8px 16px',
              border: 'none',
              background: active ? token.colorPrimaryBg : 'transparent',
              color: active ? token.colorPrimary : token.colorText,
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 13,
              fontWeight: active ? 500 : 400,
              borderLeft: `2px solid ${active ? token.colorPrimary : 'transparent'}`,
            }}
          >
            <span style={{ fontSize: 14, opacity: 0.85 }}>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default CategoryNav;
