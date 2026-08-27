/**
 * Editor settings group — pins the IntelliJ-shaped Editor root: a group
 * node over Code Editor (the former root page, re-keyed `codeEditor`;
 * storage keys untouched). Diff Viewer joins as the second child.
 */

import '@openheaders/ui/workbench/settings/categories';
import '@openheaders/ui/workbench/settings/schema/editor';
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
});
