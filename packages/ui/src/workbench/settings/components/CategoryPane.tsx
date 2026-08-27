/**
 * CategoryPane — single-category content surface.
 *
 * Renders one category's settings through the shared pane chrome. When
 * the category declares subcategories, each gets its own section with a
 * small header above it; otherwise all rows share one flush section.
 */

import type React from 'react';
import { useMemo } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import SettingRow from '../fields/SettingRow';
import { resolveLabel } from '../localize';
import type { CategoryDef, SettingDef, SubcategoryDef } from '../types';
import { Pane, PaneHeader, PaneSection } from './pane-chrome';

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
  const t = useT();
  const groups = useMemo(() => groupBySubcategory(category, defs), [category, defs]);

  return (
    <Pane>
      <PaneHeader category={category} />
      {groups.map((group, i) => (
        <PaneSection key={group.sub?.id ?? `_orphans_${i}`} title={group.sub ? resolveLabel(group.sub, t) : undefined}>
          {group.defs.map((def) => (
            <SettingRow key={def.key} def={def} />
          ))}
        </PaneSection>
      ))}
    </Pane>
  );
};

export default CategoryPane;
