import * as v from 'valibot';
import { beforeEach, describe, expect, it } from 'vitest';
import { __resetRegistryForTests, registerCategory, registerSetting } from '@/workbench/settings/registry';
import { searchSettings } from '@/workbench/settings/search';
import type { DictStorage, SettingScope } from '@/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
  set as storeSet,
} from '@/workbench/settings/store';

declare module '@/workbench/settings/types' {
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
    description: 'Enable the new rule engine.',
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

  it('@experimental filter restricts to experimental defs', () => {
    const results = searchSettings('@experimental');
    expect(results).toHaveLength(1);
    expect(results[0].def.key).toBe('search.experimentalFlag');
  });

  it('@modified filter restricts to modified defs', () => {
    storeSet('search.density', 'compact');
    const results = searchSettings('@modified');
    expect(results).toHaveLength(1);
    expect(results[0].def.key).toBe('search.density');
  });

  it('label matches outrank description matches', () => {
    // Label "Color Theme" should beat description match on the word "theme"
    const results = searchSettings('theme');
    const sorted = [...results].sort((a, b) => b.score - a.score);
    expect(sorted[0].def.key).toBe('search.theme');
  });
});
