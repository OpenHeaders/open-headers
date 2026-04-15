/**
 * Extension-side settings storage backend.
 *
 * `ChromeDictStorage` persists one chrome.storage.local key per scope,
 * holding the entire scope's setting dict. Cross-context updates
 * (popup ↔ workspace) flow through `storage.onChanged`.
 */

import { storage } from '@utils/browser-api';
import type { DictStorage, SettingScope, StorageUnsubscribe } from './adapter';

const SCOPE_KEYS: Record<SettingScope, string> = {
  user: 'settings.user',
  workspace: 'settings.workspace',
  collection: 'settings.collection',
};

function storageGet<T = unknown>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    storage.local.get([key], (result) => {
      resolve(result[key] as T | undefined);
    });
  });
}

function storageSet(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    storage.local.set(items, () => resolve());
  });
}

export class ChromeDictStorage implements DictStorage {
  async load(scope: SettingScope): Promise<Record<string, unknown>> {
    const key = SCOPE_KEYS[scope];
    const raw = await storageGet<Record<string, unknown>>(key);
    return raw ?? {};
  }

  async save(scope: SettingScope, values: Record<string, unknown>): Promise<void> {
    const key = SCOPE_KEYS[scope];
    await storageSet({ [key]: values });
  }

  subscribe(scope: SettingScope, fn: (values: Record<string, unknown>) => void): StorageUnsubscribe {
    const key = SCOPE_KEYS[scope];
    const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string): void => {
      if (areaName !== 'local') return;
      const change = changes[key];
      if (!change) return;
      fn((change.newValue as Record<string, unknown> | undefined) ?? {});
    };
    storage.onChanged.addListener(listener);
    return () => storage.onChanged.removeListener(listener);
  }
}
