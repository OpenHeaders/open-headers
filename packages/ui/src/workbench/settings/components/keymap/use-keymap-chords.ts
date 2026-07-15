/**
 * useKeymapChordValues — live chord values over the pane's defs.
 *
 * Subscribes per-key like `useModifiedSettings` (the settings store has
 * no bulk chord subscription): the snapshot is the joined chord values,
 * so the map only rebuilds — and only changes identity — when a binding
 * actually changes. The pane derives both the conflict index and the
 * reverse-lookup match set from this one subscription.
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { get as storeGet, subscribeKey } from '../../store';
import type { SettingDef, SettingKey } from '../../types';

const SEP = ' ';

export function useKeymapChordValues(defs: readonly SettingDef[]): ReadonlyMap<SettingKey, string> {
  const keys = useMemo(() => defs.map((def) => def.key), [defs]);

  const subscribe = useCallback(
    (fn: () => void) => {
      const unsubs = keys.map((key) => subscribeKey(key, fn));
      return () => {
        for (const unsub of unsubs) unsub();
      };
    },
    [keys],
  );
  const getSnapshot = useCallback(
    () =>
      keys
        .map((key) => {
          const value = storeGet(key);
          return typeof value === 'string' ? value : '';
        })
        .join(SEP),
    [keys],
  );
  const joined = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return useMemo(() => {
    const chords = joined.split(SEP);
    const byKey = new Map<SettingKey, string>();
    keys.forEach((key, i) => {
      byKey.set(key, chords[i] ?? '');
    });
    return byKey;
  }, [keys, joined]);
}
