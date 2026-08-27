/**
 * Appearance & Behavior settings group — pins the regroup of General,
 * Appearance and Workspace Layout under one group node, and the shell's
 * default-landing rule: the first LEAF in nav order, never a group's
 * landing page.
 */

import '@openheaders/ui/workbench/settings/categories';
import '@openheaders/ui/workbench/settings/schema/general';
import { allCategories, byCategory, getCategory } from '@openheaders/ui/workbench/settings/registry';
import { describe, expect, it } from 'vitest';

describe('appearance & behavior settings group', () => {
  it('is the first root: an all-host group node with no defs of its own', () => {
    const group = getCategory('appearanceBehavior');
    expect(group?.parent).toBeUndefined();
    expect(group?.renderPane).toBeDefined();
    expect(group?.subcategories).toBeUndefined();
    expect(group?.when).toBeUndefined();
    expect(byCategory('appearanceBehavior')).toHaveLength(0);
    expect(allCategories()[0]?.id).toBe('appearanceBehavior');
  });

  it('general, appearance and workspace layout are its children, in that order, with short nav labels', () => {
    const children = allCategories()
      .filter((c) => c.parent === 'appearanceBehavior')
      .map((c) => c.id);
    expect(children).toEqual(['general', 'appearance', 'workspaceLayout']);
    for (const id of children) expect(getCategory(id)?.navLabelKey).toBeTruthy();
    expect(byCategory('general').length).toBeGreaterThan(0);
  });

  it('the first leaf in nav order is general — the shell lands there, not on the landing pane', () => {
    const all = allCategories();
    const parents = new Set(all.map((c) => c.parent));
    expect(all.find((c) => !parents.has(c.id))?.id).toBe('general');
  });
});
