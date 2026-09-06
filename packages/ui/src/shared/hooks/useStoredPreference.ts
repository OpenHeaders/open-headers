/**
 * createStoredPreference — a browser-local UI preference: ONE value
 * shared by every mounted consumer (a module-level store behind
 * `useSyncExternalStore`, so all instances stay in lockstep within a
 * document), backed by `localStorage` so the choice survives reloads
 * while staying browser-local — no awareness / sync coupling.
 * Failure-soft: any storage exception falls back to the in-memory
 * default. The split-orientation preferences and the GraphQL
 * explorer's descriptions toggle ride it.
 */

import { useCallback, useSyncExternalStore } from 'react';

export function createStoredPreference<T extends string>(
  storageKey: string,
  valid: readonly T[],
  fallback: T,
): () => [T, (next: T) => void] {
  function read(): T {
    try {
      const raw = globalThis.localStorage?.getItem(storageKey);
      const match = raw === null || raw === undefined ? undefined : valid.find((entry) => entry === raw);
      if (match !== undefined) return match;
    } catch {
      // ignore — private mode / locked storage
    }
    return fallback;
  }

  function write(value: T): void {
    try {
      globalThis.localStorage?.setItem(storageKey, value);
    } catch {
      // ignore
    }
  }

  let current: T = read();
  const listeners = new Set<() => void>();

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function getSnapshot(): T {
    return current;
  }

  return function useStoredPreference(): [T, (next: T) => void] {
    const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    const setValue = useCallback((next: T) => {
      if (next === current || !valid.includes(next)) return;
      current = next;
      write(next);
      for (const listener of listeners) listener();
    }, []);

    return [value, setValue];
  };
}
