/**
 * Group/filter derivation for the Keymap pane.
 *
 * Groups follow the category's subcategory order; the plain-text
 * filter matches labels, descriptions, and setting keys, and drops
 * groups it empties.
 */

import { buildKeymapGroups } from '@openheaders/ui/workbench/settings/components/keymap/keymap-groups';
import { translateEnglish } from '@openheaders/ui/workbench/settings/localize';
import type { CategoryDef, SettingDef } from '@openheaders/ui/workbench/settings/types';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'kmtest.save': string;
    'kmtest.closeTab': string;
    'kmtest.orphan': string;
  }
}

const category: CategoryDef = {
  id: 'kmtest',
  label: 'Keyboard',
  icon: null,
  order: 1,
  subcategories: [
    { id: 'tabs', label: 'Tabs', order: 20 },
    { id: 'general', label: 'General', order: 10 },
  ],
};

const closeTabDef: SettingDef<'kmtest.closeTab'> = {
  key: 'kmtest.closeTab',
  type: 'keybinding',
  default: 'alt+w',
  schema: v.string(),
  label: 'Close Tab',
  description: 'Close the active tab.',
  category: 'kmtest',
  subcategory: 'tabs',
  scope: 'user',
};

const saveDef: SettingDef<'kmtest.save'> = {
  key: 'kmtest.save',
  type: 'keybinding',
  default: 'mod+s',
  schema: v.string(),
  label: 'Save',
  description: 'Persist the active editor.',
  category: 'kmtest',
  subcategory: 'general',
  scope: 'user',
};

const orphanDef: SettingDef<'kmtest.orphan'> = {
  key: 'kmtest.orphan',
  type: 'keybinding',
  default: '',
  schema: v.string(),
  label: 'Orphan',
  description: 'No subcategory declared.',
  category: 'kmtest',
  subcategory: 'missing',
  scope: 'user',
};

const defs: readonly SettingDef[] = [closeTabDef, saveDef, orphanDef];

describe('buildKeymapGroups', () => {
  it('groups by subcategory in declared order, orphans first', () => {
    const groups = buildKeymapGroups(category, defs, '', translateEnglish);
    expect(groups.map((g) => g.sub?.id ?? null)).toEqual([null, 'general', 'tabs']);
    expect(groups[1]?.defs.map((d) => d.key)).toEqual(['kmtest.save']);
    expect(groups[2]?.defs.map((d) => d.key)).toEqual(['kmtest.closeTab']);
  });

  it('filters by label case-insensitively and drops emptied groups', () => {
    const groups = buildKeymapGroups(category, defs, 'close', translateEnglish);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.sub?.id).toBe('tabs');
  });

  it('matches descriptions and setting keys too', () => {
    expect(buildKeymapGroups(category, defs, 'persist', translateEnglish)).toHaveLength(1);
    expect(buildKeymapGroups(category, defs, 'kmtest.orphan', translateEnglish)[0]?.defs[0]?.key).toBe('kmtest.orphan');
  });

  it('returns no groups when nothing matches', () => {
    expect(buildKeymapGroups(category, defs, 'zzz-no-match', translateEnglish)).toHaveLength(0);
  });
});
