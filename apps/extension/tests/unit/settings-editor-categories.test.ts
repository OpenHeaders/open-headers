/**
 * Editor settings group — pins the IntelliJ-shaped Editor root: a group
 * node over Code Editor (the former root page, re-keyed `codeEditor`;
 * storage keys untouched). Diff Viewer joins as the second child.
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
    expect(codeEditor?.navLabelKey).toBeTruthy();
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
    expect(diffViewer?.navLabelKey).toBeTruthy();
    expect(diffViewer?.subcategories?.map((s) => s.id)).toEqual(['view']);
    const defs = byCategory('diffViewer');
    expect(defs).toHaveLength(7);
    for (const def of defs) {
      expect(def.key.startsWith('workspaceSharing.importPreviewDiff'), def.key).toBe(true);
      expect(def.subcategory).toBe('view');
    }
    expect(
      allCategories()
        .filter((c) => c.parent === 'editor')
        .map((c) => c.id),
    ).toEqual(['codeEditor', 'diffViewer']);
  });

  it('workspace sharing keeps the merge-strategy row and points at the diff viewer instead of carrying it', () => {
    const sharing = getCategory('workspaceSharing');
    expect(sharing?.subcategories?.map((s) => s.id)).toEqual(['importPreview']);
    const keys = byCategory('workspaceSharing').map((d) => d.key);
    expect(keys).toEqual(['workspaceSharing.importPreviewShowMergeStrategy', 'workspaceSharing.diffViewerHome']);
    expect(getDef('workspaceSharing.diffViewerHome')?.customEditor).toBeDefined();
    expect(getDef('workspaceSharing.importPreviewDiffViewer')?.category).toBe('diffViewer');
  });
});
