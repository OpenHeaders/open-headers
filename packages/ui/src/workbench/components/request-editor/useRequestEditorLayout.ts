/**
 * Persisted orientation for the API request editor's request/response
 * split.
 *
 *   - `'horizontal'` — request | response side-by-side.
 *   - `'vertical'`   — request / response stacked (default).
 *
 * The naming follows the app's existing splitter vocabulary (a
 * `horizontal` orientation arranges panes along the horizontal axis;
 * `vertical` stacks them) so it lines up with the `split-right` /
 * `split-down` glyphs the toggle reuses.
 *
 * Global: one preference shared by every request tab. Backed by a
 * module-level store + `localStorage` so all mounted editors stay in
 * lockstep within a document and the choice survives reloads while
 * staying browser-local — no awareness/sync coupling. Failure-soft:
 * any storage exception falls back to the in-memory default.
 */

import { useCallback, useSyncExternalStore } from 'react';

export type RequestEditorLayout = 'horizontal' | 'vertical';

const STORAGE_KEY = 'oh.request-editor.layout';
const VALID: ReadonlySet<RequestEditorLayout> = new Set(['horizontal', 'vertical']);
const DEFAULT_LAYOUT: RequestEditorLayout = 'vertical';

function read(): RequestEditorLayout {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (raw && VALID.has(raw as RequestEditorLayout)) return raw as RequestEditorLayout;
  } catch {
    // ignore — private mode / locked storage
  }
  return DEFAULT_LAYOUT;
}

function write(layout: RequestEditorLayout): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, layout);
  } catch {
    // ignore
  }
}

let current: RequestEditorLayout = read();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): RequestEditorLayout {
  return current;
}

export function useRequestEditorLayout(): [RequestEditorLayout, (next: RequestEditorLayout) => void] {
  const layout = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setLayout = useCallback((next: RequestEditorLayout) => {
    if (next === current || !VALID.has(next)) return;
    current = next;
    write(next);
    for (const listener of listeners) listener();
  }, []);

  return [layout, setLayout];
}
