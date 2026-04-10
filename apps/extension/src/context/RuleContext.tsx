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
  /** Paused collection/folder paths — rules under these are not applied. */
  pausedGroups: Set<string>;
  /** Toggle a collection or folder pause on/off (by path). */
  toggleGroupPause: (path: string) => void;
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
  // ── Templates ─────────────────────────────────────────────────────
  /** All user-defined templates. */
  templates: V5.Template[];
  /** Template collections (flat). */
  templateCollections: V5.Collection[];
  /** Template collection trees (with folder → template hierarchy). */
  templateCollectionTrees: V5.CollectionTree[];
  /** Create a template. */
  createTemplate: (
    template: Omit<V5.Template, 'uid' | 'path'>,
    collectionUid?: string,
    parentPath?: string,
  ) => Promise<V5.Template | null>;
  /** Update a template by uid. */
  updateTemplate: (uid: string, updates: Partial<Omit<V5.Template, 'uid' | 'path'>>) => Promise<boolean>;
  /** Delete a template by uid. */
  deleteTemplate: (uid: string) => Promise<boolean>;
  /** Create a template collection. */
  createTemplateCollection: (name: string) => Promise<V5.Collection | null>;
  /** Rename a template collection. */
  renameTemplateCollection: (uid: string, name: string) => Promise<boolean>;
  /** Delete a template collection and all its contents. */
  deleteTemplateCollection: (uid: string) => Promise<boolean>;
  /** Create a folder within a template collection. */
  createTemplateFolder: (
    name: string,
    parentPath: string,
  ) => Promise<{ uid: string; path: string; name: string } | null>;
  /** Rename a template folder. */
  renameTemplateFolder: (uid: string, name: string) => Promise<boolean>;
  /** Delete a template folder and its contents. */
  deleteTemplateFolder: (uid: string) => Promise<boolean>;
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
  pausedGroups: new Set(),
  localCollections: [],
  localCollectionTrees: [],
  toggleGroupPause: () => {},
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
  templates: [],
  templateCollections: [],
  templateCollectionTrees: [],
  createTemplate: () => Promise.resolve(null),
  updateTemplate: () => Promise.resolve(false),
  deleteTemplate: () => Promise.resolve(false),
  createTemplateCollection: () => Promise.resolve(null),
  renameTemplateCollection: () => Promise.resolve(false),
  deleteTemplateCollection: () => Promise.resolve(false),
  createTemplateFolder: () => Promise.resolve(null),
  renameTemplateFolder: () => Promise.resolve(false),
  deleteTemplateFolder: () => Promise.resolve(false),
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
  const [pausedGroups, setPausedGroups] = useState<Set<string>>(new Set());
  const [localCollections, setLocalCollections] = useState<V5.Collection[]>([]);
  const [localCollectionTrees, setLocalCollectionTrees] = useState<V5.CollectionTree[]>([]);
  const [templates, setTemplates] = useState<V5.Template[]>([]);
  const [templateCollections, setTemplateCollections] = useState<V5.Collection[]>([]);
  const [templateCollectionTrees, setTemplateCollectionTrees] = useState<V5.CollectionTree[]>([]);

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

  const loadTemplateData = useCallback(() => {
    sendMessageWithCallback({ type: 'getTemplates' }, (response, error) => {
      if (!error && response) {
        const resp = response as { templates?: V5.Template[] };
        setTemplates(resp.templates ?? []);
      }
    });
    sendMessageWithCallback({ type: 'getTemplateCollections' }, (response, error) => {
      if (!error && response) {
        const resp = response as { collections?: V5.Collection[] };
        setTemplateCollections(resp.collections ?? []);
      }
    });
    sendMessageWithCallback({ type: 'getTemplateCollectionTrees' }, (response, error) => {
      if (!error && response) {
        const resp = response as { collectionTrees?: V5.CollectionTree[] };
        setTemplateCollectionTrees(resp.collectionTrees ?? []);
      }
    });
  }, []);

  const refreshRules = useCallback(() => {
    loadRules();
    loadLocalCollections();
    loadTemplateData();
  }, [loadRules, loadLocalCollections, loadTemplateData]);

  // ── Lifecycle ─────────────────────────────────────────────────

  useEffect(() => {
    loadRules();
    loadLocalCollections();
    loadTemplateData();

    // Load paused collection/folder paths
    storage.local.get(['pausedGroups'], (result: Record<string, unknown>) => {
      const paths = result.pausedGroups as string[] | undefined;
      if (Array.isArray(paths)) {
        setPausedGroups(new Set(paths));
      }
    });

    // Listen for rule/template updates from background (pushed on any store mutation)
    const messageListener = (message: { type?: string; rules?: V5.Rule[]; templates?: V5.Template[] }) => {
      if (message.type === 'rulesUpdated' && Array.isArray(message.rules)) {
        setRules(message.rules);
        loadLocalCollections();
      } else if (message.type === 'templatesUpdated') {
        if (Array.isArray(message.templates)) setTemplates(message.templates);
        loadTemplateData();
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

    // Listen for paused groups changes
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes.pausedGroups) {
        const paths = (changes.pausedGroups.newValue as string[]) || [];
        setPausedGroups(new Set(paths));
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
  }, [loadRules, loadLocalCollections, loadTemplateData]);

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

  // ── Collection/folder pause management ─────────────────────────

  // Prune stale paused paths when collections change
  useEffect(() => {
    if (pausedGroups.size === 0) return;
    const activePaths = new Set<string>();
    for (const tree of localCollectionTrees) {
      activePaths.add(tree.path);
      const addFolderPaths = (nodes: V5.TreeNode[]) => {
        for (const node of nodes) {
          if (node.type === 'folder') {
            activePaths.add(node.path);
            addFolderPaths(node.children);
          }
        }
      };
      addFolderPaths(tree.tree);
    }
    const stale = [...pausedGroups].filter((p) => !activePaths.has(p));
    if (stale.length === 0) return;
    setPausedGroups((prev) => {
      const next = new Set(prev);
      for (const p of stale) next.delete(p);
      storage.local.set({ pausedGroups: [...next] });
      return next;
    });
  }, [localCollectionTrees, pausedGroups]);

  const toggleGroupPause = useCallback((path: string) => {
    setPausedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      storage.local.set({ pausedGroups: [...next] });
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

  // ── Template CRUD ─────────────────────────────────────────────

  const createTemplateFn = useCallback(
    (
      template: Omit<V5.Template, 'uid' | 'path'>,
      collectionUid?: string,
      parentPath?: string,
    ): Promise<V5.Template | null> => {
      return new Promise((resolve) => {
        sendMessageWithCallback({ type: 'createTemplate', template, collectionUid, parentPath }, (response, error) => {
          if (!error && response) {
            const resp = response as { success?: boolean; template?: V5.Template };
            if (resp.success && resp.template) {
              refreshRules();
              resolve(resp.template);
              return;
            }
          }
          resolve(null);
        });
      });
    },
    [refreshRules],
  );

  const updateTemplateFn = useCallback(
    (uid: string, updates: Partial<Omit<V5.Template, 'uid' | 'path'>>): Promise<boolean> => {
      return new Promise((resolve) => {
        sendMessageWithCallback({ type: 'updateTemplate', templateUid: uid, updates }, (response, error) => {
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

  const deleteTemplateFn = useCallback(
    (uid: string): Promise<boolean> => {
      return new Promise((resolve) => {
        sendMessageWithCallback({ type: 'deleteTemplate', templateUid: uid }, (response, error) => {
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

  const createTemplateCollectionFn = useCallback(
    (name: string): Promise<V5.Collection | null> => {
      return new Promise((resolve) => {
        sendMessageWithCallback({ type: 'createTemplateCollection', name }, (response, error) => {
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

  const renameTemplateCollectionFn = useCallback(
    (uid: string, name: string): Promise<boolean> => {
      return new Promise((resolve) => {
        sendMessageWithCallback({ type: 'renameTemplateCollection', collectionUid: uid, name }, (response, error) => {
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

  const deleteTemplateCollectionFn = useCallback(
    (uid: string): Promise<boolean> => {
      return new Promise((resolve) => {
        sendMessageWithCallback({ type: 'deleteTemplateCollection', collectionUid: uid }, (response, error) => {
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

  const createTemplateFolderFn = useCallback(
    (name: string, parentPath: string): Promise<{ uid: string; path: string; name: string } | null> => {
      return new Promise((resolve) => {
        sendMessageWithCallback({ type: 'createTemplateFolder', name, parentPath }, (response, error) => {
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

  const renameTemplateFolderFn = useCallback(
    (uid: string, name: string): Promise<boolean> => {
      return new Promise((resolve) => {
        sendMessageWithCallback({ type: 'renameTemplateFolder', folderUid: uid, name }, (response, error) => {
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

  const deleteTemplateFolderFn = useCallback(
    (uid: string): Promise<boolean> => {
      return new Promise((resolve) => {
        sendMessageWithCallback({ type: 'deleteTemplateFolder', folderUid: uid }, (response, error) => {
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
    pausedGroups,
    localCollections,
    localCollectionTrees,
    toggleGroupPause,
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
    templates,
    templateCollections,
    templateCollectionTrees,
    createTemplate: createTemplateFn,
    updateTemplate: updateTemplateFn,
    deleteTemplate: deleteTemplateFn,
    createTemplateCollection: createTemplateCollectionFn,
    renameTemplateCollection: renameTemplateCollectionFn,
    deleteTemplateCollection: deleteTemplateCollectionFn,
    createTemplateFolder: createTemplateFolderFn,
    renameTemplateFolder: renameTemplateFolderFn,
    deleteTemplateFolder: deleteTemplateFolderFn,
  };

  return <RuleContext.Provider value={contextValue}>{children}</RuleContext.Provider>;
};
