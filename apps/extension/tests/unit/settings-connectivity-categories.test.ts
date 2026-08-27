/**
 * Connectivity settings group — pins the regroup of the Backend group
 * (every host) and the Proxy group (desktop / daemon admin, teasered
 * elsewhere) under one ungated group node; both keep their own children
 * one level deeper.
 */

import '@openheaders/ui/workbench/settings/categories';
import { allCategories, byCategory, getCategory } from '@openheaders/ui/workbench/settings/registry';
import { describe, expect, it } from 'vitest';

describe('connectivity settings group', () => {
  it('is an ungated group node with no defs of its own', () => {
    const group = getCategory('connectivity');
    expect(group?.parent).toBeUndefined();
    expect(group?.renderPane).toBeDefined();
    expect(group?.subcategories).toBeUndefined();
    expect(group?.when).toBeUndefined();
    expect(group?.teaserWhenUnavailable).toBeUndefined();
    expect(byCategory('connectivity')).toHaveLength(0);
  });

  it('backend then proxy are its children, with short nav labels', () => {
    const children = allCategories().filter((c) => c.parent === 'connectivity');
    expect(children.map((c) => c.id)).toEqual(['backend', 'proxy']);
    for (const child of children) expect(child.navLabelKey).toBeTruthy();
    expect(getCategory('backend')?.when).toBeUndefined();
    expect(getCategory('proxy')?.teaserWhenUnavailable).toBe('proxy');
  });

  it('both groups keep their own children one level deeper', () => {
    const ordered = allCategories().map((c) => c.id);
    const backendAt = ordered.indexOf('backend');
    expect(ordered[backendAt + 1]).toBe('backendConnections');
    expect(ordered.slice(ordered.indexOf('proxy'), ordered.indexOf('proxy') + 3)).toEqual([
      'proxy',
      'proxyOutbound',
      'proxyTrust',
    ]);
    expect(ordered.indexOf('connectivity')).toBeLessThan(backendAt);
  });
});
