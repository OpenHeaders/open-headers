/**
 * React hooks over the settings store.
 *
 * Built on `useSyncExternalStore` so each hook only re-renders when
 * the specific key it reads changes — a component that subscribes to
 * `appearance.theme` does not re-render when `appearance.density`
 * moves.
 */

import { useCallback, useSyncExternalStore } from 'react';
import { allDefs } from './registry';
import {
  get as storeGet,
  isModified as storeIsModified,
  isReady as storeIsReady,
  reset as storeReset,
  resetAll as storeResetAll,
  set as storeSet,
  subscribeAll,
  subscribeKey,
} from './store';
import type { SettingKey, SettingsMap } from './types';

/**
 * Read + write one setting. Mirrors `useState`'s shape so migrating
 * local state to a setting is a one-line change.
 */
export function useSetting<K extends SettingKey>(key: K): [SettingsMap[K], (value: SettingsMap[K]) => void] {
  const subscribe = useCallback((fn: () => void) => subscribeKey(key, fn), [key]);
  const getSnapshot = useCallback(() => storeGet(key), [key]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setValue = useCallback((next: SettingsMap[K]) => storeSet(key, next), [key]);
  return [value, setValue];
}

/** Read-only variant — skips the setter when the caller only needs the value. */
export function useSettingValue<K extends SettingKey>(key: K): SettingsMap[K] {
  const subscribe = useCallback((fn: () => void) => subscribeKey(key, fn), [key]);
  const getSnapshot = useCallback(() => storeGet(key), [key]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Whether the value for `key` differs from its registered default. */
export function useIsModified<K extends SettingKey>(key: K): boolean {
  const subscribe = useCallback((fn: () => void) => subscribeKey(key, fn), [key]);
  const getSnapshot = useCallback(() => storeIsModified(key), [key]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Reset `key` to its registered default. */
export function useResetSetting<K extends SettingKey>(key: K): () => void {
  return useCallback(() => storeReset(key), [key]);
}

/** Reset every modified setting back to its registered default. Returns how many were reset. */
export function useResetAllSettings(): () => number {
  return useCallback(() => storeResetAll(), []);
}

/** Live count of settings whose value differs from their registered default. */
export function useModifiedCount(): number {
  const getSnapshot = useCallback(() => {
    let n = 0;
    for (const def of allDefs()) if (storeIsModified(def.key)) n++;
    return n;
  }, []);
  return useSyncExternalStore(subscribeAll, getSnapshot, getSnapshot);
}

/**
 * Subscribe to readiness. Returns `true` after `initSettingsStore`
 * resolves. Components that render settings UI wait on this before
 * first paint so defaults don't flash.
 */
export function useSettingsReady(): boolean {
  return useSyncExternalStore(subscribeAll, storeIsReady, storeIsReady);
}

/**
 * Untyped read + write for field components. Field primitives are
 * dispatched by `SettingType`, not by `SettingKey`, so they can't
 * statically assert the value type — the SettingType → runtime-type
 * contract is enforced by the schema registration. Returns `unknown`;
 * the field component narrows via a field-specific cast at the
 * Ant control boundary. Typed call sites keep using `useSetting<K>`.
 */
export function useUntypedSetting(key: string): [unknown, (value: unknown) => void] {
  const subscribe = useCallback((fn: () => void) => subscribeKey(key as SettingKey, fn), [key]);
  const getSnapshot = useCallback(() => storeGet(key as SettingKey), [key]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setValue = useCallback((next: unknown) => storeSet(key as SettingKey, next as SettingsMap[SettingKey]), [key]);
  return [value, setValue];
}
