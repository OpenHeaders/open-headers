import { useSyncExternalStore } from 'react';
import type { PanelDockSlot } from './tool-windows';

export type PanelRegion = 'left' | 'main' | 'right' | 'bottom' | null;

let focusedRegion: PanelRegion = null;
let focusedDock: PanelDockSlot | null = null;
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

export function getFocusedDock(): PanelDockSlot | null {
  return focusedDock;
}

export function setFocusedRegion(region: PanelRegion): void {
  if (focusedRegion === region && (region === 'main' ? focusedDock === null : true)) return;
  focusedRegion = region;
  if (region === 'main') focusedDock = null;
  emit();
}

export function setFocusedDock(slot: PanelDockSlot | null): void {
  if (focusedDock === slot) return;
  focusedDock = slot;
  emit();
}

export function useFocusedRegion(): PanelRegion {
  return useSyncExternalStore(subscribe, getFocusedRegion, getFocusedRegion);
}

export function useFocusedDock(): PanelDockSlot | null {
  return useSyncExternalStore(subscribe, getFocusedDock, getFocusedDock);
}
