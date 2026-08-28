/**
 * Persisted boolean preference for the sidebar's ⋯ Options menu — the
 * Behavior single-click flags and the Appearance indent-guides toggle.
 *
 * Backed by `localStorage` under `oh.sidebar.<name>` so a choice
 * survives reloads while staying browser-local — no awareness/sync
 * coupling. Failure-soft: any storage exception (private mode, quota,
 * locked extension storage) falls back to the in-memory default.
 *
 * The setter keeps React's `SetStateAction` shape so the menu can keep
 * toggling with `set((v) => !v)`.
 */

import type React from 'react';
import { useCallback, useState } from 'react';

function storageKey(name: string): string {
  return `oh.sidebar.${name}`;
}

function readPersisted(name: string, fallback: boolean): boolean {
  try {
    const raw = globalThis.localStorage?.getItem(storageKey(name));
    if (raw === 'true' || raw === 'false') return raw === 'true';
  } catch {
    // ignore — private mode / locked storage
  }
  return fallback;
}

function writePersisted(name: string, value: boolean): void {
  try {
    globalThis.localStorage?.setItem(storageKey(name), String(value));
  } catch {
    // ignore
  }
}

export function usePersistedFlag(
  name: string,
  fallback: boolean,
): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  const [value, setValue] = useState<boolean>(() => readPersisted(name, fallback));

  const set = useCallback<React.Dispatch<React.SetStateAction<boolean>>>(
    (action) => {
      setValue((prev) => {
        const next = typeof action === 'function' ? action(prev) : action;
        if (next !== prev) writePersisted(name, next);
        return next;
      });
    },
    [name],
  );

  return [value, set];
}
