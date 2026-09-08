/**
 * Backup and Sync settings group — pins the `backend` root (the id never
 * moved; only the labels say Backup and Sync) and the split of the old
 * single page into its child categories. Each child declares its
 * subcategories and every def it owns tags one of them, so
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
  it('backend is an ungated root between tools and connectivity, with no defs of its own; sync is its first child', () => {
    const backend = getCategory('backend');
    expect(backend?.parent).toBeUndefined();
    expect(backend?.when).toBeUndefined();
    expect(backend?.teaserWhenUnavailable).toBeUndefined();
    const roots = allCategories()
      .filter((c) => c.parent === undefined)
      .map((c) => c.id);
    expect(roots.indexOf('backend')).toBe(roots.indexOf('tools') + 1);
    expect(roots.indexOf('connectivity')).toBe(roots.indexOf('backend') + 1);
    expect(backend?.renderPane).toBeDefined();
    expect(backend?.subcategories).toBeUndefined();
    expect(byCategory('backend')).toHaveLength(0);
    const connections = getCategory('backendConnections');
    expect(connections?.parent).toBe('backend');
    expect(connections?.renderPane).toBeDefined();
    expect(byCategory('backendConnections')).toHaveLength(0);
    const children = allCategories()
      .filter((c) => c.parent === 'backend')
      .map((c) => c.id);
    expect(children).toEqual(['backendConnections', 'backendPairing', 'backendServer', 'backendReliability']);
    const ordered = allCategories().map((c) => c.id);
    expect(ordered[ordered.indexOf('backend') + 1]).toBe('backendConnections');
  });

  it('nests the reliability page under the backend node', () => {
    const reliability = getCategory('backendReliability');
    expect(reliability?.parent).toBe('backend');
    expect(reliability?.labelKey).toBeTruthy();
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

  it('desktop pairing owns the four native-messaging consent rows, extension-only', () => {
    const pairing = getCategory('backendPairing');
    expect(pairing?.parent).toBe('backend');
    expect(pairing?.when).toBeDefined();
    expect(pairing?.teaserWhenUnavailable).toBeUndefined();
    for (const key of [
      'backend.nmAutoJoin',
      'backend.nmAutoJoinProbe',
      'backend.requireNmIdentity',
      'backend.allowDesktopWatch',
    ] as const) {
      expect(getDef(key)?.category).toBe('backendPairing');
    }
    expectDefsTagDeclaredSubcategories('backendPairing');
  });

  it('server owns the daemon-side rows plus the known-devices ledger, desktop-only', () => {
    const server = getCategory('backendServer');
    expect(server?.parent).toBe('backend');
    expect(server?.when).toBeDefined();
    for (const key of [
      'backend.bindAddress',
      'backend.bindPort',
      'backend.serveWebApp',
      'backend.allowLocalPeerExecute',
      'backend.allowRemotePeerExecute',
      'backend.knownDevices',
    ] as const) {
      expect(getDef(key)?.category).toBe('backendServer');
    }
    expect(getDef('backend.knownDevices')?.customEditor).toBeDefined();
    expectDefsTagDeclaredSubcategories('backendServer');
  });

  it('the reconnection rows no longer hide behind the derived mode', () => {
    expect(getDef('backend.reconnectDelayMs')?.when).toBeUndefined();
    expect(getDef('backend.maxReconnectDelayMs')?.when).toBeUndefined();
    expect(getDef('backend.pingIntervalMs')?.when).toBeUndefined();
  });
});
