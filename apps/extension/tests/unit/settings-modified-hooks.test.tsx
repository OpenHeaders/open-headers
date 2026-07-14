import { useModifiedSettings, useResetSettings } from '@openheaders/ui/workbench/settings/hooks';
import { __resetRegistryForTests, registerSetting } from '@openheaders/ui/workbench/settings/registry';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
  set as storeSet,
} from '@openheaders/ui/workbench/settings/store';
import type { SettingKey } from '@openheaders/ui/workbench/settings/types';
import { act, renderHook } from '@testing-library/react';
import * as v from 'valibot';
import { beforeEach, describe, expect, it } from 'vitest';

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'viewmenu.layout': string;
    'viewmenu.showChips': boolean;
    'viewmenu.other': boolean;
  }
}

class MemoryDictStorage implements DictStorage {
  state = new Map<SettingScope, Record<string, unknown>>();

  async load(scope: SettingScope): Promise<Record<string, unknown>> {
    return { ...(this.state.get(scope) ?? {}) };
  }

  async save(scope: SettingScope, values: Record<string, unknown>): Promise<void> {
    this.state.set(scope, { ...values });
  }

  subscribe(): () => void {
    return () => {};
  }
}

const VIEW_KEYS: readonly SettingKey[] = ['viewmenu.layout', 'viewmenu.showChips'];

beforeEach(async () => {
  __resetStoreForTests();
  __resetRegistryForTests();
  configureSettingsStorage(new MemoryDictStorage());
  registerSetting({
    key: 'viewmenu.layout',
    type: 'string',
    default: 'flat',
    schema: v.string(),
    label: 'Layout',
    description: '',
    category: 'viewmenu-test',
    scope: 'user',
  });
  registerSetting({
    key: 'viewmenu.showChips',
    type: 'boolean',
    default: false,
    schema: v.boolean(),
    label: 'Chips',
    description: '',
    category: 'viewmenu-test',
    scope: 'user',
  });
  registerSetting({
    key: 'viewmenu.other',
    type: 'boolean',
    default: false,
    schema: v.boolean(),
    label: 'Other',
    description: '',
    category: 'viewmenu-test',
    scope: 'user',
  });
  await initSettingsStore();
});

describe('useModifiedSettings', () => {
  it('is empty on a clean store — every key sits at its registered default', () => {
    const { result } = renderHook(() => useModifiedSettings(VIEW_KEYS));
    expect(result.current.size).toBe(0);
  });

  it('tracks keys as they diverge from and return to their defaults', () => {
    const { result } = renderHook(() => useModifiedSettings(VIEW_KEYS));

    act(() => storeSet('viewmenu.layout', 'grouped'));
    expect(result.current.has('viewmenu.layout')).toBe(true);
    expect(result.current.size).toBe(1);

    act(() => storeSet('viewmenu.showChips', true));
    expect(result.current.size).toBe(2);

    act(() => storeSet('viewmenu.layout', 'flat'));
    expect(result.current.has('viewmenu.layout')).toBe(false);
    expect(result.current.size).toBe(1);
  });

  it('ignores keys outside the given list', () => {
    const { result } = renderHook(() => useModifiedSettings(VIEW_KEYS));
    act(() => storeSet('viewmenu.other', true));
    expect(result.current.size).toBe(0);
  });
});

describe('useResetSettings', () => {
  it('restores every listed key to its registered default', () => {
    const modified = renderHook(() => useModifiedSettings(VIEW_KEYS));
    const reset = renderHook(() => useResetSettings(VIEW_KEYS));

    act(() => {
      storeSet('viewmenu.layout', 'grouped');
      storeSet('viewmenu.showChips', true);
      storeSet('viewmenu.other', true);
    });
    expect(modified.result.current.size).toBe(2);

    act(() => reset.result.current());
    expect(modified.result.current.size).toBe(0);

    const other = renderHook(() => useModifiedSettings(['viewmenu.other']));
    expect(other.result.current.has('viewmenu.other')).toBe(true);
  });
});
