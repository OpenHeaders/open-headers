/**
 * Backend settings group — pins the split of the old single Backend
 * page into child categories under the `backend` group node. Each child
 * declares its subcategories and every def it owns tags one of them, so
 * `CategoryPane` never renders an orphan list.
 */

import '@openheaders/ui/workbench/settings/categories';
import '@openheaders/ui/workbench/settings/schema/backend';
import { allCategories, byCategory, getCategory, getDef } from '@openheaders/ui/workbench/settings/registry';
import { describe, expect, it } from 'vitest';

function expectDefsTagDeclaredSubcategories(categoryId: string): void {
  const category = getCategory(categoryId);
  if (!category) throw new Error(`${categoryId} not registered`);
  const declared = new Set((category.subcategories ?? []).map((s) => s.id));
  for (const def of byCategory(categoryId)) {
    expect(def.subcategory, `${def.key} must tag a declared subcategory`).toBeDefined();
    expect(declared.has(def.subcategory ?? '')).toBe(true);
  }
}

describe('backend settings group', () => {
  it('nests the reliability page under the backend node', () => {
    const reliability = getCategory('backendReliability');
    expect(reliability?.parent).toBe('backend');
    expect(reliability?.navLabelKey).toBeTruthy();
    const ids = allCategories().map((c) => c.id);
    expect(ids.indexOf('backendReliability')).toBeGreaterThan(ids.indexOf('backend'));
  });

  it('reliability owns the reconnection, status and offline-fallback rows', () => {
    expect(getDef('backend.reconnectDelayMs')?.category).toBe('backendReliability');
    expect(getDef('backend.maxReconnectDelayMs')?.category).toBe('backendReliability');
    expect(getDef('backend.pingIntervalMs')?.category).toBe('backendReliability');
    expect(getDef('backend.showBadgeWhenDisconnected')?.category).toBe('backendReliability');
    expect(getDef('backend.offlineFallbackOrder')?.customEditor).toBeDefined();
    expectDefsTagDeclaredSubcategories('backendReliability');
  });

  it('the reconnection rows no longer hide behind the derived mode', () => {
    expect(getDef('backend.reconnectDelayMs')?.when).toBeUndefined();
    expect(getDef('backend.maxReconnectDelayMs')?.when).toBeUndefined();
    expect(getDef('backend.pingIntervalMs')?.when).toBeUndefined();
  });
});
