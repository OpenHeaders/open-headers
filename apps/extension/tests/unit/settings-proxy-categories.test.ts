/**
 * Proxy settings root — pins the gated group node (desktop / daemon
 * admin, teasered elsewhere) over its two planes one level deeper. It
 * stood under a Connectivity group until Backup and Sync left for a
 * root of its own and the wrapper held Proxy alone; the wrapper went.
 */

import '@openheaders/ui/workbench/settings/categories';
import { allCategories, byCategory, getCategory } from '@openheaders/ui/workbench/settings/registry';
import { describe, expect, it } from 'vitest';

describe('proxy settings root', () => {
  it('is a teasered group root with no defs of its own', () => {
    const group = getCategory('proxy');
    expect(group?.parent).toBeUndefined();
    expect(group?.renderPane).toBeDefined();
    expect(group?.subcategories).toBeUndefined();
    expect(group?.when).toBeDefined();
    expect(group?.teaserWhenUnavailable).toBe('proxy');
    expect(byCategory('proxy')).toHaveLength(0);
    expect(getCategory('connectivity')).toBeUndefined();
  });

  it('keeps its two planes one level deeper, in order', () => {
    const ordered = allCategories().map((c) => c.id);
    expect(ordered.slice(ordered.indexOf('proxy'), ordered.indexOf('proxy') + 3)).toEqual([
      'proxy',
      'proxyOutbound',
      'proxyTrust',
    ]);
    const children = allCategories().filter((c) => c.parent === 'proxy');
    expect(children.map((c) => c.id)).toEqual(['proxyOutbound', 'proxyTrust']);
    for (const child of children) expect(child.labelKey).toBeTruthy();
  });
});
