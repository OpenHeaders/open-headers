/**
 * Connectivity settings group — pins the ungated group node over the
 * Proxy group (desktop / daemon admin, teasered elsewhere), which keeps
 * its own children one level deeper. Backup and Sync left it for a root
 * of its own; nothing sync-related nests here any more.
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

  it('proxy is its only child, with a short nav label and its teaser', () => {
    const children = allCategories().filter((c) => c.parent === 'connectivity');
    expect(children.map((c) => c.id)).toEqual(['proxy']);
    for (const child of children) expect(child.labelKey).toBeTruthy();
    expect(getCategory('proxy')?.teaserWhenUnavailable).toBe('proxy');
  });

  it('proxy keeps its own children one level deeper', () => {
    const ordered = allCategories().map((c) => c.id);
    expect(ordered.slice(ordered.indexOf('proxy'), ordered.indexOf('proxy') + 3)).toEqual([
      'proxy',
      'proxyOutbound',
      'proxyTrust',
    ]);
    expect(ordered.indexOf('connectivity')).toBeLessThan(ordered.indexOf('proxy'));
  });
});
