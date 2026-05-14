import {
  __resetRegistryForTests,
  allCategories,
  allDefaults,
  allDefs,
  byCategory,
  getCategory,
  getDef,
  registerCategory,
  registerSetting,
  requireDef,
} from '@openheaders/ui/workbench/settings/registry';
import * as v from 'valibot';
import { beforeEach, describe, expect, it } from 'vitest';

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'test.one': string;
    'test.two': number;
    'test.three': boolean;
  }
}

describe('settings registry', () => {
  beforeEach(() => {
    __resetRegistryForTests();
  });

  it('registers and retrieves settings by key', () => {
    registerSetting({
      key: 'test.one',
      type: 'string',
      default: 'hello',
      schema: v.string(),
      label: 'One',
      description: 'first',
      category: 'test',
      scope: 'user',
    });
    const def = getDef('test.one');
    expect(def?.label).toBe('One');
    expect(allDefs()).toHaveLength(1);
  });

  it('requireDef throws when a key is missing', () => {
    expect(() => requireDef('test.one')).toThrow(/no definition/);
  });

  it('byCategory filters by category id', () => {
    registerSetting({
      key: 'test.one',
      type: 'string',
      default: 'x',
      schema: v.string(),
      label: 'One',
      description: '',
      category: 'a',
      scope: 'user',
    });
    registerSetting({
      key: 'test.two',
      type: 'number',
      default: 1,
      schema: v.number(),
      label: 'Two',
      description: '',
      category: 'b',
      scope: 'user',
    });
    expect(byCategory('a')).toHaveLength(1);
    expect(byCategory('b')).toHaveLength(1);
    expect(byCategory('missing')).toHaveLength(0);
  });

  it('allCategories sorts by order', () => {
    registerCategory({ id: 'z', label: 'Z', icon: null, order: 100 });
    registerCategory({ id: 'a', label: 'A', icon: null, order: 1 });
    registerCategory({ id: 'm', label: 'M', icon: null, order: 50 });
    const cats = allCategories();
    expect(cats.map((c) => c.id)).toEqual(['a', 'm', 'z']);
  });

  it('getCategory returns one category by id', () => {
    registerCategory({ id: 'appearance', label: 'Appearance', icon: null, order: 10 });
    expect(getCategory('appearance')?.label).toBe('Appearance');
    expect(getCategory('nope')).toBeUndefined();
  });

  it('allDefaults returns a key → default dict', () => {
    registerSetting({
      key: 'test.one',
      type: 'string',
      default: 'alpha',
      schema: v.string(),
      label: 'One',
      description: '',
      category: 'test',
      scope: 'user',
    });
    registerSetting({
      key: 'test.three',
      type: 'boolean',
      default: true,
      schema: v.boolean(),
      label: 'Three',
      description: '',
      category: 'test',
      scope: 'user',
    });
    const defaults = allDefaults();
    expect(defaults).toEqual({ 'test.one': 'alpha', 'test.three': true });
  });

  it('re-registration overwrites the earlier def', () => {
    registerSetting({
      key: 'test.one',
      type: 'string',
      default: 'first',
      schema: v.string(),
      label: 'First',
      description: '',
      category: 'test',
      scope: 'user',
    });
    registerSetting({
      key: 'test.one',
      type: 'string',
      default: 'second',
      schema: v.string(),
      label: 'Second',
      description: '',
      category: 'test',
      scope: 'user',
    });
    expect(getDef('test.one')?.label).toBe('Second');
  });
});
