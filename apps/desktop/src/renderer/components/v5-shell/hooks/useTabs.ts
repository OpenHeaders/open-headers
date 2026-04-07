/**
 * useTabs — manages the editor tab state, scoped per workspace.
 *
 * Supports:
 *   - Open/close/switch tabs
 *   - Pinned tabs (always left-aligned, can't close with ⌘W)
 *   - Unsaved indicator
 *   - Tab overflow count
 *   - Back/forward navigation history
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type TabType =
  | 'overview'
  | 'request'
  | 'rule'
  | 'environment'
  | 'recording'
  | 'collection'
  | 'collection-overview'
  | 'folder'
  | 'folder-overview'
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
  /** Tooltip text shown on hover (e.g. URL for requests, header name for rules) */
  tooltip?: string;
  /** When true, this tab holds a draft entity not yet persisted to main process */
  draft?: boolean;
  /** Local draft data (only set when draft=true) */
  draftData?: Record<string, unknown>;
}

const MAX_RECENTLY_CLOSED = 20;

interface TabsState {
  tabs: Tab[];
  activeTabId: string | null;
  history: string[];
  historyIndex: number;
  recentlyClosed: Tab[];
}

const OVERVIEW_TAB: Tab = {
  id: 'overview',
  type: 'overview',
  label: 'Overview',
  pinned: false,
  unsaved: false,
};

const DEFAULT_STATE: TabsState = {
  tabs: [OVERVIEW_TAB],
  activeTabId: 'overview',
  history: ['overview'],
  historyIndex: 0,
  recentlyClosed: [],
};

// ── Hook ──────────────────────────────────────────────────────────

export function useTabs(activeWorkspaceId?: string) {
  const currentWorkspaceRef = useRef(activeWorkspaceId);
  const workspaceTabsMap = useRef(new Map<string, TabsState>());

  const getWorkspaceState = useCallback((wsId: string | undefined): TabsState => {
    if (!wsId) return { ...DEFAULT_STATE, tabs: [{ ...OVERVIEW_TAB }] };
    const existing = workspaceTabsMap.current.get(wsId);
    if (existing) return existing;
    const fresh: TabsState = { ...DEFAULT_STATE, tabs: [{ ...OVERVIEW_TAB }] };
    workspaceTabsMap.current.set(wsId, fresh);
    return fresh;
  }, []);

  const [state, setState] = useState<TabsState>(() => getWorkspaceState(activeWorkspaceId));

  // Swap tabs when workspace changes
  useEffect(() => {
    const prevWsId = currentWorkspaceRef.current;
    if (prevWsId === activeWorkspaceId) return;

    if (prevWsId) {
      setState((currentState) => {
        workspaceTabsMap.current.set(prevWsId, currentState);
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

  // Keep the map in sync
  useEffect(() => {
    if (activeWorkspaceId) {
      workspaceTabsMap.current.set(activeWorkspaceId, state);
    }
  }, [state, activeWorkspaceId]);

  const openTab = useCallback((tab: Omit<Tab, 'pinned' | 'unsaved'>) => {
    setState((prev) => {
      const existing = prev.tabs.find((t) => t.id === tab.id);
      const newHistory = [...prev.history.slice(0, prev.historyIndex + 1), tab.id];
      const recentlyClosed = prev.recentlyClosed.filter((t) => t.id !== tab.id);

      if (existing) {
        return {
          ...prev,
          activeTabId: tab.id,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          recentlyClosed,
        };
      }

      const newTab: Tab = { ...tab, pinned: false, unsaved: false };
      const newTabs = [...prev.tabs, newTab];
      return {
        ...prev,
        tabs: newTabs,
        activeTabId: tab.id,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        recentlyClosed,
      };
    });
  }, []);

  const closeTab = useCallback((tabId: string, force = false) => {
    setState((prev) => {
      const tab = prev.tabs.find((t) => t.id === tabId);
      if (!tab || tab.pinned) return prev;

      if (tab.unsaved && !force) {
        return prev;
      }

      const newTabs = prev.tabs.filter((t) => t.id !== tabId);
      let newActiveId = prev.activeTabId;

      if (prev.activeTabId === tabId) {
        const closedIndex = prev.tabs.findIndex((t) => t.id === tabId);
        const nextTab = newTabs[closedIndex] ?? newTabs[closedIndex - 1] ?? null;
        newActiveId = nextTab?.id ?? null;
      }

      // Track recently closed (skip welcome/settings singletons and drafts)
      const recentlyClosed =
        tab.type !== 'overview' && tab.type !== 'settings' && !tab.draft
          ? [tab, ...prev.recentlyClosed.filter((t) => t.id !== tab.id)].slice(0, MAX_RECENTLY_CLOSED)
          : prev.recentlyClosed;

      return { ...prev, tabs: newTabs, activeTabId: newActiveId, recentlyClosed };
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
    setState((prev) => {
      const tab = prev.tabs.find((t) => t.id === tabId);
      if (!tab || tab.draft) return prev; // drafts cannot be pinned
      return {
        ...prev,
        tabs: prev.tabs.map((t) => (t.id === tabId ? { ...t, pinned: !t.pinned } : t)),
      };
    });
  }, []);

  const updateTab = useCallback((tabId: string, updates: Partial<Tab>) => {
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => (t.id === tabId ? { ...t, ...updates } : t)),
    }));
  }, []);

  const markUnsaved = useCallback((tabId: string, unsaved: boolean) => {
    setState((prev) => {
      const tab = prev.tabs.find((t) => t.id === tabId);
      if (!tab || tab.unsaved === unsaved) return prev;
      return {
        ...prev,
        tabs: prev.tabs.map((t) => (t.id === tabId ? { ...t, unsaved } : t)),
      };
    });
  }, []);

  const reorderTab = useCallback((fromId: string, toId: string, side: 'left' | 'right') => {
    setState((prev) => {
      // Work on the display order (pinned first) since that's what the TabBar renders
      const sorted = [...prev.tabs.filter((t) => t.pinned), ...prev.tabs.filter((t) => !t.pinned)];
      const from = sorted.findIndex((t) => t.id === fromId);
      const to = sorted.findIndex((t) => t.id === toId);
      if (from === -1 || to === -1 || from === to) return prev;

      const target = side === 'right' ? to + 1 : to;
      if (target === from || target === from + 1) return prev;

      const [moved] = sorted.splice(from, 1);
      const insertAt = target > from ? target - 1 : target;
      sorted.splice(insertAt, 0, moved);
      return { ...prev, tabs: sorted };
    });
  }, []);

  const closeOtherTabs = useCallback((tabId: string) => {
    setState((prev) => {
      const newTabs = prev.tabs.filter((t) => t.id === tabId || t.pinned);
      return { ...prev, tabs: newTabs, activeTabId: tabId };
    });
  }, []);

  const closeAllTabs = useCallback(() => {
    setState((prev) => {
      const pinned = prev.tabs.filter((t) => t.pinned);
      const newTabs = pinned.length > 0 ? pinned : [{ ...OVERVIEW_TAB }];
      return { ...prev, tabs: newTabs, activeTabId: newTabs[0].id };
    });
  }, []);

  const closeUnmodifiedTabs = useCallback(() => {
    setState((prev) => {
      const newTabs = prev.tabs.filter((t) => t.unsaved || t.pinned);
      if (newTabs.length === 0) newTabs.push({ ...OVERVIEW_TAB });
      const activeStillExists = newTabs.some((t) => t.id === prev.activeTabId);
      return { ...prev, tabs: newTabs, activeTabId: activeStillExists ? prev.activeTabId : newTabs[0].id };
    });
  }, []);

  const closeTabsToLeft = useCallback((tabId: string) => {
    setState((prev) => {
      const idx = prev.tabs.findIndex((t) => t.id === tabId);
      if (idx <= 0) return prev;
      const newTabs = prev.tabs.filter((t, i) => i >= idx || t.pinned);
      const activeStillExists = newTabs.some((t) => t.id === prev.activeTabId);
      return { ...prev, tabs: newTabs, activeTabId: activeStillExists ? prev.activeTabId : tabId };
    });
  }, []);

  const closeTabsToRight = useCallback((tabId: string) => {
    setState((prev) => {
      const idx = prev.tabs.findIndex((t) => t.id === tabId);
      if (idx === -1 || idx >= prev.tabs.length - 1) return prev;
      const newTabs = prev.tabs.filter((t, i) => i <= idx || t.pinned);
      const activeStillExists = newTabs.some((t) => t.id === prev.activeTabId);
      return { ...prev, tabs: newTabs, activeTabId: activeStillExists ? prev.activeTabId : tabId };
    });
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

  const sortedTabs = [...state.tabs.filter((t) => t.pinned), ...state.tabs.filter((t) => !t.pinned)];

  return {
    tabs: sortedTabs,
    recentlyClosed: state.recentlyClosed,
    activeTabId: state.activeTabId,
    canGoBack,
    canGoForward,
    openTab,
    closeTab,
    switchTab,
    togglePin,
    updateTab,
    markUnsaved,
    reorderTab,
    closeOtherTabs,
    closeAllTabs,
    closeUnmodifiedTabs,
    closeTabsToLeft,
    closeTabsToRight,
    goBack,
    goForward,
  };
}
