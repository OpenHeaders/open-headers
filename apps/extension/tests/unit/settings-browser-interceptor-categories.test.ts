/**
 * Browser Interceptor settings group — pins the regroup of the three
 * browser-side pages (Rules Engine, Debug Mode, DevTools Panel) under one
 * group node. Ids and storage keys never changed; the pins are structural:
 * parent, child order, nav labels, and the DevTools Panel group keeping its
 * own children one level deeper.
 */

import '@openheaders/ui/workbench/settings/categories';
import '@openheaders/ui/workbench/settings/schema/inspection';
import '@openheaders/ui/workbench/settings/schema/rules-engine';
import { allCategories, byCategory, getCategory } from '@openheaders/ui/workbench/settings/registry';
import { describe, expect, it } from 'vitest';

describe('browser interceptor settings group', () => {
  it('browser interceptor is an all-host group node with no defs of its own', () => {
    const group = getCategory('browserInterceptor');
    expect(group?.parent).toBeUndefined();
    expect(group?.renderPane).toBeDefined();
    expect(group?.subcategories).toBeUndefined();
    expect(group?.when).toBeUndefined();
    expect(byCategory('browserInterceptor')).toHaveLength(0);
  });

  it('rules engine, debug mode and the devtools panel are its children, in that order', () => {
    const children = allCategories()
      .filter((c) => c.parent === 'browserInterceptor')
      .map((c) => c.id);
    expect(children).toEqual(['rulesEngine', 'inspection', 'devpanel']);
    for (const id of children) expect(getCategory(id)?.labelKey).toBeTruthy();
  });

  it('the leaves keep their defs and the devtools panel keeps its own children one level deeper', () => {
    expect(byCategory('rulesEngine').length).toBeGreaterThan(0);
    expect(byCategory('inspection').length).toBeGreaterThan(0);
    expect(byCategory('devpanel')).toHaveLength(0);
    const ordered = allCategories().map((c) => c.id);
    const devpanelAt = ordered.indexOf('devpanel');
    expect(ordered[devpanelAt + 1]).toBe('devpanelLayout');
    expect(getCategory('devpanelLayout')?.parent).toBe('devpanel');
    expect(ordered.indexOf('browserInterceptor')).toBeLessThan(ordered.indexOf('rulesEngine'));
  });
});
