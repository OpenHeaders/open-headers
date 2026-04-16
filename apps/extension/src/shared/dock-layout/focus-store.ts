/**
 * createFocusStore — factory for region/dock focus tracking stores.
 *
 * Each page (workspace, devtools panel) creates its own store instance
 * since they run in separate browsing contexts. The store lives OUTSIDE
 * React's reconciler on purpose — writing from a document-level
 * click-capture listener must not re-render the form tree (otherwise
 * antd's controlled <Radio.Group> re-commits `checked` mid-dispatch and
 * the native click-to-toggle never fires). Consumers subscribe
 * per-slice via useSyncExternalStore.
 */

import { useSyncExternalStore } from 'react';
import type { DockSlot, FocusRegion } from './types';

export interface FocusStore {
  getFocusedRegion: () => FocusRegion;
  getFocusedDock: () => DockSlot | null;
  setFocusedRegion: (region: FocusRegion) => void;
  setFocusedDock: (slot: DockSlot | null) => void;
  useFocusedRegion: () => FocusRegion;
  useIsDockFocused: (slot: DockSlot) => boolean;
  useFocusedDock: () => DockSlot | null;
}

export function createFocusStore(): FocusStore {
  let focusedRegion: FocusRegion = null;
  let focusedDock: DockSlot | null = null;
  const listeners = new Set<() => void>();

  function emit(): void {
    for (const l of listeners) l();
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function getFocusedRegion(): FocusRegion {
    return focusedRegion;
  }

  function getFocusedDock(): DockSlot | null {
    return focusedDock;
  }

  function setFocusedRegion(region: FocusRegion): void {
    const nextDock = region === null || region === 'editor' ? null : focusedDock;
    if (focusedRegion === region && focusedDock === nextDock) return;
    focusedRegion = region;
    focusedDock = nextDock;
    emit();
  }

  function setFocusedDock(slot: DockSlot | null): void {
    if (focusedDock === slot) return;
    focusedDock = slot;
    emit();
  }

  function useFocusedRegion(): FocusRegion {
    return useSyncExternalStore(subscribe, getFocusedRegion, getFocusedRegion);
  }

  function useIsDockFocused(slot: DockSlot): boolean {
    return useSyncExternalStore(
      subscribe,
      () => focusedDock === slot,
      () => focusedDock === slot,
    );
  }

  function useFocusedDock(): DockSlot | null {
    return useSyncExternalStore(subscribe, getFocusedDock, getFocusedDock);
  }

  return {
    getFocusedRegion,
    getFocusedDock,
    setFocusedRegion,
    setFocusedDock,
    useFocusedRegion,
    useIsDockFocused,
    useFocusedDock,
  };
}
