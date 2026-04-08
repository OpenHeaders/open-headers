/**
 * RuleContext — provides V5 rules to all popup components.
 *
 * Rules come from the background service worker (which receives them
 * from the desktop app via WebSocket, or manages them locally).
 * The popup uses V5.Rule types directly from @openheaders/core.
 */

import type { V5 } from '@openheaders/core/types';
import { runtime, storage } from '@utils/browser-api';
import { sendMessageWithCallback } from '@utils/messaging';
import type React from 'react';
import { createContext, useCallback, useEffect, useState } from 'react';

// ── Context shape ─────────────────────────────────────────────────

export interface UiState {
  tableState: {
    searchText: string;
    filteredInfo: Record<string, unknown>;
    sortedInfo: Record<string, unknown>;
  };
  [key: string]: unknown;
}

export interface HeaderContextValue {
  /** All rules from the background (desktop + local). */
  rules: V5.Rule[];
  /** Whether the desktop app is connected via WebSocket. */
  isConnected: boolean;
  /** Whether initial state has been loaded. */
  isStatusLoaded: boolean;
  /** UI state persisted across popup open/close. */
  uiState: UiState;
  /** Tag groups that are disabled (rules in these groups are not applied). */
  disabledTagGroups: Set<string>;
  /** Toggle a tag group on/off. */
  toggleTagGroup: (tagGroup: string) => void;
  /** Force-refresh rules from the background. */
  refreshRules: () => void;
  /** Update persisted UI state. */
  updateUiState: (updates: Partial<UiState>) => void;
}

const defaultContextValue: HeaderContextValue = {
  rules: [],
  isConnected: false,
  isStatusLoaded: false,
  uiState: {
    tableState: {
      searchText: '',
      filteredInfo: {},
      sortedInfo: {},
    },
  },
  disabledTagGroups: new Set(),
  toggleTagGroup: () => {},
  refreshRules: () => {},
  updateUiState: () => {},
};

export const HeaderContext = createContext<HeaderContextValue>(defaultContextValue);

// ── Provider ──────────────────────────────────────────────────────

interface HeaderProviderProps {
  children: React.ReactNode;
}

export const HeaderProvider: React.FC<HeaderProviderProps> = ({ children }) => {
  const [rules, setRules] = useState<V5.Rule[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isStatusLoaded, setIsStatusLoaded] = useState(false);
  const [uiState, setUiState] = useState<UiState>({
    tableState: { searchText: '', filteredInfo: {}, sortedInfo: {} },
  });
  const [disabledTagGroups, setDisabledTagGroups] = useState<Set<string>>(new Set());

  // ── Load rules from background ────────────────────────────────

  const loadRules = useCallback(() => {
    sendMessageWithCallback({ type: 'popupOpen' }, (response, error) => {
      if (!error && response) {
        const resp = response as { rules?: V5.Rule[]; connected?: boolean };
        setRules(resp.rules ?? []);
        setIsConnected(resp.connected ?? false);
        setIsStatusLoaded(true);
      } else {
        setIsConnected(false);
        setIsStatusLoaded(true);
      }
    });
  }, []);

  const refreshRules = useCallback(() => {
    loadRules();
  }, [loadRules]);

  // ── Lifecycle ─────────────────────────────────────────────────

  useEffect(() => {
    loadRules();

    // Load disabled tag groups
    storage.local.get(['disabledTagGroups'], (result: Record<string, unknown>) => {
      const groups = result.disabledTagGroups as string[] | undefined;
      if (Array.isArray(groups)) {
        setDisabledTagGroups(new Set(groups));
      }
    });

    // Listen for rule updates from background (pushed when desktop sends new rules)
    const messageListener = (message: { type?: string; rules?: V5.Rule[] }) => {
      if (message.type === 'rulesUpdated' && Array.isArray(message.rules)) {
        setRules(message.rules);
      } else if (message.type === 'connectionStatus') {
        setIsConnected((message as { connected?: boolean }).connected ?? false);
      }
    };

    runtime.onMessage.addListener(
      messageListener as (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: unknown) => void,
      ) => void,
    );

    // Listen for disabled tag group changes
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes.disabledTagGroups) {
        const groups = (changes.disabledTagGroups.newValue as string[]) || [];
        setDisabledTagGroups(new Set(groups));
      }
    };
    storage.onChanged.addListener(handleStorageChange);

    // Periodic refresh (connection status can change)
    const intervalId = setInterval(loadRules, 5000);

    return () => {
      runtime.onMessage.removeListener(
        messageListener as (
          message: unknown,
          sender: chrome.runtime.MessageSender,
          sendResponse: (response?: unknown) => void,
        ) => void,
      );
      storage.onChanged.removeListener(handleStorageChange);
      clearInterval(intervalId);
    };
  }, [loadRules]);

  // ── UI state persistence ──────────────────────────────────────

  useEffect(() => {
    storage.local.get(['popupState'], (result: Record<string, unknown>) => {
      const popupState = result.popupState as { uiState?: Partial<UiState> } | undefined;
      if (popupState?.uiState) {
        setUiState((prev) => ({ ...prev, ...popupState.uiState }));
      }
    });
  }, []);

  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      storage.local.get(['popupState'], (result: Record<string, unknown>) => {
        const popupState = (result.popupState || {}) as Record<string, unknown>;
        storage.local.set({ popupState: { ...popupState, uiState } });
      });
    }, 500);
    return () => clearTimeout(saveTimeout);
  }, [uiState]);

  const updateUiState = useCallback((updates: Partial<UiState>) => {
    setUiState((prev) => ({ ...prev, ...updates }));
  }, []);

  // ── Tag group management ──────────────────────────────────────

  // Prune stale disabled groups when rules change
  useEffect(() => {
    if (disabledTagGroups.size === 0) return;
    const activeTags = new Set<string>();
    for (const rule of rules) {
      activeTags.add(rule.tags[0] ?? '__no_tag__');
    }
    const stale = [...disabledTagGroups].filter((tag) => !activeTags.has(tag));
    if (stale.length === 0) return;
    setDisabledTagGroups((prev) => {
      const next = new Set(prev);
      for (const tag of stale) next.delete(tag);
      storage.local.set({ disabledTagGroups: [...next] });
      return next;
    });
  }, [rules, disabledTagGroups]);

  const toggleTagGroup = useCallback((tagGroup: string) => {
    setDisabledTagGroups((prev) => {
      const next = new Set(prev);
      if (next.has(tagGroup)) {
        next.delete(tagGroup);
      } else {
        next.add(tagGroup);
      }
      storage.local.set({ disabledTagGroups: [...next] });
      return next;
    });
  }, []);

  // ── Render ────────────────────────────────────────────────────

  const contextValue: HeaderContextValue = {
    rules,
    isConnected,
    isStatusLoaded,
    uiState,
    disabledTagGroups,
    toggleTagGroup,
    refreshRules,
    updateUiState,
  };

  return <HeaderContext.Provider value={contextValue}>{children}</HeaderContext.Provider>;
};
