/**
 * useLayoutPersistence — persists and restores the IDE layout state across app restarts.
 *
 * Hydrates synchronously from window.startupData (provided by main process at window creation).
 * Saves mutations asynchronously via electronAPI.saveToStorage (debounced).
 * No async load in the renderer — eliminates race conditions.
 */

import { useEffect, useRef, useState } from 'react';

const STORAGE_FILE = 'layout-state.json';

interface LayoutState {
  panels: {
    sidebar: boolean;
    workbench: boolean;
    bottomPanel: boolean;
    inspector: boolean;
  };
  responseSideBySide: boolean;
  sidebarsSwapped: boolean;
  bottomPanelTab: string;
  sidebarActivePanel: string;
  sidebarExpandedSections: string[];
  sidebarExpandedCollections: string[];
  inspectorExpandedKeys: string[];
}

const DEFAULT_LAYOUT: LayoutState = {
  panels: {
    sidebar: true,
    workbench: true,
    bottomPanel: true,
    inspector: false,
  },
  responseSideBySide: false,
  sidebarsSwapped: false,
  bottomPanelTab: 'traffic',
  sidebarActivePanel: 'items',
  sidebarExpandedSections: [],
  sidebarExpandedCollections: [],
  inspectorExpandedKeys: [],
};

function isValidLayoutState(obj: unknown): obj is LayoutState {
  if (!obj || typeof obj !== 'object') return false;
  const s = obj as Record<string, unknown>;
  return typeof s.panels === 'object' && s.panels !== null && typeof s.responseSideBySide === 'boolean';
}

// ── Synchronous hydration from startupData ───────────────────────

function hydrateFromStartupData(): LayoutState {
  const data = window.startupData?.layoutState;
  if (data && isValidLayoutState(data)) {
    return {
      ...DEFAULT_LAYOUT,
      ...data,
      panels: { ...DEFAULT_LAYOUT.panels, ...(data.panels as Record<string, boolean>) },
    };
  }
  return DEFAULT_LAYOUT;
}

const initialLayout = hydrateFromStartupData();

// ── Debounced save ───────────────────────────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(state: LayoutState): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const json = JSON.stringify(state);
    window.electronAPI?.saveToStorage?.(STORAGE_FILE, json).catch(() => {});
  }, 500);
}

// ── Hook ─────────────────────────────────────────────────────────

export function useLayoutPersistence() {
  const [state, setState] = useState<LayoutState>(initialLayout);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    scheduleSave(state);
  }, [state]);

  return { layoutState: state, setLayoutState: setState };
}

export type { LayoutState };
export { DEFAULT_LAYOUT };
