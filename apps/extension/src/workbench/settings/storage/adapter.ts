/**
 * Storage adapter contract for the settings system — Layer 1.
 *
 * The settings store is agnostic about where dict scopes live; it
 * persists through a `DictStorage` implementation. The extension
 * uses `ChromeDictStorage`; desktop will later provide an IPC-backed
 * variant; tests use an in-memory mock.
 */

/**
 * The three scopes a setting may belong to. The extension only uses
 * `user` today — `workspace` and `collection` exist so schemas declared
 * now stay forward-compatible with the desktop port.
 */
export type SettingScope = 'user' | 'workspace' | 'collection';

export type StorageUnsubscribe = () => void;

/**
 * Per-scope dict adapter. Reads and writes entire scopes at once; the
 * store handles splitting the dict into per-key updates.
 */
export interface DictStorage {
  load(scope: SettingScope): Promise<Record<string, unknown>>;
  save(scope: SettingScope, values: Record<string, unknown>): Promise<void>;
  subscribe(scope: SettingScope, fn: (values: Record<string, unknown>) => void): StorageUnsubscribe;
}
