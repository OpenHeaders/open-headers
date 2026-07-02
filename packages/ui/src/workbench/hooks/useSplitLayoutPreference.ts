/**
 * Factory for persisted split-orientation preferences — the mechanism
 * behind the request editor's request/response split and the rule
 * editor's actions/conditions split.
 *
 *   - `'horizontal'` — panes side-by-side.
 *   - `'vertical'`   — panes stacked.
 *
 * The naming follows the app's splitter vocabulary (a `horizontal`
 * orientation arranges panes along the horizontal axis; `vertical`
 * stacks them) so it lines up with the `split-right` / `split-down`
 * glyphs the toggle reuses.
 *
 * Each preference is global: one value shared by every mounted editor
 * of that kind, backed by a module-level store + `localStorage` so all
 * instances stay in lockstep within a document and the choice survives
 * reloads while staying browser-local — no awareness/sync coupling.
 * Failure-soft: any storage exception falls back to the in-memory
 * default.
 */

import { useCallback, useSyncExternalStore } from 'react';

export type SplitLayout = 'horizontal' | 'vertical';

const VALID: ReadonlySet<SplitLayout> = new Set(['horizontal', 'vertical']);

export function createSplitLayoutPreference(
  storageKey: string,
  defaultLayout: SplitLayout,
): () => [SplitLayout, (next: SplitLayout) => void] {
  function read(): SplitLayout {
    try {
      const raw = globalThis.localStorage?.getItem(storageKey);
      if (raw && VALID.has(raw as SplitLayout)) return raw as SplitLayout;
    } catch {
      // ignore — private mode / locked storage
    }
    return defaultLayout;
  }

  function write(layout: SplitLayout): void {
    try {
      globalThis.localStorage?.setItem(storageKey, layout);
    } catch {
      // ignore
    }
  }

  let current: SplitLayout = read();
  const listeners = new Set<() => void>();

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function getSnapshot(): SplitLayout {
    return current;
  }

  return function useSplitLayoutPreference(): [SplitLayout, (next: SplitLayout) => void] {
    const layout = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    const setLayout = useCallback((next: SplitLayout) => {
      if (next === current || !VALID.has(next)) return;
      current = next;
      write(next);
      for (const listener of listeners) listener();
    }, []);

    return [layout, setLayout];
  };
}
