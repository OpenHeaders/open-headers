/**
 * Persisted last-used layout per surface.
 *
 * Plan §13 acceptance: "Last-used layout persists per surface across
 * modal opens." Backed by `localStorage` so it survives full reloads
 * but stays browser-local — no awareness/sync coupling.
 *
 * Storage key: `oh.merge-editor.layout.<surfaceId>`. Surface ids are
 * caller-defined (e.g. `'entity-conflict'`, `'import'`, `'git'`); the
 * default `'default'` keeps single-consumer wiring trivial.
 *
 * Failure-soft: any storage exception (private mode, quota, locked
 * extension storage) silently falls back to the in-memory default.
 */

import { useCallback, useEffect, useState } from 'react';
import type { MergeLayout } from './components/MergePane';

const VALID_LAYOUTS: ReadonlySet<MergeLayout> = new Set(['column', 'show-base-top', 'show-base-center']);

function storageKey(surfaceId: string): string {
  return `oh.merge-editor.layout.${surfaceId}`;
}

function readPersisted(surfaceId: string, fallback: MergeLayout): MergeLayout {
  try {
    const raw = globalThis.localStorage?.getItem(storageKey(surfaceId));
    if (raw && VALID_LAYOUTS.has(raw as MergeLayout)) return raw as MergeLayout;
  } catch {
    // ignore — private mode / locked storage
  }
  return fallback;
}

function writePersisted(surfaceId: string, layout: MergeLayout): void {
  try {
    globalThis.localStorage?.setItem(storageKey(surfaceId), layout);
  } catch {
    // ignore
  }
}

export function usePersistedLayout(
  surfaceId = 'default',
  fallback: MergeLayout = 'column',
): [MergeLayout, (next: MergeLayout) => void] {
  const [layout, setLayoutState] = useState<MergeLayout>(() => readPersisted(surfaceId, fallback));

  // Re-read on surfaceId change so a single modal instance reused
  // across surfaces tracks each surface's last value.
  useEffect(() => {
    setLayoutState(readPersisted(surfaceId, fallback));
  }, [surfaceId, fallback]);

  const setLayout = useCallback(
    (next: MergeLayout) => {
      setLayoutState(next);
      writePersisted(surfaceId, next);
    },
    [surfaceId],
  );

  return [layout, setLayout];
}
