/**
 * SW master-switch wiring — `installCdpMasterSwitch`.
 *
 * The single effector for `inspection.cdpEnabled`. Pins the seed-then-
 * subscribe contract the reconciler relies on:
 *   - a persisted-ON value seeds `setCdpEnabled(true)` at boot (so a tab
 *     with DevTools already open at SW-start attaches without a toggle);
 *   - subsequent changes drive `setCdpEnabled` with the new value;
 *   - a write from another context (popup / panel) propagates through
 *     storage and fires the same path in this worker.
 */

import '@openheaders/ui/workbench/settings/schema/inspection';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
  set as storeSet,
} from '@openheaders/ui/workbench/settings/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installCdpMasterSwitch } from '@/background/bootstrap/cdp-master-switch';

class MemoryDictStorage implements DictStorage {
  state = new Map<SettingScope, Record<string, unknown>>();
  private listeners = new Map<SettingScope, Set<(values: Record<string, unknown>) => void>>();

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

let memory: MemoryDictStorage;

beforeEach(() => {
  __resetStoreForTests();
  memory = new MemoryDictStorage();
  configureSettingsStorage(memory);
});

afterEach(() => {
  __resetStoreForTests();
});

describe('installCdpMasterSwitch', () => {
  it('seeds with the persisted value at boot', async () => {
    memory.state.set('user', { 'inspection.cdpEnabled': true });
    await initSettingsStore();

    const setCdpEnabled = vi.fn();
    installCdpMasterSwitch(setCdpEnabled);

    expect(setCdpEnabled).toHaveBeenCalledWith(true);
  });

  it('seeds with the default OFF when nothing is persisted', async () => {
    await initSettingsStore();

    const setCdpEnabled = vi.fn();
    installCdpMasterSwitch(setCdpEnabled);

    expect(setCdpEnabled).toHaveBeenCalledWith(false);
  });

  it('drives setCdpEnabled on every change', async () => {
    await initSettingsStore();
    const setCdpEnabled = vi.fn();
    installCdpMasterSwitch(setCdpEnabled);
    setCdpEnabled.mockClear();

    storeSet('inspection.cdpEnabled', true);
    expect(setCdpEnabled).toHaveBeenLastCalledWith(true);

    storeSet('inspection.cdpEnabled', false);
    expect(setCdpEnabled).toHaveBeenLastCalledWith(false);
  });

  it('reacts to a cross-context write through storage propagation', async () => {
    await initSettingsStore();
    const setCdpEnabled = vi.fn();
    installCdpMasterSwitch(setCdpEnabled);
    setCdpEnabled.mockClear();

    // Simulate a popup / panel writing the same chrome.storage-backed key.
    await memory.save('user', { 'inspection.cdpEnabled': true });

    expect(setCdpEnabled).toHaveBeenLastCalledWith(true);
  });

  it('stops driving after unsubscribe', async () => {
    await initSettingsStore();
    const setCdpEnabled = vi.fn();
    const unsubscribe = installCdpMasterSwitch(setCdpEnabled);
    setCdpEnabled.mockClear();

    unsubscribe();
    storeSet('inspection.cdpEnabled', true);

    expect(setCdpEnabled).not.toHaveBeenCalled();
  });
});
