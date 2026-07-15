/**
 * keymap-groups — pure derivation layer for the Keymap pane.
 *
 * Groups the keyboard category's setting defs by subcategory (in
 * declared order) and filters them against the pane's plain-text
 * search. Kept free of React so the shape of the pane is unit-testable
 * without rendering.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { resolveDescription, resolveLabel } from '../../localize';
import type { CategoryDef, SettingDef, SubcategoryDef } from '../../types';

export interface KeymapGroup {
  sub: SubcategoryDef | null;
  defs: SettingDef[];
}

function matchesQuery(def: SettingDef, query: string, t: Translate): boolean {
  if (resolveLabel(def, t).toLowerCase().includes(query)) return true;
  if (resolveDescription(def, t).toLowerCase().includes(query)) return true;
  return def.key.toLowerCase().includes(query);
}

/**
 * Subcategory-ordered groups of the defs matching `query` (empty query
 * matches everything). Groups left empty by the filter are dropped;
 * defs pointing at an undeclared subcategory land in a leading
 * ungrouped bucket, mirroring the default CategoryPane.
 */
export function buildKeymapGroups(
  category: CategoryDef,
  defs: readonly SettingDef[],
  query: string,
  t: Translate,
): KeymapGroup[] {
  const needle = query.trim().toLowerCase();
  const filtered = needle.length === 0 ? [...defs] : defs.filter((def) => matchesQuery(def, needle, t));

  const subs = [...(category.subcategories ?? [])].sort((a, b) => a.order - b.order);
  if (subs.length === 0) return filtered.length > 0 ? [{ sub: null, defs: filtered }] : [];

  const bySub = new Map<string, SettingDef[]>();
  const orphans: SettingDef[] = [];
  for (const def of filtered) {
    if (def.subcategory && subs.some((s) => s.id === def.subcategory)) {
      const list = bySub.get(def.subcategory);
      if (list) list.push(def);
      else bySub.set(def.subcategory, [def]);
    } else {
      orphans.push(def);
    }
  }

  const groups: KeymapGroup[] = [];
  if (orphans.length > 0) groups.push({ sub: null, defs: orphans });
  for (const sub of subs) {
    const list = bySub.get(sub.id);
    if (list && list.length > 0) groups.push({ sub, defs: list });
  }
  return groups;
}
