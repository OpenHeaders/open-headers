/**
 * GroupLandingPane — right-hand pane for group categories.
 *
 * Group nodes in the nav tree own no settings; selecting one shows this
 * landing surface instead: the group's description followed by anchor
 * links into each child category.
 */

import { theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { categoryNavLabel, resolveOptionalDescription } from '../localize';
import { allCategories } from '../registry';
import type { CategoryPaneProps } from '../types';

const GroupLandingPane: React.FC<CategoryPaneProps> = ({ category, onSelectCategory }) => {
  const { token } = theme.useToken();
  const t = useT();
  const children = allCategories().filter((c) => c.parent === category.id);
  const description = resolveOptionalDescription(category, t);

  return (
    <div style={{ padding: '14px 18px 20px' }}>
      <header style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: token.colorText, letterSpacing: -0.1 }}>
          {categoryNavLabel(category, t)}
        </h2>
        {description && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.5 }}>
            {description}
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
            {categoryNavLabel(child, t)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default GroupLandingPane;
