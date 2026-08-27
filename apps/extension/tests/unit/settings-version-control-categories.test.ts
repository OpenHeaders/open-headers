/**
 * Version Control settings group — pins the regroup of the Git group
 * (desktop, teasered) and Workspace Sharing (every host) under one
 * all-host group node; Git keeps its own children one level deeper.
 */

import '@openheaders/ui/workbench/settings/categories';
import '@openheaders/ui/workbench/settings/schema/workspace-sharing';
import { allCategories, byCategory, getCategory } from '@openheaders/ui/workbench/settings/registry';
import { describe, expect, it } from 'vitest';

describe('version control settings group', () => {
  it('is an all-host group node with no defs of its own', () => {
    const group = getCategory('versionControl');
    expect(group?.parent).toBeUndefined();
    expect(group?.renderPane).toBeDefined();
    expect(group?.subcategories).toBeUndefined();
    expect(group?.when).toBeUndefined();
    expect(group?.teaserWhenUnavailable).toBeUndefined();
    expect(byCategory('versionControl')).toHaveLength(0);
  });

  it('git then workspace sharing are its children, with short nav labels', () => {
    const children = allCategories()
      .filter((c) => c.parent === 'versionControl')
      .map((c) => c.id);
    expect(children).toEqual(['git', 'workspaceSharing']);
    for (const id of children) expect(getCategory(id)?.labelKey).toBeTruthy();
    expect(byCategory('workspaceSharing').length).toBeGreaterThan(0);
  });

  it('git keeps its teaser and its own children one level deeper', () => {
    expect(getCategory('git')?.teaserWhenUnavailable).toBe('git');
    const ordered = allCategories().map((c) => c.id);
    expect(ordered.slice(ordered.indexOf('git'), ordered.indexOf('git') + 3)).toEqual([
      'git',
      'gitFolder',
      'gitAutomation',
    ]);
  });
});
