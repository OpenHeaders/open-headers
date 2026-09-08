/**
 * Editor settings group — pins the IntelliJ-shaped Editor root: a group
 * node over Code Editor (the former root page, re-keyed `codeEditor`;
 * storage keys untouched). Diff Viewer joins as the second child and
 * carries the import preview's own section — every `workspaceSharing.*`
 * def, keys untouched.
 */

import '@openheaders/ui/workbench/settings/categories';
import '@openheaders/ui/workbench/settings/schema/editor';
import '@openheaders/ui/workbench/settings/schema/workspace-sharing';
import { allCategories, byCategory, getCategory, getDef } from '@openheaders/ui/workbench/settings/registry';
import { describe, expect, it } from 'vitest';

describe('editor settings group', () => {
  it('editor is an ungated group node with no defs of its own', () => {
    const group = getCategory('editor');
    expect(group?.parent).toBeUndefined();
    expect(group?.renderPane).toBeDefined();
    expect(group?.subcategories).toBeUndefined();
    expect(group?.when).toBeUndefined();
    expect(byCategory('editor')).toHaveLength(0);
  });

  it('code editor is its first child and owns every editor.* def under a declared subcategory', () => {
    const codeEditor = getCategory('codeEditor');
    expect(codeEditor?.parent).toBe('editor');
    expect(codeEditor?.labelKey).toBeTruthy();
    expect(codeEditor?.subcategories?.map((s) => s.id)).toEqual([
      'font',
      'indentation',
      'wrapping',
      'display',
      'editing',
    ]);
    const declared = new Set(codeEditor?.subcategories?.map((s) => s.id));
    const defs = byCategory('codeEditor');
    expect(defs.length).toBeGreaterThan(0);
    for (const def of defs) {
      expect(def.key.startsWith('editor.'), def.key).toBe(true);
      expect(declared.has(def.subcategory ?? ''), def.key).toBe(true);
    }
    expect(getDef('editor.fontSize')?.category).toBe('codeEditor');
    expect(allCategories().filter((c) => c.parent === 'editor')[0]?.id).toBe('codeEditor');
  });

  it('diff viewer is its second child and owns the seven importPreviewDiff* defs under view, keys untouched', () => {
    const diffViewer = getCategory('diffViewer');
    expect(diffViewer?.parent).toBe('editor');
    expect(diffViewer?.labelKey).toBeTruthy();
    expect(diffViewer?.subcategories?.map((s) => s.id)).toEqual(['view', 'importPreview']);
    const view = byCategory('diffViewer').filter((d) => d.subcategory === 'view');
    expect(view).toHaveLength(7);
    for (const def of view) {
      expect(def.key.startsWith('workspaceSharing.importPreviewDiff'), def.key).toBe(true);
    }
    expect(
      allCategories()
        .filter((c) => c.parent === 'editor')
        .map((c) => c.id),
    ).toEqual(['codeEditor', 'diffViewer']);
  });

  it('the import preview section carries the merge-strategy row alone; the pointer row is gone', () => {
    const keys = byCategory('diffViewer')
      .filter((d) => d.subcategory === 'importPreview')
      .map((d) => d.key);
    expect(keys).toEqual(['workspaceSharing.importPreviewShowMergeStrategy']);
    expect(getDef('workspaceSharing.diffViewerHome')).toBeUndefined();
    expect(getCategory('workspaceSharing')).toBeUndefined();
    expect(byCategory('diffViewer')).toHaveLength(8);
  });
});
