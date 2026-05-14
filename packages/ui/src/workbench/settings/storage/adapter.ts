/**
 * Storage adapter contract for the settings system — Layer 1.
 *
 * The settings store is agnostic about where dict scopes live; it
 * persists through a `DictStorage` implementation. The extension
 * uses `ChromeDictStorage`; tests use an in-memory mock.
 */

/**
 * The scopes a setting may belong to. Discriminated union — every
 * workspace-scoped setting must pick a sub-scope:
 *
 *   - `'user'`                  — per-app-instance user preference. Same
 *                                 value across every workspace and tab.
 *   - `'workspace-taste'`       — per-workspace presentation (compact
 *                                 mode, sidebar variant, etc.). Reads
 *                                 from the global active workspace —
 *                                 even in MWPT per-tab mode (R2a, taste
 *                                 settings stay on the default).
 *   - `'workspace-behavioral'`  — per-workspace behavior whose decisions
 *                                 affect what gets written or applied
 *                                 (e.g. `general.collectionEnvAutoSwitch`).
 *                                 Reads via the per-tab seam — in MWPT
 *                                 per-tab mode follows the tab's bound
 *                                 workspace, otherwise tracks global
 *                                 active.
 *
 * The discriminated union pins BC-MWPT-15: a developer adding a
 * workspace-scoped setting without picking a sub-scope fails the
 * TypeScript build. See `MULTI_WORKSPACE_PER_WINDOW_OR_TAB_DESIGN.md` § 5.3.
 */
export type SettingScope = 'user' | 'workspace-taste' | 'workspace-behavioral';

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
