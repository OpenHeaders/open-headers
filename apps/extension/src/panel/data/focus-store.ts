import { useSyncExternalStore } from 'react';

export type PanelRegion = 'left' | 'main' | 'right' | null;

let focusedRegion: PanelRegion = null;
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

export function getFocusedRegion(): PanelRegion {
  return focusedRegion;
}

export function setFocusedRegion(region: PanelRegion): void {
  if (focusedRegion === region) return;
  focusedRegion = region;
  emit();
}

export function useFocusedRegion(): PanelRegion {
  return useSyncExternalStore(subscribe, getFocusedRegion, getFocusedRegion);
}
