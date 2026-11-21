/**
 * Result grouping — how a flat list of matched settings is laid out
 * for display: one group per category, in the nav's category order.
 */

import type { CategoryDef, SettingDef } from '../types';

export interface CategoryGroup {
  category: CategoryDef;
  defs: readonly SettingDef[];
}

/**
 * Buckets `defs` by category and orders the buckets as `categories` is
 * ordered. Settings of a category not in `categories` are dropped.
 */
export function groupByCategory(defs: readonly SettingDef[], categories: readonly CategoryDef[]): CategoryGroup[] {
  const buckets = new Map<string, SettingDef[]>();
  for (const def of defs) {
    const list = buckets.get(def.category);
    if (list) list.push(def);
    else buckets.set(def.category, [def]);
  }
  const groups: CategoryGroup[] = [];
  for (const category of categories) {
    const list = buckets.get(category.id);
    if (list) groups.push({ category, defs: list });
  }
  return groups;
}

/** The leading `limit` settings of `groups`, group boundaries kept; the last group may be partial. */
export function takeRows(groups: readonly CategoryGroup[], limit: number): CategoryGroup[] {
  const taken: CategoryGroup[] = [];
  let remaining = limit;
  for (const group of groups) {
    if (remaining <= 0) break;
    taken.push(
      group.defs.length <= remaining ? group : { category: group.category, defs: group.defs.slice(0, remaining) },
    );
    remaining -= group.defs.length;
  }
  return taken;
}
