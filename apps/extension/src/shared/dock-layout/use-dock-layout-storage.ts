/**
 * useDockLayoutStorage — persist and restore dock layout state via
 * chrome.storage.local.
 *
 * Each surface (workspace, devtools panel) provides its own storage key
 * so their layouts are independent. The hook loads persisted state on
 * mount and exposes a debounced `onPersist` callback that
 * `useDockLayout` calls after every mutation.
 *
 * The workspace currently bundles dock persistence inside
 * useResponsiveLayout (alongside ratio data). When the workspace
 * migrates to the shared useDockLayout, it can adopt this hook and
 * drop the toolLayout portion from its PersistedLayout record.
 */

import { storage } from '@utils/browser-api';
import { useCallback, useEffect, useRef, useState } from 'react';
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

export function useDockLayoutStorage<T extends string>(storageKey: string): DockLayoutStorageResult<T> {
  const [initial, setInitial] = useState<Partial<ToolLayoutState<T>> | null>(null);
  const [ready, setReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    storage.local.get([storageKey], (result: Record<string, unknown>) => {
      const saved = result[storageKey] as Partial<ToolLayoutState<T>> | undefined;
      if (saved?.docks) {
        setInitial(saved);
      }
      setReady(true);
    });
  }, [storageKey]);

  const onPersist = useCallback(
    (state: ToolLayoutState<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        storage.local.set({
          [storageKey]: {
            docks: state.docks,
            hidden: state.hidden,
          },
        });
      }, DEBOUNCE_MS);
    },
    [storageKey],
  );

  return { initial, onPersist, ready };
}
