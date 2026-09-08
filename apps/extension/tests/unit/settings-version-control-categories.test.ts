/**
 * Version Control settings group — pins the all-host group node over the
 * Git group alone (desktop, teasered elsewhere), which keeps its own
 * children one level deeper. The import-preview rows that once sat here
 * as Workspace Sharing live on Editor › Diff Viewer.
 */

import '@openheaders/ui/workbench/settings/categories';
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

  it('git is its only child, with a short nav label; workspace sharing is gone', () => {
    const children = allCategories()
      .filter((c) => c.parent === 'versionControl')
      .map((c) => c.id);
    expect(children).toEqual(['git']);
    for (const id of children) expect(getCategory(id)?.labelKey).toBeTruthy();
    expect(getCategory('workspaceSharing')).toBeUndefined();
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
