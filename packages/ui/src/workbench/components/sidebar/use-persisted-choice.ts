/**
 * Persisted string-union preference for the sidebar's ⋯ Options menu —
 * the sort mode. The enum sibling of `usePersistedFlag`: backed by
 * `localStorage` under `oh.sidebar.<name>`, browser-local and never
 * synced, failure-soft (a storage exception or an unknown stored
 * value falls back to the default).
 */

import { useCallback, useState } from 'react';

function storageKey(name: string): string {
  return `oh.sidebar.${name}`;
}

function readPersisted<T extends string>(name: string, values: ReadonlyArray<T>, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(storageKey(name));
    const hit = values.find((value) => value === raw);
    if (hit !== undefined) return hit;
  } catch {
    // ignore — private mode / locked storage
  }
  return fallback;
}

function writePersisted(name: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(storageKey(name), value);
  } catch {
    // ignore
  }
}

export function usePersistedChoice<T extends string>(
  name: string,
  values: ReadonlyArray<T>,
  fallback: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => readPersisted(name, values, fallback));

  const set = useCallback(
    (next: T) => {
      setValue((prev) => {
        if (next !== prev) writePersisted(name, next);
        return next;
      });
    },
    [name],
  );

  return [value, set];
}
