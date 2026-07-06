/**
 * GroupLandingPane — right-hand pane for group categories.
 *
 * Group nodes in the nav tree own no settings; selecting one shows this
 * landing surface instead: the group's description followed by anchor
 * links into each child category.
 */

import { theme } from 'antd';
import type React from 'react';
import { allCategories } from '../registry';
import type { CategoryPaneProps } from '../types';

const GroupLandingPane: React.FC<CategoryPaneProps> = ({ category, onSelectCategory }) => {
  const { token } = theme.useToken();
  const children = allCategories().filter((c) => c.parent === category.id);

  return (
    <div style={{ padding: '14px 18px 20px' }}>
      <header style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: token.colorText, letterSpacing: -0.1 }}>
          {category.navLabel ?? category.label}
        </h2>
        {category.description && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.5 }}>
            {category.description}
          </p>
        )}
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
        {children.map((child) => (
          <button
            key={child.id}
            type="button"
            onClick={() => onSelectCategory?.(child.id)}
            style={{
              padding: 0,
              border: 'none',
              background: 'transparent',
              fontSize: 12.5,
              color: token.colorPrimary,
              cursor: 'pointer',
            }}
          >
            {child.navLabel ?? child.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default GroupLandingPane;
