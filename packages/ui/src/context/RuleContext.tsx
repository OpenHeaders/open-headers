/**
 * RuleContext — provides the active workspace's rules to the popup,
 * sidepanel, and workbench.html surfaces.
 *
 * Data is owned by the background service worker. This context:
 *   1. Fetches the active-workspace snapshot once on mount (popupOpen RPC).
 *   2. Subscribes to `rulesUpdated` / `templatesUpdated` for live mutations.
 *   3. Subscribes to `workspaceChanged` for atomic re-hydration on
 *      workspace switch (and list mutations).
 *   4. Rebinds the pause-markers storage listener to the new workspace
 *      id's key when the active workspace changes.
 */

import type { Collection, CollectionTree, Rule, Template, TreeNode } from '@openheaders/core/types';
import type { PauseMarker } from '@openheaders/core/utils';
import { computePausedUids } from '@openheaders/core/utils';
import { hostBridge } from '@openheaders/core/bridge';
import type React from 'react';
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePauseMarkersContext } from './PauseMarkersContext';
import { useLocalEntityCrud } from './use-local-entity-crud';
import { useTemplateCrud } from './use-template-crud';
import { buildLocalCollectionTrees, buildTemplateCollectionTrees } from '../shared/local-tree-builder';
import { hostStorage, type PersistedLocalFolder, UI, wsKeys } from '@openheaders/core/storage';

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
  rules: Rule[];
  /** Active workspace id, or `null` until the SW reply lands. */
  activeWorkspaceId: string | null;
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
  localCollections: Collection[];
  /** Local collection trees (with folder → rule hierarchy). */
  localCollectionTrees: CollectionTree[];
  /** Update a local rule by uid. */
  updateLocalRule: (uid: string, updates: Partial<Omit<Rule, 'uid' | 'path'>>) => Promise<boolean>;
  /** Delete a local rule by uid. */
  deleteLocalRule: (uid: string) => Promise<boolean>;
  /** Create a local collection. */
  createLocalCollection: (name: string) => Promise<Collection | null>;
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
  templates: Template[];
  /** Template collections (flat). */
  templateCollections: Collection[];
  /** Template collection trees (with folder → template hierarchy). */
  templateCollectionTrees: CollectionTree[];
  /** Create a template. `schemaVersion` + `version` are stamped by the store. */
  createTemplate: (
    template: Omit<Template, 'uid' | 'path' | 'schemaVersion' | 'version'>,
    collectionUid?: string,
    parentPath?: string,
  ) => Promise<Template | null>;
  /** Update a template by uid. */
  updateTemplate: (
    uid: string,
    updates: Partial<Omit<Template, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
  ) => Promise<boolean>;
  /** Delete a template by uid. */
  deleteTemplate: (uid: string) => Promise<boolean>;
  /** Create a template collection. */
  createTemplateCollection: (name: string) => Promise<Collection | null>;
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
  activeWorkspaceId: null,
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
  /**
   * Surface attribution carried on every emitted envelope. Used by the
   * sync engine to identify the originating renderer in awareness +
   * mutation logs.
   */
  surfaceId: string;
  /**
   * Editing-scope workspace id override (workbench surface only).
   *
   * When `undefined`, the provider follows the global oracle: bootstraps
   * `activeWorkspaceId` from `popupOpen` and re-binds on
   * `workspaceChanged` broadcasts. This is the popup / sidepanel path —
   * system-scoped surfaces always show the global default.
   *
   * When defined (workbench mounts it from `useWorkbenchEditingScopeWorkspaceId()`),
   * the provider treats the prop as authoritative for `activeWorkspaceId`,
   * skips the `workspaceChanged` subscription, and routes mutator
   * `workspaceId` writes through the prop. In per-tab mode the prop
   * follows the tab's slice binding (BC-MWPT-5 — diverged tab edits write
   * to `wsKeys(tabWorkspace).rules`, not `wsKeys(globalDefault).rules`).
   */
  activeWorkspaceIdOverride?: string | null;
}

export const RuleProvider: React.FC<RuleProviderProps> = ({ children, surfaceId, activeWorkspaceIdOverride }) => {
  const isOverridden = activeWorkspaceIdOverride !== undefined;
  const [rules, setRules] = useState<Rule[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isStatusLoaded, setIsStatusLoaded] = useState(false);
  const [uiState, setUiState] = useState<UiState>({
    tableState: { searchText: '', sortMode: 'status', filteredInfo: {}, sortedInfo: {} },
  });
  const { pauseMarkers, togglePause, clearPauseOverride, clearNestedPauseOverrides, replaceMarkers } =
    usePauseMarkersContext();
  const [localCollections, setLocalCollections] = useState<Collection[]>([]);
  const [localCollectionTrees, setLocalCollectionTrees] = useState<CollectionTree[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateCollections, setTemplateCollections] = useState<Collection[]>([]);
  const [templateCollectionTrees, setTemplateCollectionTrees] = useState<CollectionTree[]>([]);
  // Workspace id tracked as BOTH ref (used in sync mutators without
  // triggering re-renders) AND state (drives the pause-markers
  // subscription rebind on workspace switch).
  const activeWorkspaceIdRef = useRef<string | null>(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  // Folder lists aren't rendered directly — the trees view is — so they
  // live in refs instead of state, exposed to override-branch mutators
  // that need synchronous parent-ref resolution at write time.
  const foldersRef = useRef<PersistedLocalFolder[]>([]);
  const templateFoldersRef = useRef<PersistedLocalFolder[]>([]);

  // ── Load active workspace snapshot ────────────────────────────
  //
  // Two read paths, picked by `isOverridden`:
  //
  // 1. **Non-override (popup / sidepanel — system surfaces).** Bootstraps
  //    `rules` + connection from `popupOpen`; collections / folders /
  //    templates from `getLocalCollections` / `getTemplates` family RPCs.
  //    The SW computes these against the global default workspace.
  //    `rulesUpdated` / `templatesUpdated` broadcasts drive live updates.
  //    Unchanged from pre-MWPT.
  //
  // 2. **Override (workbench surface).** Reads workspace-scoped data
  //    directly from host storage under `wsKeys(override).*` —
  //    `rules`, `collections`, `folders`, `templates`, `templateCollections`,
  //    `templateFolders`. Trees are composed in the renderer via
  //    `buildLocalCollectionTrees` / `buildTemplateCollectionTrees` (pure
  //    functions over the persisted arrays — same shape as the SW's
  //    boot-fallback path in `rule-store.buildTreeForParent`). The SW
  //    `popupOpen` path returns global-default-scoped data (correct for
  //    system surfaces) so it can't satisfy a diverged tab; reading the
  //    materialized snapshots directly is the discipline-conforming
  //    shape per `SYNC_ENGINE_DESIGN.md` § 9.1 ("Snapshots are the read
  //    path"). Same pattern pause-markers already use.
  //    `hostStorage.subscribe` rebinds when the override id changes;
  //    cross-process / cross-workspace mutations land via host storage
  //    change events regardless of which oracle is currently running.
  //    Connection status still comes from the bridge (system-scoped).

  const loadConnection = useCallback(() => {
    hostBridge.call('popupOpen')
      .then((resp) => {
        setIsConnected(resp.connected ?? false);
      })
      .catch(() => {
        setIsConnected(false);
      });
  }, []);

  const loadRules = useCallback(() => {
    if (isOverridden) {
      // Override branch: per-key storage subscriptions own the full
      // workspace-scoped data load (see effect below). loadRules only
      // mirrors the override id into state and surfaces the connection
      // status — the prior split between this method and the storage
      // effect raced on cold reload (Session 24): two parallel
      // Promise.all paths wrote setLocalCollectionTrees against
      // different snapshot ages, and the loser's empty trees stomped
      // the winner's real ones until the first storage onChanged.
      const effectiveId = activeWorkspaceIdOverride ?? null;
      activeWorkspaceIdRef.current = effectiveId;
      setActiveWorkspaceId(effectiveId);
      setIsStatusLoaded(true);
      loadConnection();
      return;
    }
    hostBridge.call('popupOpen')
      .then((resp) => {
        setRules(resp.rules ?? []);
        setIsConnected(resp.connected ?? false);
        setIsStatusLoaded(true);
        const effectiveId = resp.activeWorkspaceId;
        activeWorkspaceIdRef.current = effectiveId;
        setActiveWorkspaceId(effectiveId);
      })
      .catch(() => {
        setIsConnected(false);
        setIsStatusLoaded(true);
      });
  }, [isOverridden, activeWorkspaceIdOverride, loadConnection]);

  const loadLocalCollections = useCallback(() => {
    if (isOverridden) return; // override branch reads from storage
    hostBridge.call('getLocalCollections')
      .then((resp) => setLocalCollections(resp.collections ?? []))
      .catch(() => undefined);
    hostBridge.call('getLocalCollectionTrees')
      .then((resp) => setLocalCollectionTrees(resp.collectionTrees ?? []))
      .catch(() => undefined);
  }, [isOverridden]);

  const loadTemplateData = useCallback(() => {
    if (isOverridden) return; // override branch reads from storage
    hostBridge.call('getTemplates')
      .then((resp) => setTemplates(resp.templates ?? []))
      .catch(() => undefined);
    hostBridge.call('getTemplateCollections')
      .then((resp) => setTemplateCollections(resp.collections ?? []))
      .catch(() => undefined);
    hostBridge.call('getTemplateCollectionTrees')
      .then((resp) => setTemplateCollectionTrees(resp.collectionTrees ?? []))
      .catch(() => undefined);
  }, [isOverridden]);

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

    // `rulesUpdated` / `templatesUpdated` broadcasts carry the SW's
    // active-workspace data. The popup / sidepanel branch consumes them
    // directly. The workbench override branch ignores them and instead
    // subscribes to `wsKeys(override).*` storage keys (see the
    // override-storage effect below) — global-default broadcasts must
    // never leak into a diverged tab's display.
    const unsubRules = isOverridden
      ? () => undefined
      : hostBridge.subscribe('rulesUpdated', (payload) => {
          if (Array.isArray(payload.rules)) setRules(payload.rules);
          loadLocalCollections();
        });
    const unsubTemplates = isOverridden
      ? () => undefined
      : hostBridge.subscribe('templatesUpdated', (payload) => {
          if (Array.isArray(payload.templates)) setTemplates(payload.templates);
          loadTemplateData();
        });
    // Workbench surface (override mode) ignores `workspaceChanged` — the
    // tab's editing scope follows its slice binding, which is fed in
    // through the override prop. The override-change effect below
    // handles the rebind path. BC-MWPT-5 / BC-MWPT-8 — global broadcasts
    // do not pull the rug from a diverged tab.
    const unsubWorkspace = isOverridden
      ? () => undefined
      : hostBridge.subscribe('workspaceChanged', (payload) => {
          activeWorkspaceIdRef.current = payload.activeWorkspaceId;
          setActiveWorkspaceId(payload.activeWorkspaceId);
          // Full refetch — rules/collections/templates/pauseMarkers all
          // change atomically on workspace switch.
          refreshRules();
        });
    const unsubConnection = hostBridge.subscribe('connectionStatus', (payload) => {
      setIsConnected(payload.connected ?? false);
    });

    // Periodic refresh (connection status can change). Override branch
    // only refetches the connection state — workspace data flows through
    // the per-key subscriptions, no polling needed.
    const intervalId = setInterval(isOverridden ? loadConnection : loadRules, 5000);

    return () => {
      unsubRules();
      unsubTemplates();
      unsubWorkspace();
      unsubConnection();
      clearInterval(intervalId);
    };
  }, [loadRules, loadLocalCollections, loadTemplateData, refreshRules, isOverridden, loadConnection]);

  // Override-change effect (workbench surface only). When the tab's
  // workspace binding changes — switch in per-tab mode, mode flip,
  // mount-time inheritance — the override prop ticks. Mirror it into
  // state and refetch the workspace-scoped data atomically. The popup
  // / sidepanel path takes the no-op branch (override is undefined).
  useEffect(() => {
    if (!isOverridden) return;
    const next = activeWorkspaceIdOverride ?? null;
    if (activeWorkspaceIdRef.current === next) return;
    activeWorkspaceIdRef.current = next;
    setActiveWorkspaceId(next);
    refreshRules();
  }, [isOverridden, activeWorkspaceIdOverride, refreshRules]);

  // Override-mode storage subscriptions (workbench surface only). The
  // popup / sidepanel branch reads workspace data via `popupOpen` +
  // `rulesUpdated` / `templatesUpdated` broadcasts (always global
  // default). The workbench branch reads materialized snapshots
  // directly from `wsKeys(override).*` so a diverged tab editing
  // workspace X sees X's rules / collections / templates — not the
  // global default's. Mirror writes by the cache layer drive
  // the host storage layer's change events; the resulting hook fires
  // regardless of whether the SW oracle for X is the currently-loaded
  // one. SYNC_ENGINE_DESIGN.md § 9.1 — snapshots are the read path.
  // Pause-markers already use this pattern; this extension generalizes
  // it to the rest of the editing-scope data RuleProvider owns.
  //
  // Tree composition: pure functions over the persisted arrays. Same
  // shape as the SW's boot-fallback path in `rule-store.ts` /
  // `template-store.ts` (when the oracle's orderedSet projection isn't
  // hydrated yet); the persisted folder/collection arrays already
  // carry orderedSet-projected order because the cache layer writes
  // them on every oracle broadcast.
  useEffect(() => {
    if (!isOverridden) return;
    if (!activeWorkspaceId) {
      setRules([]);
      setLocalCollections([]);
      setLocalCollectionTrees([]);
      setTemplates([]);
      setTemplateCollections([]);
      setTemplateCollectionTrees([]);
      foldersRef.current = [];
      templateFoldersRef.current = [];
      return;
    }
    const wsId = activeWorkspaceId;
    let currentRules: Rule[] = [];
    let currentCollections: Collection[] = [];
    let currentFolders: PersistedLocalFolder[] = [];
    let currentTemplates: Template[] = [];
    let currentTemplateCollections: Collection[] = [];
    let currentTemplateFolders: PersistedLocalFolder[] = [];

    const recomputeRulesTree = () => {
      setLocalCollectionTrees(buildLocalCollectionTrees(currentCollections, currentFolders, currentRules));
    };
    const recomputeTemplatesTree = () => {
      setTemplateCollectionTrees(
        buildTemplateCollectionTrees(currentTemplateCollections, currentTemplateFolders, currentTemplates),
      );
    };

    const unsubRules = hostStorage.subscribe(wsKeys(wsId).rules, (record) => {
      currentRules = record ?? [];
      setRules(currentRules);
      recomputeRulesTree();
    });
    const unsubCollections = hostStorage.subscribe(wsKeys(wsId).collections, (record) => {
      currentCollections = record ?? [];
      setLocalCollections(currentCollections);
      recomputeRulesTree();
    });
    const unsubFolders = hostStorage.subscribe(wsKeys(wsId).folders, (record) => {
      currentFolders = record ?? [];
      foldersRef.current = currentFolders;
      recomputeRulesTree();
    });
    const unsubTemplates = hostStorage.subscribe(wsKeys(wsId).templates, (record) => {
      currentTemplates = record ?? [];
      setTemplates(currentTemplates);
      recomputeTemplatesTree();
    });
    const unsubTemplateCollections = hostStorage.subscribe(wsKeys(wsId).templateCollections, (record) => {
      currentTemplateCollections = record ?? [];
      setTemplateCollections(currentTemplateCollections);
      recomputeTemplatesTree();
    });
    const unsubTemplateFolders = hostStorage.subscribe(wsKeys(wsId).templateFolders, (record) => {
      currentTemplateFolders = record ?? [];
      templateFoldersRef.current = currentTemplateFolders;
      recomputeTemplatesTree();
    });

    // Prime all six arrays in one Promise.all so the cold-reload tree
    // composition has a complete snapshot. Earlier shape primed only the
    // folder arrays here and relied on a sibling loadFromStorage to
    // populate rules/collections/templates — the two async chains raced
    // and the empty-trees recompute could stomp the populated one
    // (Session 24 cold-reload empty-state regression).
    void Promise.all([
      hostStorage.get(wsKeys(wsId).rules),
      hostStorage.get(wsKeys(wsId).collections),
      hostStorage.get(wsKeys(wsId).folders),
      hostStorage.get(wsKeys(wsId).templates),
      hostStorage.get(wsKeys(wsId).templateCollections),
      hostStorage.get(wsKeys(wsId).templateFolders),
    ]).then(
      ([
        rulesRecord,
        collectionsRecord,
        foldersRecord,
        templatesRecord,
        templateCollectionsRecord,
        templateFoldersRecord,
      ]) => {
        currentRules = rulesRecord ?? [];
        currentCollections = collectionsRecord ?? [];
        currentFolders = foldersRecord ?? [];
        currentTemplates = templatesRecord ?? [];
        currentTemplateCollections = templateCollectionsRecord ?? [];
        currentTemplateFolders = templateFoldersRecord ?? [];
        foldersRef.current = currentFolders;
        templateFoldersRef.current = currentTemplateFolders;
        setRules(currentRules);
        setLocalCollections(currentCollections);
        setTemplates(currentTemplates);
        setTemplateCollections(currentTemplateCollections);
        recomputeRulesTree();
        recomputeTemplatesTree();
      },
    );

    return () => {
      unsubRules();
      unsubCollections();
      unsubFolders();
      unsubTemplates();
      unsubTemplateCollections();
      unsubTemplateFolders();
    };
  }, [isOverridden, activeWorkspaceId]);

  // ── UI state persistence ──────────────────────────────────────

  useEffect(() => {
    void hostStorage.get(UI.popupState).then((popupState) => {
      if (popupState?.uiState) {
        setUiState((prev) => ({ ...prev, ...(popupState.uiState as Partial<UiState>) }));
      }
    });
  }, []);

  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      void hostStorage.get(UI.popupState).then((prev) => {
        void hostStorage.set(UI.popupState, { ...(prev ?? {}), uiState });
      });
    }, 500);
    return () => clearTimeout(saveTimeout);
  }, [uiState]);

  const updateUiState = useCallback((updates: Partial<UiState>) => {
    setUiState((prev) => ({ ...prev, ...updates }));
  }, []);

  // ── Pause marker pruning ──────────────────────────────────────
  //
  // Drop marker paths that no longer correspond to any known
  // collection/folder. Pause-marker state + mutators live in
  // `PauseMarkersProvider` (per § 8.3.9); this effect keeps them
  // consistent with the tree by calling `replaceMarkers` on the
  // provider when stale paths appear. The pruning depends on
  // `localCollectionTrees` so it stays here.
  useEffect(() => {
    if (pauseMarkers.size === 0) return;
    const activePaths = new Set<string>();
    for (const tree of localCollectionTrees) {
      activePaths.add(tree.path);
      const addFolderPaths = (nodes: TreeNode[]) => {
        for (const node of nodes) {
          if (node.type === 'folder') {
            activePaths.add(node.path);
            addFolderPaths(node.children);
          }
        }
      };
      addFolderPaths(tree.tree);
    }
    let hasStale = false;
    const next = new Map<string, PauseMarker>();
    for (const [key, value] of pauseMarkers) {
      if (activePaths.has(key)) next.set(key, value);
      else hasStale = true;
    }
    if (!hasStale) return;
    replaceMarkers(next);
  }, [localCollectionTrees, pauseMarkers, replaceMarkers]);

  // ── Local rule / collection / folder CRUD ────────────────────

  const localEntityCrud = useLocalEntityCrud({
    isOverridden,
    surfaceId,
    activeWorkspaceId,
    activeWorkspaceIdRef,
    localCollections,
    foldersRef,
    refreshRules,
  });

  // ── Template CRUD ─────────────────────────────────────────────

  const templateCrud = useTemplateCrud({
    isOverridden,
    surfaceId,
    activeWorkspaceIdRef,
    templateCollections,
    templateFoldersRef,
    refreshRules,
  });

  // ── Render ────────────────────────────────────────────────────

  const pausedUids = useMemo(
    () => computePausedUids(localCollectionTrees, pauseMarkers),
    [localCollectionTrees, pauseMarkers],
  );

  const contextValue: RuleContextValue = {
    rules,
    activeWorkspaceId,
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
    ...localEntityCrud,
    templates,
    templateCollections,
    templateCollectionTrees,
    ...templateCrud,
  };

  return <RuleContext.Provider value={contextValue}>{children}</RuleContext.Provider>;
};
