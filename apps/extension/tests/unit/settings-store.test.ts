import { hasCapability, registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import { __resetRegistryForTests, registerSetting } from '@openheaders/ui/workbench/settings/registry';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
  isModified,
  get as storeGet,
  reset as storeReset,
  set as storeSet,
  subscribeKey,
} from '@openheaders/ui/workbench/settings/store';
import * as v from 'valibot';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'store.name': string;
    'store.count': number;
    'store.flag': boolean;
    'store.gated': boolean;
  }
}

// ── In-memory dict storage for isolated tests ────────────────────────

class MemoryDictStorage implements DictStorage {
  state = new Map<SettingScope, Record<string, unknown>>();
  listeners = new Map<SettingScope, Set<(values: Record<string, unknown>) => void>>();

  async load(scope: SettingScope): Promise<Record<string, unknown>> {
    return { ...(this.state.get(scope) ?? {}) };
  }

  async save(scope: SettingScope, values: Record<string, unknown>): Promise<void> {
    this.state.set(scope, { ...values });
    const set = this.listeners.get(scope);
    if (set) for (const fn of set) fn({ ...values });
  }

  subscribe(scope: SettingScope, fn: (values: Record<string, unknown>) => void): () => void {
    let set = this.listeners.get(scope);
    if (!set) {
      set = new Set();
      this.listeners.set(scope, set);
    }
    set.add(fn);
    return () => set?.delete(fn);
  }
}

// ── Test setup ───────────────────────────────────────────────────────

let memory: MemoryDictStorage;

function registerTestSchema(): void {
  registerSetting({
    key: 'store.name',
    type: 'string',
    default: 'default-name',
    schema: v.string(),
    label: 'Name',
    description: '',
    category: 'store-test',
    scope: 'user',
  });
  registerSetting({
    key: 'store.count',
    type: 'number',
    default: 0,
    schema: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
    label: 'Count',
    description: '',
    category: 'store-test',
    scope: 'user',
  });
  registerSetting({
    key: 'store.flag',
    type: 'boolean',
    default: false,
    schema: v.boolean(),
    label: 'Flag',
    description: '',
    category: 'store-test',
    scope: 'user',
  });
  // Capability-gated boolean: ON by default only where the host
  // registered `cdpInspection`; elsewhere it reads its host-aware
  // default regardless of any persisted value.
  registerSetting({
    key: 'store.gated',
    type: 'boolean',
    default: true,
    getDefault: () => hasCapability('cdpInspection'),
    schema: v.boolean(),
    label: 'Gated',
    description: '',
    category: 'store-test',
    scope: 'user',
    requiresCapability: 'cdpInspection',
  });
}

beforeEach(() => {
  __resetStoreForTests();
  __resetRegistryForTests();
  memory = new MemoryDictStorage();
  configureSettingsStorage(memory);
  registerTestSchema();
});

afterEach(() => {
  unregisterCapability('cdpInspection');
  vi.useRealTimers();
});

describe('settings store', () => {
  it('seeds defaults for every registered key on init', async () => {
    await initSettingsStore();
    expect(storeGet('store.name')).toBe('default-name');
    expect(storeGet('store.count')).toBe(0);
    expect(storeGet('store.flag')).toBe(false);
  });

  it('loads persisted values from dict storage', async () => {
    memory.state.set('user', { 'store.name': 'persisted', 'store.count': 42 });
    await initSettingsStore();
    expect(storeGet('store.name')).toBe('persisted');
    expect(storeGet('store.count')).toBe(42);
  });

  it('rejects invalid values against the valibot schema', async () => {
    await initSettingsStore();
    storeSet('store.count', 500);
    expect(storeGet('store.count')).toBe(0);
  });

  it('marks values as modified when they diverge from default', async () => {
    await initSettingsStore();
    expect(isModified('store.name')).toBe(false);
    storeSet('store.name', 'changed');
    expect(isModified('store.name')).toBe(true);
    storeSet('store.name', 'default-name');
    expect(isModified('store.name')).toBe(false);
  });

  it('reset returns a value to its registered default', async () => {
    await initSettingsStore();
    storeSet('store.count', 7);
    expect(storeGet('store.count')).toBe(7);
    storeReset('store.count');
    expect(storeGet('store.count')).toBe(0);
  });

  it('per-key subscribers only fire on their key', async () => {
    await initSettingsStore();
    const nameSpy = vi.fn();
    const countSpy = vi.fn();
    subscribeKey('store.name', nameSpy);
    subscribeKey('store.count', countSpy);
    storeSet('store.count', 5);
    expect(nameSpy).not.toHaveBeenCalled();
    expect(countSpy).toHaveBeenCalledTimes(1);
  });

  it('debounced dict writes flush after 150ms', async () => {
    vi.useFakeTimers();
    await initSettingsStore();
    storeSet('store.name', 'one');
    storeSet('store.name', 'two');
    storeSet('store.name', 'three');
    expect(memory.state.get('user')?.['store.name']).toBeUndefined();
    await vi.advanceTimersByTimeAsync(200);
    expect(memory.state.get('user')?.['store.name']).toBe('three');
  });

  it('cross-context updates propagate through dict subscribe', async () => {
    await initSettingsStore();
    const spy = vi.fn();
    subscribeKey('store.name', spy);
    // Simulate another context writing through the same storage:
    await memory.save('user', { 'store.name': 'from-other-context' });
    expect(storeGet('store.name')).toBe('from-other-context');
    expect(spy).toHaveBeenCalled();
  });

  describe('capability-gated settings', () => {
    it('reads the host-aware default, ignoring any persisted value, when the capability is absent', async () => {
      // Host without `cdpInspection` (Firefox / Safari): a stale persisted
      // ON must not leak through — the value reads as its default OFF.
      memory.state.set('user', { 'store.gated': true });
      await initSettingsStore();

      expect(storeGet('store.gated')).toBe(false);
      expect(isModified('store.gated')).toBe(false);
    });

    it('reads the persisted value when the host has the capability', async () => {
      registerCapability('cdpInspection', () => true);
      memory.state.set('user', { 'store.gated': false });
      await initSettingsStore();

      expect(storeGet('store.gated')).toBe(false);
      // Default is ON where supported, so a persisted OFF is a real change.
      expect(isModified('store.gated')).toBe(true);
    });
  });
});
