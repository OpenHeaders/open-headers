/**
 * useTabs — manages the editor tab state, scoped per workspace.
 *
 * Supports:
 *   - Open/close/switch tabs
 *   - Pinned tabs (always left-aligned, can't close with ⌘W)
 *   - Unsaved indicator
 *   - Tab overflow count
 *   - Back/forward navigation history
 *   - Per-workspace tab persistence (disk via main process IPC)
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type TabType =
  | 'welcome'
  | 'request'
  | 'rule'
  | 'environment'
  | 'recording'
  | 'collection'
  | 'globals'
  | 'vault'
  | 'settings';

export interface Tab {
  id: string;
  type: TabType;
  label: string;
  /** Icon identifier (method badge for requests, lightning for rules, etc.) */
  icon?: string;
  pinned: boolean;
  unsaved: boolean;
  /** Associated entity ID (request ID, rule ID, etc.) */
  entityId?: string;
}

interface TabsState {
  tabs: Tab[];
  activeTabId: string | null;
  history: string[];
  historyIndex: number;
}

const STORAGE_FILE = 'tab-sessions.json';

const WELCOME_TAB: Tab = {
  id: 'welcome',
  type: 'welcome',
  label: 'Welcome',
  pinned: false,
  unsaved: false,
};

const DEFAULT_STATE: TabsState = {
  tabs: [WELCOME_TAB],
  activeTabId: 'welcome',
  history: ['welcome'],
  historyIndex: 0,
};

// ── Persistence helpers ───────────────────────────────────────────

/** Strip transient fields before persisting */
function toSerializable(tabsState: TabsState): TabsState {
  return {
    ...tabsState,
    tabs: tabsState.tabs.map((t) => ({ ...t, unsaved: false })),
  };
}

/** Validate a restored TabsState is structurally sound */
function isValidTabsState(obj: unknown): obj is TabsState {
  if (!obj || typeof obj !== 'object') return false;
  const s = obj as Record<string, unknown>;
  return Array.isArray(s.tabs) && Array.isArray(s.history) && typeof s.historyIndex === 'number';
}

// Module-level cache so the map survives re-mounts but the load only happens once
let diskLoaded = false;
const workspaceTabsMap = new Map<string, TabsState>();

async function loadAllFromDisk(): Promise<void> {
  if (diskLoaded) return;
  diskLoaded = true;
  try {
    const raw = await window.electronAPI?.loadFromStorage?.(STORAGE_FILE);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const [wsId, value] of Object.entries(parsed)) {
      if (isValidTabsState(value)) {
        // Reset unsaved flags on restore
        workspaceTabsMap.set(wsId, toSerializable(value));
      }
    }
  } catch {
    // Corrupted or missing file — start fresh
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSaveToDisk(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const serialized: Record<string, TabsState> = {};
    for (const [wsId, tabsState] of workspaceTabsMap) {
      serialized[wsId] = toSerializable(tabsState);
    }
    const json = JSON.stringify(serialized);
    window.electronAPI?.saveToStorage?.(STORAGE_FILE, json).catch(() => {});
  }, 1000);
}

// ── Hook ──────────────────────────────────────────────────────────

export function useTabs(activeWorkspaceId?: string) {
  const currentWorkspaceRef = useRef(activeWorkspaceId);
  const [loaded, setLoaded] = useState(diskLoaded);

  // Get or create state for a workspace
  const getWorkspaceState = useCallback((wsId: string | undefined): TabsState => {
    if (!wsId) return { ...DEFAULT_STATE, tabs: [{ ...WELCOME_TAB }] };
    const existing = workspaceTabsMap.get(wsId);
    if (existing) return existing;
    const fresh: TabsState = { ...DEFAULT_STATE, tabs: [{ ...WELCOME_TAB }] };
    workspaceTabsMap.set(wsId, fresh);
    return fresh;
  }, []);

  const [state, setState] = useState<TabsState>(() => getWorkspaceState(activeWorkspaceId));

  // Load persisted tabs from disk on first mount
  useEffect(() => {
    if (loaded) return;
    loadAllFromDisk().then(() => {
      setLoaded(true);
      // Re-hydrate current workspace state from what was loaded
      setState(getWorkspaceState(activeWorkspaceId));
    });
  }, [loaded, activeWorkspaceId, getWorkspaceState]);

  // Swap tabs when workspace changes
  useEffect(() => {
    const prevWsId = currentWorkspaceRef.current;
    if (prevWsId === activeWorkspaceId) return;

    // Save current state for the previous workspace
    if (prevWsId) {
      setState((currentState) => {
        workspaceTabsMap.set(prevWsId, currentState);
        const restored = getWorkspaceState(activeWorkspaceId);
        currentWorkspaceRef.current = activeWorkspaceId;
        return restored;
      });
    } else {
      const restored = getWorkspaceState(activeWorkspaceId);
      currentWorkspaceRef.current = activeWorkspaceId;
      setState(restored);
    }
  }, [activeWorkspaceId, getWorkspaceState]);

  // Keep the map in sync and schedule disk save on every state change
  useEffect(() => {
    if (activeWorkspaceId) {
      workspaceTabsMap.set(activeWorkspaceId, state);
      scheduleSaveToDisk();
    }
  }, [state, activeWorkspaceId]);

  const openTab = useCallback((tab: Omit<Tab, 'pinned' | 'unsaved'>) => {
    setState((prev) => {
      const existing = prev.tabs.find((t) => t.id === tab.id);
      if (existing) {
        const newHistory = [...prev.history.slice(0, prev.historyIndex + 1), tab.id];
        return { ...prev, activeTabId: tab.id, history: newHistory, historyIndex: newHistory.length - 1 };
      }

      const newTab: Tab = { ...tab, pinned: false, unsaved: false };
      const newTabs = [...prev.tabs, newTab];
      const newHistory = [...prev.history.slice(0, prev.historyIndex + 1), tab.id];
      return { tabs: newTabs, activeTabId: tab.id, history: newHistory, historyIndex: newHistory.length - 1 };
    });
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setState((prev) => {
      const tab = prev.tabs.find((t) => t.id === tabId);
      if (!tab || tab.pinned) return prev;

      const newTabs = prev.tabs.filter((t) => t.id !== tabId);
      let newActiveId = prev.activeTabId;

      if (prev.activeTabId === tabId) {
        const closedIndex = prev.tabs.findIndex((t) => t.id === tabId);
        const nextTab = newTabs[closedIndex] ?? newTabs[closedIndex - 1] ?? null;
        newActiveId = nextTab?.id ?? null;
      }

      return { ...prev, tabs: newTabs, activeTabId: newActiveId };
    });
  }, []);

  const switchTab = useCallback((tabId: string) => {
    setState((prev) => {
      if (!prev.tabs.find((t) => t.id === tabId)) return prev;
      const newHistory = [...prev.history.slice(0, prev.historyIndex + 1), tabId];
      return { ...prev, activeTabId: tabId, history: newHistory, historyIndex: newHistory.length - 1 };
    });
  }, []);

  const togglePin = useCallback((tabId: string) => {
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => (t.id === tabId ? { ...t, pinned: !t.pinned } : t)),
    }));
  }, []);

  const markUnsaved = useCallback((tabId: string, unsaved: boolean) => {
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => (t.id === tabId ? { ...t, unsaved } : t)),
    }));
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => {
      if (prev.historyIndex <= 0) return prev;
      const newIndex = prev.historyIndex - 1;
      return { ...prev, activeTabId: prev.history[newIndex], historyIndex: newIndex };
    });
  }, []);

  const goForward = useCallback(() => {
    setState((prev) => {
      if (prev.historyIndex >= prev.history.length - 1) return prev;
      const newIndex = prev.historyIndex + 1;
      return { ...prev, activeTabId: prev.history[newIndex], historyIndex: newIndex };
    });
  }, []);

  const canGoBack = state.historyIndex > 0;
  const canGoForward = state.historyIndex < state.history.length - 1;

  // Sort: pinned tabs first, then unpinned in order
  const sortedTabs = [...state.tabs.filter((t) => t.pinned), ...state.tabs.filter((t) => !t.pinned)];

  return {
    tabs: sortedTabs,
    activeTabId: state.activeTabId,
    canGoBack,
    canGoForward,
    openTab,
    closeTab,
    switchTab,
    togglePin,
    markUnsaved,
    goBack,
    goForward,
  };
}
