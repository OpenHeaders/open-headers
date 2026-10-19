/**
 * The settings store as one plain dict — every persisted definition's
 * current value, action and info rows left out. The shape "Export
 * Settings" writes and "Import Settings" reads back, and the
 * `settings.json` the diagnostic bundle carries.
 */

import { allDefs } from './registry';
import { get as getStoreValue } from './store';
import type { SettingKey } from './types';

export function isPersistedSetting(type: string): boolean {
  return type !== 'action' && type !== 'info';
}

export function snapshotSettings(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const def of allDefs()) {
    if (!isPersistedSetting(def.type)) continue;
    out[def.key] = getStoreValue(def.key as SettingKey);
  }
  return out;
}
