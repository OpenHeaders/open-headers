/**
 * AI · MCP Server settings group — pins the split of the old single MCP
 * page into child categories under the `mcp` group node. Each child
 * declares its subcategories and every def it owns tags one of them, so
 * `CategoryPane` never renders an orphan list. The paired-devices ledger
 * has ONE home (Backend › Server) — no `mcp.*` def wraps it.
 */

import '@openheaders/ui/workbench/settings/categories';
import '@openheaders/ui/workbench/settings/schema/backend';
import '@openheaders/ui/workbench/settings/schema/mcp';
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

describe('mcp settings group', () => {
  it('mcp is a desktop-gated group node with the teaser and no defs of its own', () => {
    const mcp = getCategory('mcp');
    expect(mcp?.parent).toBe('tools');
    expect(mcp?.renderPane).toBeDefined();
    expect(mcp?.subcategories).toBeUndefined();
    expect(mcp?.when).toBeDefined();
    expect(mcp?.teaserWhenUnavailable).toBe('mcp');
    expect(byCategory('mcp')).toHaveLength(0);
    const children = allCategories()
      .filter((c) => c.parent === 'mcp')
      .map((c) => c.id);
    expect(children).toEqual(['mcpAccess', 'mcpClients']);
  });

  it('access owns the five switches under server and permissions, desktop-only, no teaser of its own', () => {
    const access = getCategory('mcpAccess');
    expect(access?.parent).toBe('mcp');
    expect(access?.navLabelKey).toBeTruthy();
    expect(access?.when).toBeDefined();
    expect(access?.teaserWhenUnavailable).toBeUndefined();
    expect(getDef('mcp.enabled')?.subcategory).toBe('server');
    for (const key of ['mcp.allowObserve', 'mcp.allowWrite', 'mcp.allowExecute', 'mcp.allowSecrets'] as const) {
      expect(getDef(key)?.category).toBe('mcpAccess');
      expect(getDef(key)?.subcategory).toBe('permissions');
    }
    expectDefsTagDeclaredSubcategories('mcpAccess');
  });

  it('clients owns the cli access and client config rows as custom editors, desktop-only', () => {
    const clients = getCategory('mcpClients');
    expect(clients?.parent).toBe('mcp');
    expect(clients?.when).toBeDefined();
    expect(getDef('mcp.cliAccess')?.category).toBe('mcpClients');
    expect(getDef('mcp.cliAccess')?.customEditor).toBeDefined();
    expect(getDef('mcp.clientConfig')?.category).toBe('mcpClients');
    expect(getDef('mcp.clientConfig')?.customEditor).toBeDefined();
    expect(byCategory('mcpClients').map((d) => d.key)).toEqual(['mcp.cliAccess', 'mcp.clientConfig']);
    expectDefsTagDeclaredSubcategories('mcpClients');
  });

  it('the paired-devices ledger keeps its one home on backend server', () => {
    expect(getDef('backend.knownDevices')?.category).toBe('backendServer');
    expect(byCategory('mcpAccess').some((d) => d.customEditor)).toBe(false);
  });
});
