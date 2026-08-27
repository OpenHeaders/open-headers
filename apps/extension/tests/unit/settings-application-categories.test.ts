/**
 * Application settings group — pins the regroup of Data, Updates, License
 * and About under one ungated group node, and the settled nine-root nav:
 * Appearance & Behavior, Keyboard, Code Editor, Browser Interceptor, API
 * Requests, Version Control, Tools, Connectivity, Application.
 */

import '@openheaders/ui/workbench/settings/categories';
import '@openheaders/ui/workbench/settings/schema/data';
import { allCategories, byCategory, getCategory } from '@openheaders/ui/workbench/settings/registry';
import { describe, expect, it } from 'vitest';

describe('application settings group', () => {
  it('is the last root: an ungated group node with no defs of its own', () => {
    const group = getCategory('application');
    expect(group?.parent).toBeUndefined();
    expect(group?.renderPane).toBeDefined();
    expect(group?.subcategories).toBeUndefined();
    expect(group?.when).toBeUndefined();
    expect(byCategory('application')).toHaveLength(0);
    expect(allCategories().at(-1)?.id).toBe('about');
  });

  it('data, updates, license and about are its children, in that order', () => {
    const children = allCategories().filter((c) => c.parent === 'application');
    expect(children.map((c) => c.id)).toEqual(['data', 'updates', 'license', 'about']);
    for (const child of children) expect(child.navLabelKey).toBeTruthy();
    expect(byCategory('data').length).toBeGreaterThan(0);
    expect(getCategory('updates')?.when).toBeDefined();
    expect(getCategory('license')?.when).toBeDefined();
    expect(getCategory('about')?.when).toBeUndefined();
  });

  it('the nav has exactly nine roots in the settled order', () => {
    const roots = allCategories()
      .filter((c) => c.parent === undefined)
      .map((c) => c.id);
    expect(roots).toEqual([
      'appearanceBehavior',
      'keyboard',
      'editor',
      'browserInterceptor',
      'requests',
      'versionControl',
      'tools',
      'connectivity',
      'application',
    ]);
  });
});
