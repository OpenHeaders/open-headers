/**
 * Settings search › result grouping — matched settings bucket by
 * category in the nav's order, and a row limit cuts the list without
 * losing a group's heading.
 */

import { groupByCategory, takeRows } from '@openheaders/ui/workbench/settings/search/group';
import type { CategoryDef, SettingDef } from '@openheaders/ui/workbench/settings/types';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'group.a1': boolean;
    'group.a2': boolean;
    'group.b1': boolean;
    'group.b2': boolean;
    'group.b3': boolean;
    'group.orphan': boolean;
  }
}

type GroupKey = 'group.a1' | 'group.a2' | 'group.b1' | 'group.b2' | 'group.b3' | 'group.orphan';

function makeCategory(id: string, order: number): CategoryDef {
  return { id, label: id, icon: null, order };
}

function makeDef(key: GroupKey, category: string): SettingDef {
  return {
    key,
    type: 'boolean',
    default: false,
    schema: v.boolean(),
    label: key,
    description: '',
    category,
    scope: 'user',
  };
}

const alpha = makeCategory('alpha', 10);
const beta = makeCategory('beta', 20);

// Match order (by score), deliberately not category order.
const matched = [
  makeDef('group.b1', 'beta'),
  makeDef('group.a1', 'alpha'),
  makeDef('group.b2', 'beta'),
  makeDef('group.orphan', 'unregistered'),
  makeDef('group.a2', 'alpha'),
  makeDef('group.b3', 'beta'),
];

const keys = (groups: ReturnType<typeof groupByCategory>): string[][] =>
  groups.map((group) => group.defs.map((def) => def.key));

describe('groupByCategory', () => {
  it('orders groups as the categories are ordered and keeps match order inside each', () => {
    const groups = groupByCategory(matched, [alpha, beta]);
    expect(groups.map((group) => group.category.id)).toEqual(['alpha', 'beta']);
    expect(keys(groups)).toEqual([
      ['group.a1', 'group.a2'],
      ['group.b1', 'group.b2', 'group.b3'],
    ]);
  });

  it('leaves out a category with no match and a setting whose category is not listed', () => {
    const groups = groupByCategory(matched, [makeCategory('empty', 5), beta]);
    expect(groups.map((group) => group.category.id)).toEqual(['beta']);
  });
});

describe('takeRows', () => {
  const groups = groupByCategory(matched, [alpha, beta]);

  it('cuts inside a group, keeping the group it cut', () => {
    expect(keys(takeRows(groups, 3))).toEqual([['group.a1', 'group.a2'], ['group.b1']]);
  });

  it('stops at a group boundary without an empty trailing group', () => {
    expect(keys(takeRows(groups, 2))).toEqual([['group.a1', 'group.a2']]);
  });

  it('returns every row when the limit covers the list', () => {
    expect(keys(takeRows(groups, 50))).toEqual(keys(groups));
  });

  it('returns nothing for a zero limit', () => {
    expect(takeRows(groups, 0)).toEqual([]);
  });
});
