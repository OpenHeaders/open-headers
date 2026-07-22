/**
 * Settings managed lock — the `chrome.storage.managed` policy plane in
 * the settings store. Asserts:
 *   - a key present in the managed dict serves the policy value over
 *     the user's persisted one, for every reader
 *   - writes to a managed key are refused; `isModified` reads false and
 *     `resetAll` skips it
 *   - a malformed policy value is ignored (schema-validated like any
 *     persisted value)
 *   - a live managed-dict change locks/unlocks keys and notifies
 */

import { __resetRegistryForTests, registerSetting } from '@openheaders/ui/workbench/settings/registry';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
  isManaged,
  isModified,
  resetAll,
  get as storeGet,
  set as storeSet,
  subscribeKey,
} from '@openheaders/ui/workbench/settings/store';
import * as v from 'valibot';
import { beforeEach, describe, expect, it } from 'vitest';

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'managedtest.locked': boolean;
    'managedtest.free': boolean;
  }
}

class ManagedMemoryStorage implements DictStorage {
  state = new Map<SettingScope, Record<string, unknown>>();
  managed: Record<string, unknown> = {};
  managedListener: ((values: Record<string, unknown>) => void) | null = null;

  async load(scope: SettingScope): Promise<Record<string, unknown>> {
    return { ...(this.state.get(scope) ?? {}) };
  }

  async save(scope: SettingScope, values: Record<string, unknown>): Promise<void> {
    this.state.set(scope, { ...values });
  }

  subscribe(): () => void {
    return () => {};
  }

  async loadManaged(): Promise<Record<string, unknown>> {
    return { ...this.managed };
  }

  subscribeManaged(fn: (values: Record<string, unknown>) => void): () => void {
    this.managedListener = fn;
    return () => {
      this.managedListener = null;
    };
  }

  pushManaged(values: Record<string, unknown>): void {
    this.managed = { ...values };
    this.managedListener?.(this.loadManagedSync());
  }

  private loadManagedSync(): Record<string, unknown> {
    return { ...this.managed };
  }
}

function registerKeys(): void {
  registerSetting({
    key: 'managedtest.locked',
    type: 'boolean',
    default: true,
    schema: v.boolean(),
    label: 'Locked',
    description: '',
    category: 'managedtest',
    scope: 'user',
  });
  registerSetting({
    key: 'managedtest.free',
    type: 'boolean',
    default: true,
    schema: v.boolean(),
    label: 'Free',
    description: '',
    category: 'managedtest',
    scope: 'user',
  });
}

describe('settings managed lock', () => {
  let storage: ManagedMemoryStorage;

  beforeEach(() => {
    __resetStoreForTests();
    __resetRegistryForTests();
    storage = new ManagedMemoryStorage();
    configureSettingsStorage(storage);
    registerKeys();
  });

  it('serves the policy value over the persisted one and refuses writes', async () => {
    storage.state.set('user', { 'managedtest.locked': true });
    storage.managed = { 'managedtest.locked': false };
    await initSettingsStore();

    expect(isManaged('managedtest.locked')).toBe(true);
    expect(storeGet('managedtest.locked')).toBe(false);

    storeSet('managedtest.locked', true);
    expect(storeGet('managedtest.locked')).toBe(false);
  });

  it('managed keys never read modified and resetAll skips them', async () => {
    // The persisted user value differs from the default — normally a
    // "modified" dot + reset candidate; the lock suppresses both.
    storage.state.set('user', { 'managedtest.locked': false, 'managedtest.free': false });
    storage.managed = { 'managedtest.locked': false };
    await initSettingsStore();

    expect(isModified('managedtest.locked')).toBe(false);
    expect(isModified('managedtest.free')).toBe(true);
    expect(resetAll()).toBe(1);
    expect(storeGet('managedtest.free')).toBe(true);
    expect(storeGet('managedtest.locked')).toBe(false);
  });

  it('ignores a malformed policy value instead of locking to garbage', async () => {
    storage.managed = { 'managedtest.locked': 'not-a-boolean' };
    await initSettingsStore();

    expect(isManaged('managedtest.locked')).toBe(false);
    expect(storeGet('managedtest.locked')).toBe(true);
  });

  it('a live policy change locks, unlocks, and notifies the key', async () => {
    await initSettingsStore();
    expect(isManaged('managedtest.locked')).toBe(false);

    let notified = 0;
    const unsubscribe = subscribeKey('managedtest.locked', () => {
      notified++;
    });

    storage.pushManaged({ 'managedtest.locked': false });
    expect(isManaged('managedtest.locked')).toBe(true);
    expect(storeGet('managedtest.locked')).toBe(false);
    expect(notified).toBeGreaterThan(0);

    storage.pushManaged({});
    expect(isManaged('managedtest.locked')).toBe(false);
    expect(storeGet('managedtest.locked')).toBe(true);
    unsubscribe();
  });
});
