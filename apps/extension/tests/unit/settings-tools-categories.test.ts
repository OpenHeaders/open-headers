/**
 * Tools settings group — pins the regroup of Terminal, Traffic and the
 * AI · MCP Server group under one ungated group node: every child is
 * desktop-only with its own teaser, so browser hosts keep discovering
 * them through the group.
 */

import '@openheaders/ui/workbench/settings/categories';
import '@openheaders/ui/workbench/settings/schema/terminal';
import { allCategories, byCategory, getCategory } from '@openheaders/ui/workbench/settings/registry';
import { describe, expect, it } from 'vitest';

describe('tools settings group', () => {
  it('is an ungated group node with no defs of its own', () => {
    const group = getCategory('tools');
    expect(group?.parent).toBeUndefined();
    expect(group?.renderPane).toBeDefined();
    expect(group?.subcategories).toBeUndefined();
    expect(group?.when).toBeUndefined();
    expect(group?.teaserWhenUnavailable).toBeUndefined();
    expect(byCategory('tools')).toHaveLength(0);
  });

  it('terminal, traffic and the mcp server are its children, each desktop-gated with a teaser', () => {
    const children = allCategories().filter((c) => c.parent === 'tools');
    expect(children.map((c) => c.id)).toEqual(['terminal', 'trafficMonitor', 'mcp']);
    for (const child of children) {
      expect(child.navLabelKey).toBeTruthy();
      expect(child.when).toBeDefined();
      expect(child.teaserWhenUnavailable).toBeDefined();
    }
    expect(byCategory('terminal').length).toBeGreaterThan(0);
  });

  it('the mcp group keeps its own children one level deeper', () => {
    const ordered = allCategories().map((c) => c.id);
    expect(ordered.slice(ordered.indexOf('mcp'), ordered.indexOf('mcp') + 3)).toEqual([
      'mcp',
      'mcpAccess',
      'mcpClients',
    ]);
  });
});
