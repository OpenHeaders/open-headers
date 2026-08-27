/**
 * Git settings group — pins the split of the old single Git page into
 * child categories under the `git` node. The pages carry no settings
 * defs (every value lives on the daemon's binding record), so the pins
 * are structural: parent, nav label, declared subcategories, host gate,
 * and the group's teaser staying on the parent alone.
 */

import '@openheaders/ui/workbench/settings/categories';
import { allCategories, byCategory, getCategory } from '@openheaders/ui/workbench/settings/registry';
import { describe, expect, it } from 'vitest';

describe('git settings group', () => {
  it('git is desktop-gated with the teaser and no defs of its own', () => {
    const git = getCategory('git');
    expect(git?.parent).toBeUndefined();
    expect(git?.when).toBeDefined();
    expect(git?.teaserWhenUnavailable).toBe('git');
    expect(byCategory('git')).toHaveLength(0);
  });

  it('folder is the first child: binding and requirements, desktop-only, no teaser of its own', () => {
    const folder = getCategory('gitFolder');
    expect(folder?.parent).toBe('git');
    expect(folder?.navLabelKey).toBeTruthy();
    expect(folder?.renderPane).toBeDefined();
    expect(folder?.when).toBeDefined();
    expect(folder?.teaserWhenUnavailable).toBeUndefined();
    expect(folder?.subcategories?.map((s) => s.id)).toEqual(['binding', 'requirements']);
    expect(byCategory('gitFolder')).toHaveLength(0);
    const children = allCategories()
      .filter((c) => c.parent === 'git')
      .map((c) => c.id);
    expect(children[0]).toBe('gitFolder');
  });
});
