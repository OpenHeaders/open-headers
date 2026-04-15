/**
 * focus-region-store — external subscribe/notify store for the
 * `focusedRegion` / `focusedDock` accent state.
 *
 * This state lives OUTSIDE React's reconciler on purpose. Writing it from a
 * document-level click-capture listener (useFocusRegion) must not re-render
 * the form tree — otherwise antd's controlled <Radio.Group> re-commits
 * `checked` mid-dispatch and the native click-to-toggle never fires.
 * Consumers subscribe per-slice via useSyncExternalStore so only the specific
 * leaves that paint the accent re-render, and form inputs never participate.
 */

import { useSyncExternalStore } from 'react';
import type { DockSlot, FocusRegion } from '../types';

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

export function getFocusedRegion(): FocusRegion {
  return focusedRegion;
}

export function getFocusedDock(): DockSlot | null {
  return focusedDock;
}

export function setFocusedRegion(region: FocusRegion): void {
  const nextDock = region === null || region === 'editor' ? null : focusedDock;
  if (focusedRegion === region && focusedDock === nextDock) return;
  focusedRegion = region;
  focusedDock = nextDock;
  emit();
}

export function setFocusedDock(slot: DockSlot | null): void {
  if (focusedDock === slot) return;
  focusedDock = slot;
  emit();
}

export function useFocusedRegion(): FocusRegion {
  return useSyncExternalStore(subscribe, getFocusedRegion, getFocusedRegion);
}

export function useIsDockFocused(slot: DockSlot): boolean {
  return useSyncExternalStore(
    subscribe,
    () => focusedDock === slot,
    () => focusedDock === slot,
  );
}
