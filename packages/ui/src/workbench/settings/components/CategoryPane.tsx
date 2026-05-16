/**
 * CategoryPane — single-category content surface.
 *
 * Renders one category's settings as one or more rounded cards. When
 * the category declares subcategories, each gets its own card with a
 * small section header above it; otherwise all rows share one card.
 */

import { theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import SettingRow from '../fields/SettingRow';
import type { CategoryDef, SettingDef, SubcategoryDef } from '../types';

interface CategoryPaneProps {
  category: CategoryDef;
  defs: readonly SettingDef[];
}

interface Group {
  sub: SubcategoryDef | null;
  defs: SettingDef[];
}

function groupBySubcategory(category: CategoryDef, defs: readonly SettingDef[]): Group[] {
  const subs = category.subcategories ?? [];
  if (subs.length === 0) return [{ sub: null, defs: [...defs] }];

  const ordered = [...subs].sort((a, b) => a.order - b.order);
  const map = new Map<string, SettingDef[]>();
  const orphans: SettingDef[] = [];
  for (const def of defs) {
    if (def.subcategory && ordered.some((s) => s.id === def.subcategory)) {
      const list = map.get(def.subcategory);
      if (list) list.push(def);
      else map.set(def.subcategory, [def]);
    } else {
      orphans.push(def);
    }
  }

  const groups: Group[] = [];
  if (orphans.length > 0) groups.push({ sub: null, defs: orphans });
  for (const sub of ordered) {
    const list = map.get(sub.id);
    if (list && list.length > 0) groups.push({ sub, defs: list });
  }
  return groups;
}

const CategoryPane: React.FC<CategoryPaneProps> = ({ category, defs }) => {
  const { token } = theme.useToken();
  const groups = useMemo(() => groupBySubcategory(category, defs), [category, defs]);

  return (
    <div style={{ padding: '24px 28px 32px' }}>
      <header style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: token.colorText, letterSpacing: -0.1 }}>
          {category.label}
        </h2>
        {category.description && (
          <p style={{ margin: '2px 0 0', fontSize: 12, color: token.colorTextSecondary }}>{category.description}</p>
        )}
      </header>
      {groups.map((group, i) => (
        <section key={group.sub?.id ?? `_orphans_${i}`} style={{ marginBottom: 20 }}>
          {group.sub && (
            <h3
              style={{
                margin: '0 0 8px 4px',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                color: token.colorTextTertiary,
              }}
            >
              {group.sub.label}
            </h3>
          )}
          <div className="settings-card">
            {group.defs.map((def) => (
              <SettingRow key={def.key} def={def} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default CategoryPane;
