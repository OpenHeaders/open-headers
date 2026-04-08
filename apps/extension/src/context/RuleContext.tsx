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
    sortMode: string;
    filteredInfo: Record<string, unknown>;
    sortedInfo: Record<string, unknown>;
  };
  [key: string]: unknown;
}

export interface RuleContextValue {
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
  /** Local collections (flat, without tree). */
  localCollections: V5.Collection[];
  /** Local collection trees (with folder → rule hierarchy). */
  localCollectionTrees: V5.CollectionTree[];
  /** Create a local rule (extension standalone). */
  /** Create a local rule. Provide collectionUid or parentPath (folder path) to control placement. */
  createLocalRule: (
    rule: Omit<V5.Rule, 'uid' | 'path'>,
    collectionUid?: string,
    parentPath?: string,
  ) => Promise<V5.Rule | null>;
  /** Update a local rule by uid. */
  updateLocalRule: (uid: string, updates: Partial<Omit<V5.Rule, 'uid' | 'path'>>) => Promise<boolean>;
  /** Delete a local rule by uid. */
  deleteLocalRule: (uid: string) => Promise<boolean>;
  /** Create a local collection. */
  createLocalCollection: (name: string) => Promise<V5.Collection | null>;
  /** Rename a local collection. */
  renameLocalCollection: (uid: string, name: string) => Promise<boolean>;
  /** Delete a local collection and all its contents. */
  deleteLocalCollection: (uid: string) => Promise<boolean>;
  /** Create a folder within a collection or another folder. */
  createLocalFolder: (name: string, parentPath: string) => Promise<{ uid: string; path: string; name: string } | null>;
  /** Rename a local folder. */
  renameLocalFolder: (uid: string, name: string) => Promise<boolean>;
  /** Delete a local folder and its contents. */
  deleteLocalFolder: (uid: string) => Promise<boolean>;
}

const defaultContextValue: RuleContextValue = {
  rules: [],
  isConnected: false,
  isStatusLoaded: false,
  uiState: {
    tableState: {
      searchText: '',
      sortMode: 'status',
      filteredInfo: {},
      sortedInfo: {},
    },
  },
  disabledTagGroups: new Set(),
  localCollections: [],
  localCollectionTrees: [],
  toggleTagGroup: () => {},
  refreshRules: () => {},
  updateUiState: () => {},
  createLocalRule: () => Promise.resolve(null),
  updateLocalRule: () => Promise.resolve(false),
  deleteLocalRule: () => Promise.resolve(false),
  createLocalCollection: () => Promise.resolve(null),
  renameLocalCollection: () => Promise.resolve(false),
  deleteLocalCollection: () => Promise.resolve(false),
  createLocalFolder: () => Promise.resolve(null),
  renameLocalFolder: () => Promise.resolve(false),
  deleteLocalFolder: () => Promise.resolve(false),
};

export const RuleContext = createContext<RuleContextValue>(defaultContextValue);

// ── Provider ──────────────────────────────────────────────────────

interface RuleProviderProps {
  children: React.ReactNode;
}

export const RuleProvider: React.FC<RuleProviderProps> = ({ children }) => {
  const [rules, setRules] = useState<V5.Rule[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isStatusLoaded, setIsStatusLoaded] = useState(false);
  const [uiState, setUiState] = useState<UiState>({
    tableState: { searchText: '', sortMode: 'status', filteredInfo: {}, sortedInfo: {} },
  });
  const [disabledTagGroups, setDisabledTagGroups] = useState<Set<string>>(new Set());
  const [localCollections, setLocalCollections] = useState<V5.Collection[]>([]);
  const [localCollectionTrees, setLocalCollectionTrees] = useState<V5.CollectionTree[]>([]);

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

  const loadLocalCollections = useCallback(() => {
    sendMessageWithCallback({ type: 'getLocalCollections' }, (response, error) => {
      if (!error && response) {
        const resp = response as { collections?: V5.Collection[] };
        setLocalCollections(resp.collections ?? []);
      }
    });
    sendMessageWithCallback({ type: 'getLocalCollectionTrees' }, (response, error) => {
      if (!error && response) {
        const resp = response as { collectionTrees?: V5.CollectionTree[] };
        setLocalCollectionTrees(resp.collectionTrees ?? []);
      }
    });
  }, []);

  const refreshRules = useCallback(() => {
    loadRules();
    loadLocalCollections();
  }, [loadRules, loadLocalCollections]);

  // ── Lifecycle ─────────────────────────────────────────────────

  useEffect(() => {
    loadRules();
    loadLocalCollections();

    // Load disabled tag groups
    storage.local.get(['disabledTagGroups'], (result: Record<string, unknown>) => {
      const groups = result.disabledTagGroups as string[] | undefined;
      if (Array.isArray(groups)) {
        setDisabledTagGroups(new Set(groups));
      }
    });

    // Listen for rule updates from background (pushed on any store mutation)
    const messageListener = (message: { type?: string; rules?: V5.Rule[] }) => {
      if (message.type === 'rulesUpdated' && Array.isArray(message.rules)) {
        setRules(message.rules);
        // Collections/folders may have changed too (delete, rename, create)
        loadLocalCollections();
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
  }, [loadRules, loadLocalCollections]);

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

  // ── Local rule CRUD ───────────────────────────────────────────

  // ── Local CRUD ─────────────────────────────────────────────────
  // Every successful mutation calls refreshRules() which reloads both
  // rules and collections. This is the single consistent pattern —
  // no per-function guessing about which subset to reload.

  const createLocalRule = useCallback(
    (rule: Omit<V5.Rule, 'uid' | 'path'>, collectionUid?: string, parentPath?: string): Promise<V5.Rule | null> => {
      return new Promise((resolve) => {
        sendMessageWithCallback({ type: 'createLocalRule', rule, collectionUid, parentPath }, (response, error) => {
          if (!error && response) {
            const resp = response as { success?: boolean; rule?: V5.Rule };
            if (resp.success && resp.rule) {
              refreshRules();
              resolve(resp.rule);
              return;
            }
          }
          resolve(null);
        });
      });
    },
    [refreshRules],
  );

  const updateLocalRuleFn = useCallback(
    (uid: string, updates: Partial<Omit<V5.Rule, 'uid' | 'path'>>): Promise<boolean> => {
      return new Promise((resolve) => {
        sendMessageWithCallback({ type: 'updateLocalRule', ruleId: uid, updates }, (response, error) => {
          if (!error && response && (response as { success?: boolean }).success) {
            refreshRules();
            resolve(true);
            return;
          }
          resolve(false);
        });
      });
    },
    [refreshRules],
  );

  const deleteLocalRuleFn = useCallback(
    (uid: string): Promise<boolean> => {
      return new Promise((resolve) => {
        sendMessageWithCallback({ type: 'deleteRule', ruleId: uid }, (response, error) => {
          if (!error && response && (response as { success?: boolean }).success) {
            refreshRules();
            resolve(true);
            return;
          }
          resolve(false);
        });
      });
    },
    [refreshRules],
  );

  const createLocalCollectionFn = useCallback(
    (name: string): Promise<V5.Collection | null> => {
      return new Promise((resolve) => {
        sendMessageWithCallback({ type: 'createLocalCollection', name }, (response, error) => {
          if (!error && response) {
            const resp = response as { success?: boolean; collection?: V5.Collection };
            if (resp.success && resp.collection) {
              refreshRules();
              resolve(resp.collection);
              return;
            }
          }
          resolve(null);
        });
      });
    },
    [refreshRules],
  );

  const renameLocalCollectionFn = useCallback(
    (uid: string, name: string): Promise<boolean> => {
      return new Promise((resolve) => {
        sendMessageWithCallback({ type: 'renameLocalCollection', collectionUid: uid, name }, (response, error) => {
          if (!error && response && (response as { success?: boolean }).success) {
            refreshRules();
            resolve(true);
            return;
          }
          resolve(false);
        });
      });
    },
    [refreshRules],
  );

  const deleteLocalCollectionFn = useCallback(
    (uid: string): Promise<boolean> => {
      return new Promise((resolve) => {
        sendMessageWithCallback({ type: 'deleteLocalCollection', collectionUid: uid }, (response, error) => {
          if (!error && response && (response as { success?: boolean }).success) {
            refreshRules();
            resolve(true);
            return;
          }
          resolve(false);
        });
      });
    },
    [refreshRules],
  );

  const createLocalFolderFn = useCallback(
    (name: string, parentPath: string): Promise<{ uid: string; path: string; name: string } | null> => {
      return new Promise((resolve) => {
        sendMessageWithCallback({ type: 'createLocalFolder', name, parentPath }, (response, error) => {
          if (!error && response) {
            const resp = response as { success?: boolean; folder?: { uid: string; path: string; name: string } };
            if (resp.success && resp.folder) {
              refreshRules();
              resolve(resp.folder);
              return;
            }
          }
          resolve(null);
        });
      });
    },
    [refreshRules],
  );

  const renameLocalFolderFn = useCallback(
    (uid: string, name: string): Promise<boolean> => {
      return new Promise((resolve) => {
        sendMessageWithCallback({ type: 'renameLocalFolder', folderUid: uid, name }, (response, error) => {
          if (!error && response && (response as { success?: boolean }).success) {
            refreshRules();
            resolve(true);
            return;
          }
          resolve(false);
        });
      });
    },
    [refreshRules],
  );

  const deleteLocalFolderFn = useCallback(
    (uid: string): Promise<boolean> => {
      return new Promise((resolve) => {
        sendMessageWithCallback({ type: 'deleteLocalFolder', folderUid: uid }, (response, error) => {
          if (!error && response && (response as { success?: boolean }).success) {
            refreshRules();
            resolve(true);
            return;
          }
          resolve(false);
        });
      });
    },
    [refreshRules],
  );

  // ── Render ────────────────────────────────────────────────────

  const contextValue: RuleContextValue = {
    rules,
    isConnected,
    isStatusLoaded,
    uiState,
    disabledTagGroups,
    localCollections,
    localCollectionTrees,
    toggleTagGroup,
    refreshRules,
    updateUiState,
    createLocalRule,
    updateLocalRule: updateLocalRuleFn,
    deleteLocalRule: deleteLocalRuleFn,
    createLocalCollection: createLocalCollectionFn,
    renameLocalCollection: renameLocalCollectionFn,
    deleteLocalCollection: deleteLocalCollectionFn,
    createLocalFolder: createLocalFolderFn,
    renameLocalFolder: renameLocalFolderFn,
    deleteLocalFolder: deleteLocalFolderFn,
  };

  return <RuleContext.Provider value={contextValue}>{children}</RuleContext.Provider>;
};
