/**
 * RuleContext — provides V5 rules to all popup components.
 *
 * Rules come from the background service worker (which receives them
 * from the desktop app via WebSocket, or manages them locally).
 * The popup uses V5.Rule types directly from @openheaders/core.
 */

import type { V5 } from '@openheaders/core/types';
import type { PauseMarker } from '@openheaders/core/utils';
import { computePausedUids, resolvePauseState } from '@openheaders/core/utils';
import { call, subscribe } from '@utils/bridge';
import { storage } from '@utils/browser-api';
import type React from 'react';
import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

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
  /**
   * Pause state map — every collection/folder path that has an explicit
   * marker. 'paused' pauses the subtree; 'unpaused' is an override that
   * forces the subtree active even if an ancestor is paused. A path with
   * no marker inherits from its closest marked ancestor.
   */
  pauseMarkers: ReadonlyMap<string, PauseMarker>;
  /**
   * Uids of every node (collection / folder / rule) that is effectively
   * paused after marker resolution. Lets UI code answer "is this node
   * paused?" with a single Set lookup.
   */
  pausedUids: Set<string>;
  /**
   * Smart toggle: flips the effective pause state of `path` by setting
   * the opposite marker. Idempotent for the same effective outcome —
   * pressing twice returns to the original state.
   */
  togglePause: (path: string) => void;
  /** Remove the explicit marker on `path` so it inherits from its parent. */
  clearPauseOverride: (path: string) => void;
  /** Remove every marker strictly below `path` — power-user cleanup. */
  clearNestedPauseOverrides: (path: string) => void;
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
  pauseMarkers: new Map(),
  pausedUids: new Set(),
  localCollections: [],
  localCollectionTrees: [],
  togglePause: () => {},
  clearPauseOverride: () => {},
  clearNestedPauseOverrides: () => {},
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
  const [pauseMarkers, setPauseMarkers] = useState<Map<string, PauseMarker>>(() => new Map());
  const [localCollections, setLocalCollections] = useState<V5.Collection[]>([]);
  const [localCollectionTrees, setLocalCollectionTrees] = useState<V5.CollectionTree[]>([]);
  const [templates, setTemplates] = useState<V5.Template[]>([]);
  const [templateCollections, setTemplateCollections] = useState<V5.Collection[]>([]);
  const [templateCollectionTrees, setTemplateCollectionTrees] = useState<V5.CollectionTree[]>([]);

  // ── Load rules from background ────────────────────────────────

  const loadRules = useCallback(() => {
    call('popupOpen')
      .then((resp) => {
        setRules(resp.rules ?? []);
        setIsConnected(resp.connected ?? false);
        setIsStatusLoaded(true);
      })
      .catch(() => {
        setIsConnected(false);
        setIsStatusLoaded(true);
      });
  }, []);

  const loadLocalCollections = useCallback(() => {
    call('getLocalCollections')
      .then((resp) => setLocalCollections(resp.collections ?? []))
      .catch(() => undefined);
    call('getLocalCollectionTrees')
      .then((resp) => setLocalCollectionTrees(resp.collectionTrees ?? []))
      .catch(() => undefined);
  }, []);

  const loadTemplateData = useCallback(() => {
    call('getTemplates')
      .then((resp) => setTemplates(resp.templates ?? []))
      .catch(() => undefined);
    call('getTemplateCollections')
      .then((resp) => setTemplateCollections(resp.collections ?? []))
      .catch(() => undefined);
    call('getTemplateCollectionTrees')
      .then((resp) => setTemplateCollectionTrees(resp.collectionTrees ?? []))
      .catch(() => undefined);
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

    // Load pause markers
    storage.local.get(['pauseMarkers'], (result: Record<string, unknown>) => {
      const record = result.pauseMarkers as Record<string, PauseMarker> | undefined;
      if (record && typeof record === 'object') {
        setPauseMarkers(new Map(Object.entries(record)));
      }
    });

    // Listen for rule/template updates from background (pushed on any store mutation)
    const unsubRules = subscribe('rulesUpdated', (payload) => {
      if (Array.isArray(payload.rules)) setRules(payload.rules);
      loadLocalCollections();
    });
    const unsubTemplates = subscribe('templatesUpdated', (payload) => {
      if (Array.isArray(payload.templates)) setTemplates(payload.templates);
      loadTemplateData();
    });
    const unsubConnection = subscribe('connectionStatus', (payload) => {
      setIsConnected(payload.connected ?? false);
    });

    // Listen for pause marker changes
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes.pauseMarkers) {
        const record = (changes.pauseMarkers.newValue as Record<string, PauseMarker>) || {};
        setPauseMarkers(new Map(Object.entries(record)));
      }
    };
    storage.onChanged.addListener(handleStorageChange);

    // Periodic refresh (connection status can change)
    const intervalId = setInterval(loadRules, 5000);

    return () => {
      unsubRules();
      unsubTemplates();
      unsubConnection();
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

  // ── Pause marker management ───────────────────────────────────
  //
  // Single mutator: every action funnels through `mutatePauseMarkers`,
  // which produces the next Map, persists it to storage, and updates
  // local state in one shot. Keeps the storage write co-located with
  // the state transition so the two never drift.

  const mutatePauseMarkers = useCallback(
    (mutator: (prev: ReadonlyMap<string, PauseMarker>) => Map<string, PauseMarker>) => {
      setPauseMarkers((prev) => {
        const next = mutator(prev);
        storage.local.set({ pauseMarkers: Object.fromEntries(next) });
        return next;
      });
    },
    [],
  );

  // Prune stale marker paths when collections change. A marker is stale
  // when its path no longer corresponds to any known collection or folder.
  useEffect(() => {
    if (pauseMarkers.size === 0) return;
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
    const stale: string[] = [];
    for (const key of pauseMarkers.keys()) {
      if (!activePaths.has(key)) stale.push(key);
    }
    if (stale.length === 0) return;
    mutatePauseMarkers((prev) => {
      const next = new Map(prev);
      for (const k of stale) next.delete(k);
      return next;
    });
  }, [localCollectionTrees, pauseMarkers, mutatePauseMarkers]);

  const togglePause = useCallback(
    (path: string) => {
      mutatePauseMarkers((prev) => {
        const next = new Map(prev);
        const currentlyPaused = resolvePauseState(path, prev);
        // Smart toggle: if any explicit marker matches the *opposite* of
        // the current effective state would already be a no-op, so we set
        // the marker that flips the state. Setting the marker even when
        // it matches the inherited default is intentional — it pins the
        // state so a parent toggle can't silently flip it back.
        next.set(path, currentlyPaused ? 'unpaused' : 'paused');
        return next;
      });
    },
    [mutatePauseMarkers],
  );

  const clearPauseOverride = useCallback(
    (path: string) => {
      mutatePauseMarkers((prev) => {
        if (!prev.has(path)) return new Map(prev);
        const next = new Map(prev);
        next.delete(path);
        return next;
      });
    },
    [mutatePauseMarkers],
  );

  const clearNestedPauseOverrides = useCallback(
    (path: string) => {
      mutatePauseMarkers((prev) => {
        const prefix = `${path}/`;
        const next = new Map<string, PauseMarker>();
        for (const [key, value] of prev) {
          if (!key.startsWith(prefix)) next.set(key, value);
        }
        return next;
      });
    },
    [mutatePauseMarkers],
  );

  // ── Local rule CRUD ───────────────────────────────────────────

  // ── Local CRUD ─────────────────────────────────────────────────
  // Every successful mutation calls refreshRules() which reloads both
  // rules and collections. This is the single consistent pattern —
  // no per-function guessing about which subset to reload.

  const createLocalRule = useCallback(
    async (
      rule: Omit<V5.Rule, 'uid' | 'path'>,
      collectionUid?: string,
      parentPath?: string,
    ): Promise<V5.Rule | null> => {
      const resp = await call('createLocalRule', { rule, collectionUid, parentPath }).catch(() => null);
      if (resp?.success && resp.rule) {
        refreshRules();
        return resp.rule;
      }
      return null;
    },
    [refreshRules],
  );

  const updateLocalRuleFn = useCallback(
    async (uid: string, updates: Partial<Omit<V5.Rule, 'uid' | 'path'>>): Promise<boolean> => {
      const resp = await call('updateLocalRule', { ruleId: uid, updates }).catch(() => null);
      if (resp?.success) {
        refreshRules();
        return true;
      }
      return false;
    },
    [refreshRules],
  );

  const deleteLocalRuleFn = useCallback(
    async (uid: string): Promise<boolean> => {
      const resp = await call('deleteRule', { ruleId: uid }).catch(() => null);
      if (resp?.success) {
        refreshRules();
        return true;
      }
      return false;
    },
    [refreshRules],
  );

  const createLocalCollectionFn = useCallback(
    async (name: string): Promise<V5.Collection | null> => {
      const resp = await call('createLocalCollection', { name }).catch(() => null);
      if (resp?.success && resp.collection) {
        refreshRules();
        return resp.collection;
      }
      return null;
    },
    [refreshRules],
  );

  const renameLocalCollectionFn = useCallback(
    async (uid: string, name: string): Promise<boolean> => {
      const resp = await call('renameLocalCollection', { collectionUid: uid, name }).catch(() => null);
      if (resp?.success) {
        refreshRules();
        return true;
      }
      return false;
    },
    [refreshRules],
  );

  const deleteLocalCollectionFn = useCallback(
    async (uid: string): Promise<boolean> => {
      const resp = await call('deleteLocalCollection', { collectionUid: uid }).catch(() => null);
      if (resp?.success) {
        refreshRules();
        return true;
      }
      return false;
    },
    [refreshRules],
  );

  const createLocalFolderFn = useCallback(
    async (name: string, parentPath: string): Promise<{ uid: string; path: string; name: string } | null> => {
      const resp = await call('createLocalFolder', { name, parentPath }).catch(() => null);
      if (resp?.success && resp.folder) {
        refreshRules();
        return resp.folder;
      }
      return null;
    },
    [refreshRules],
  );

  const renameLocalFolderFn = useCallback(
    async (uid: string, name: string): Promise<boolean> => {
      const resp = await call('renameLocalFolder', { folderUid: uid, name }).catch(() => null);
      if (resp?.success) {
        refreshRules();
        return true;
      }
      return false;
    },
    [refreshRules],
  );

  const deleteLocalFolderFn = useCallback(
    async (uid: string): Promise<boolean> => {
      const resp = await call('deleteLocalFolder', { folderUid: uid }).catch(() => null);
      if (resp?.success) {
        refreshRules();
        return true;
      }
      return false;
    },
    [refreshRules],
  );

  // ── Template CRUD ─────────────────────────────────────────────

  const createTemplateFn = useCallback(
    async (
      template: Omit<V5.Template, 'uid' | 'path'>,
      collectionUid?: string,
      parentPath?: string,
    ): Promise<V5.Template | null> => {
      const resp = await call('createTemplate', { template, collectionUid, parentPath }).catch(() => null);
      if (resp?.success && resp.template) {
        refreshRules();
        return resp.template;
      }
      return null;
    },
    [refreshRules],
  );

  const updateTemplateFn = useCallback(
    async (uid: string, updates: Partial<Omit<V5.Template, 'uid' | 'path'>>): Promise<boolean> => {
      const resp = await call('updateTemplate', { templateUid: uid, updates }).catch(() => null);
      if (resp?.success) {
        refreshRules();
        return true;
      }
      return false;
    },
    [refreshRules],
  );

  const deleteTemplateFn = useCallback(
    async (uid: string): Promise<boolean> => {
      const resp = await call('deleteTemplate', { templateUid: uid }).catch(() => null);
      if (resp?.success) {
        refreshRules();
        return true;
      }
      return false;
    },
    [refreshRules],
  );

  const createTemplateCollectionFn = useCallback(
    async (name: string): Promise<V5.Collection | null> => {
      const resp = await call('createTemplateCollection', { name }).catch(() => null);
      if (resp?.success && resp.collection) {
        refreshRules();
        return resp.collection;
      }
      return null;
    },
    [refreshRules],
  );

  const renameTemplateCollectionFn = useCallback(
    async (uid: string, name: string): Promise<boolean> => {
      const resp = await call('renameTemplateCollection', { collectionUid: uid, name }).catch(() => null);
      if (resp?.success) {
        refreshRules();
        return true;
      }
      return false;
    },
    [refreshRules],
  );

  const deleteTemplateCollectionFn = useCallback(
    async (uid: string): Promise<boolean> => {
      const resp = await call('deleteTemplateCollection', { collectionUid: uid }).catch(() => null);
      if (resp?.success) {
        refreshRules();
        return true;
      }
      return false;
    },
    [refreshRules],
  );

  const createTemplateFolderFn = useCallback(
    async (name: string, parentPath: string): Promise<{ uid: string; path: string; name: string } | null> => {
      const resp = await call('createTemplateFolder', { name, parentPath }).catch(() => null);
      if (resp?.success && resp.folder) {
        refreshRules();
        return resp.folder;
      }
      return null;
    },
    [refreshRules],
  );

  const renameTemplateFolderFn = useCallback(
    async (uid: string, name: string): Promise<boolean> => {
      const resp = await call('renameTemplateFolder', { folderUid: uid, name }).catch(() => null);
      if (resp?.success) {
        refreshRules();
        return true;
      }
      return false;
    },
    [refreshRules],
  );

  const deleteTemplateFolderFn = useCallback(
    async (uid: string): Promise<boolean> => {
      const resp = await call('deleteTemplateFolder', { folderUid: uid }).catch(() => null);
      if (resp?.success) {
        refreshRules();
        return true;
      }
      return false;
    },
    [refreshRules],
  );

  // ── Render ────────────────────────────────────────────────────

  const pausedUids = useMemo(
    () => computePausedUids(localCollectionTrees, pauseMarkers),
    [localCollectionTrees, pauseMarkers],
  );

  const contextValue: RuleContextValue = {
    rules,
    isConnected,
    isStatusLoaded,
    uiState,
    pauseMarkers,
    pausedUids,
    localCollections,
    localCollectionTrees,
    togglePause,
    clearPauseOverride,
    clearNestedPauseOverrides,
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
