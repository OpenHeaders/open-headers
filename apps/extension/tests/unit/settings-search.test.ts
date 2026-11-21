import {
  __resetRegistryForTests,
  registerCategory,
  registerSetting,
} from '@openheaders/ui/workbench/settings/registry';
import { searchSettings } from '@openheaders/ui/workbench/settings/search';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
  set as storeSet,
} from '@openheaders/ui/workbench/settings/store';
import * as v from 'valibot';
import { beforeEach, describe, expect, it } from 'vitest';

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'search.theme': 'light' | 'dark';
    'search.density': 'compact' | 'cozy';
    'search.experimentalFlag': boolean;
    'search.unrelated': string;
  }
}

class NoopDictStorage implements DictStorage {
  async load(_scope: SettingScope): Promise<Record<string, unknown>> {
    return {};
  }
  async save(): Promise<void> {}
  subscribe(): () => void {
    return () => {};
  }
}

function seed(): void {
  registerCategory({ id: 'appearance', label: 'Appearance', icon: null, order: 10 });
  registerCategory({ id: 'advanced', label: 'Advanced', icon: null, order: 900 });

  registerSetting({
    key: 'search.theme',
    type: 'enum',
    default: 'light',
    schema: v.picklist(['light', 'dark']),
    label: 'Color Theme',
    description: 'The overall color palette of the app.',
    category: 'appearance',
    tags: ['dark mode', 'light mode', 'palette'],
    scope: 'user',
  });
  registerSetting({
    key: 'search.density',
    type: 'enum',
    default: 'cozy',
    schema: v.picklist(['compact', 'cozy']),
    label: 'UI Density',
    description: 'Padding and spacing.',
    category: 'appearance',
    tags: ['compact', 'spacing'],
    scope: 'user',
  });
  registerSetting({
    key: 'search.experimentalFlag',
    type: 'boolean',
    default: false,
    schema: v.boolean(),
    label: 'New Engine',
    description: 'Enable the new (rule) engine; "beta" quality.',
    category: 'advanced',
    scope: 'user',
    experimental: true,
  });
  registerSetting({
    key: 'search.unrelated',
    type: 'string',
    default: 'x',
    schema: v.string(),
    label: 'Unrelated',
    description: 'Just a filler.',
    category: 'advanced',
    scope: 'user',
  });
}

beforeEach(async () => {
  __resetStoreForTests();
  __resetRegistryForTests();
  configureSettingsStorage(new NoopDictStorage());
  seed();
  await initSettingsStore();
});

describe('searchSettings', () => {
  it('returns all defs with score 0 for an empty query', () => {
    const results = searchSettings('');
    expect(results).toHaveLength(4);
    for (const r of results) expect(r.score).toBe(0);
  });

  it('matches on label tokens', () => {
    const results = searchSettings('theme');
    expect(results[0].def.key).toBe('search.theme');
  });

  it('matches on tags', () => {
    const results = searchSettings('dark');
    expect(results[0].def.key).toBe('search.theme');
  });

  it('matches on description', () => {
    const results = searchSettings('palette');
    expect(results.some((r) => r.def.key === 'search.theme')).toBe(true);
  });

  it('matches on category label', () => {
    const results = searchSettings('appearance');
    const keys = results.map((r) => r.def.key);
    expect(keys).toContain('search.theme');
    expect(keys).toContain('search.density');
  });

  it('@modified filter restricts to modified defs', () => {
    storeSet('search.density', 'compact');
    const results = searchSettings('@modified');
    expect(results).toHaveLength(1);
    expect(results[0].def.key).toBe('search.density');
  });

  it('matches a term at the start of a word, never inside one', () => {
    expect(searchSettings('pal').map((r) => r.def.key)).toEqual(['search.theme']);
    // "alette" sits inside "palette", "ensity" inside "density" — in a
    // tag, a description, a label and a key alike.
    expect(searchSettings('alette')).toHaveLength(0);
    expect(searchSettings('ensity')).toHaveLength(0);
  });

  it('matches a word through the punctuation around it — in the text and in the query', () => {
    expect(searchSettings('rule').map((r) => r.def.key)).toEqual(['search.experimentalFlag']);
    expect(searchSettings('beta').map((r) => r.def.key)).toEqual(['search.experimentalFlag']);
    expect(searchSettings('(rule)').map((r) => r.def.key)).toEqual(['search.experimentalFlag']);
  });

  it('finds nothing for a query that names no word, rather than everything', () => {
    expect(searchSettings('+')).toHaveLength(0);
  });

  it('requires every term to match — a term from another setting does not widen the set', () => {
    // "theme" is the theme row's, "spacing" the density row's: no one
    // setting carries both.
    expect(searchSettings('theme spacing')).toHaveLength(0);
    expect(searchSettings('color theme').map((r) => r.def.key)).toEqual(['search.theme']);
  });

  it('never grows the result set as words are added', () => {
    const keysFor = (query: string): string[] => searchSettings(query).map((r) => r.def.key);
    const broad = keysFor('appearance');
    const narrowed = keysFor('appearance p');
    const narrowest = keysFor('appearance p palette');
    expect(broad).toEqual(expect.arrayContaining(narrowed));
    expect(narrowed).toEqual(expect.arrayContaining(narrowest));
    expect(narrowest).toEqual(['search.theme']);
  });

  it('a filter token narrows a text query instead of standing in for a term', () => {
    storeSet('search.density', 'compact');
    expect(searchSettings('appearance @modified').map((r) => r.def.key)).toEqual(['search.density']);
    expect(searchSettings('theme @modified')).toHaveLength(0);
  });

  it('label matches outrank description matches', () => {
    // Label "Color Theme" should beat description match on the word "theme"
    const results = searchSettings('theme');
    const sorted = [...results].sort((a, b) => b.score - a.score);
    expect(sorted[0].def.key).toBe('search.theme');
  });
});
