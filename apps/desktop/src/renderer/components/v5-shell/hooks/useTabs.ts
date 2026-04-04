/**
 * useTabs — manages the editor tab state.
 *
 * Supports:
 *   - Open/close/switch tabs
 *   - Pinned tabs (always left-aligned, can't close with ⌘W)
 *   - Unsaved indicator
 *   - Tab overflow count
 *   - Back/forward navigation history
 */

import { useCallback, useState } from 'react';

export type TabType = 'welcome' | 'request' | 'rule' | 'environment' | 'recording' | 'collection' | 'globals' | 'vault';

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

const WELCOME_TAB: Tab = {
  id: 'welcome',
  type: 'welcome',
  label: 'Welcome',
  pinned: false,
  unsaved: false,
};

export function useTabs() {
  const [state, setState] = useState<TabsState>({
    tabs: [WELCOME_TAB],
    activeTabId: 'welcome',
    history: ['welcome'],
    historyIndex: 0,
  });

  const openTab = useCallback((tab: Omit<Tab, 'pinned' | 'unsaved'>) => {
    setState((prev) => {
      const existing = prev.tabs.find((t) => t.id === tab.id);
      if (existing) {
        // Tab already open — just switch to it
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

      // If closing the active tab, switch to the next or previous
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
