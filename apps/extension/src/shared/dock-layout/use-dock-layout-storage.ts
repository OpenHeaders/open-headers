/**
 * useDockLayoutStorage — persist and restore dock layout state via
 * the typed `extensionStorage` adapter.
 *
 * Each surface (workspace, devtools panel) provides its own storage
 * key so their layouts are independent. The hook loads persisted
 * state on mount and exposes a debounced `onPersist` callback that
 * `useDockLayout` calls after every mutation.
 *
 * The workspace currently bundles dock persistence inside
 * useResponsiveLayout (alongside ratio data). When the workspace
 * migrates to the shared useDockLayout, it can adopt this hook and
 * drop the toolLayout portion from its PersistedLayout record.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { withLock } from '@/shared/coordination/with-lock';
import { extensionStorage, type StorageKey, storageKey } from '@/shared/storage';
import type { ToolLayoutState } from './types';

export interface DockLayoutStorageResult<T extends string> {
  /** Persisted layout loaded from storage, or null on fresh profiles. */
  initial: Partial<ToolLayoutState<T>> | null;
  /** Debounced callback — pass to useDockLayout's `onPersist`. */
  onPersist: (state: ToolLayoutState<T>) => void;
  /** True once storage has been read (avoids flash of default state). */
  ready: boolean;
}

const DEBOUNCE_MS = 500;

export function useDockLayoutStorage<T extends string>(keyName: string): DockLayoutStorageResult<T> {
  const [initial, setInitial] = useState<Partial<ToolLayoutState<T>> | null>(null);
  const [ready, setReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive a typed spec from the caller-provided string. The surface
  // chooses its own key so we keep the spec local instead of pinning
  // it in the shared registry.
  const spec: StorageKey<Partial<ToolLayoutState<T>>> = storageKey(keyName);

  useEffect(() => {
    void extensionStorage.get(spec).then((saved) => {
      if (saved?.docks) setInitial(saved);
      setReady(true);
    });
  }, [spec]);

  const onPersist = useCallback(
    (state: ToolLayoutState<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        // Phase 10 — wrap the write in a Web Lock keyed by the
        // storage name so two tabs dragging the devtools panel's
        // dock layout concurrently serialize through one writer.
        // Origin-scoped lock (auto-released on tab death) is
        // sufficient here since the panel layout is not
        // per-workspace — no SW round-trip needed, same guarantee.
        void withLock(
          `oh:layout:${keyName}`,
          async () => {
            await extensionStorage.set(spec, { docks: state.docks, hidden: state.hidden });
          },
          { op: 'dock-layout-set' },
        );
      }, DEBOUNCE_MS);
    },
    [spec, keyName],
  );

  return { initial, onPersist, ready };
}
