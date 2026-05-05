/**
 * RuleContext — provides the active workspace's V5 rules to the popup,
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

import type { V5 } from '@openheaders/core/types';
import type { PauseMarker } from '@openheaders/core/utils';
import { computePausedUids, resolvePauseState } from '@openheaders/core/utils';
import { call, subscribe } from '@utils/bridge';
import type React from 'react';
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildLocalCollectionTrees, buildTemplateCollectionTrees } from '@/shared/local-tree-builder';
import { extensionStorage, type PersistedLocalFolder, UI, wsKeys } from '@/shared/storage';
import { applyPauseMarkersReplacement } from '@/shared/sync/pause-markers-write-client';
import { applyRuleDelete, applyRuleUpdate } from '@/shared/sync/rule-write-client';

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
  localCollections: V5.Collection[];
  /** Local collection trees (with folder → rule hierarchy). */
  localCollectionTrees: V5.CollectionTree[];
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
  /** Create a template. `schemaVersion` + `version` are stamped by the store. */
  createTemplate: (
    template: Omit<V5.Template, 'uid' | 'path' | 'schemaVersion' | 'version'>,
    collectionUid?: string,
    parentPath?: string,
  ) => Promise<V5.Template | null>;
  /** Update a template by uid. */
  updateTemplate: (
    uid: string,
    updates: Partial<Omit<V5.Template, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
  ) => Promise<boolean>;
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
   * When defined (workbench mounts it from `useWorkbenchTabWorkspaceId()`),
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
  // Workspace id tracked as BOTH ref (used in sync mutators without
  // triggering re-renders) AND state (drives the pause-markers
  // subscription rebind on workspace switch).
  const activeWorkspaceIdRef = useRef<string | null>(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

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
  //    directly from `chrome.storage.local` under `wsKeys(override).*` —
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
  //    `extensionStorage.subscribe` rebinds when the override id changes;
  //    cross-process / cross-workspace mutations land via chrome.storage
  //    `onChanged` regardless of which oracle is currently running.
  //    Connection status still comes from the bridge (system-scoped).

  const loadConnection = useCallback(() => {
    call('popupOpen')
      .then((resp) => {
        setIsConnected(resp.connected ?? false);
      })
      .catch(() => {
        setIsConnected(false);
      });
  }, []);

  const loadFromStorage = useCallback(async (workspaceId: string) => {
    const [
      rulesRecord,
      collectionsRecord,
      foldersRecord,
      templatesRecord,
      templateCollectionsRecord,
      templateFoldersRecord,
      pauseMarkersRecord,
    ] = await Promise.all([
      extensionStorage.get(wsKeys(workspaceId).rules),
      extensionStorage.get(wsKeys(workspaceId).collections),
      extensionStorage.get(wsKeys(workspaceId).folders),
      extensionStorage.get(wsKeys(workspaceId).templates),
      extensionStorage.get(wsKeys(workspaceId).templateCollections),
      extensionStorage.get(wsKeys(workspaceId).templateFolders),
      extensionStorage.get(wsKeys(workspaceId).pauseMarkers),
    ]);
    const rulesArr = rulesRecord ?? [];
    const collectionsArr = collectionsRecord ?? [];
    const foldersArr = foldersRecord ?? [];
    const templatesArr = templatesRecord ?? [];
    const templateCollectionsArr = templateCollectionsRecord ?? [];
    const templateFoldersArr = templateFoldersRecord ?? [];
    setRules(rulesArr);
    setLocalCollections(collectionsArr);
    setLocalCollectionTrees(buildLocalCollectionTrees(collectionsArr, foldersArr, rulesArr));
    setTemplates(templatesArr);
    setTemplateCollections(templateCollectionsArr);
    setTemplateCollectionTrees(
      buildTemplateCollectionTrees(templateCollectionsArr, templateFoldersArr, templatesArr),
    );
    setPauseMarkers(pauseMarkersRecord ? new Map(Object.entries(pauseMarkersRecord)) : new Map());
  }, []);

  const loadRules = useCallback(() => {
    if (isOverridden) {
      const effectiveId = activeWorkspaceIdOverride ?? null;
      activeWorkspaceIdRef.current = effectiveId;
      setActiveWorkspaceId(effectiveId);
      setIsStatusLoaded(true);
      loadConnection();
      if (effectiveId) {
        void loadFromStorage(effectiveId);
      } else {
        setRules([]);
        setLocalCollections([]);
        setLocalCollectionTrees([]);
        setTemplates([]);
        setTemplateCollections([]);
        setTemplateCollectionTrees([]);
        setPauseMarkers(new Map());
      }
      return;
    }
    call('popupOpen')
      .then(async (resp) => {
        setRules(resp.rules ?? []);
        setIsConnected(resp.connected ?? false);
        setIsStatusLoaded(true);
        const effectiveId = resp.activeWorkspaceId;
        activeWorkspaceIdRef.current = effectiveId;
        setActiveWorkspaceId(effectiveId);
        if (effectiveId) {
          const record = await extensionStorage.get(wsKeys(effectiveId).pauseMarkers);
          setPauseMarkers(record ? new Map(Object.entries(record)) : new Map());
        }
      })
      .catch(() => {
        setIsConnected(false);
        setIsStatusLoaded(true);
      });
  }, [isOverridden, activeWorkspaceIdOverride, loadConnection, loadFromStorage]);

  const loadLocalCollections = useCallback(() => {
    if (isOverridden) return; // override branch reads from storage
    call('getLocalCollections')
      .then((resp) => setLocalCollections(resp.collections ?? []))
      .catch(() => undefined);
    call('getLocalCollectionTrees')
      .then((resp) => setLocalCollectionTrees(resp.collectionTrees ?? []))
      .catch(() => undefined);
  }, [isOverridden]);

  const loadTemplateData = useCallback(() => {
    if (isOverridden) return; // override branch reads from storage
    call('getTemplates')
      .then((resp) => setTemplates(resp.templates ?? []))
      .catch(() => undefined);
    call('getTemplateCollections')
      .then((resp) => setTemplateCollections(resp.collections ?? []))
      .catch(() => undefined);
    call('getTemplateCollectionTrees')
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
      : subscribe('rulesUpdated', (payload) => {
          if (Array.isArray(payload.rules)) setRules(payload.rules);
          loadLocalCollections();
        });
    const unsubTemplates = isOverridden
      ? () => undefined
      : subscribe('templatesUpdated', (payload) => {
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
      : subscribe('workspaceChanged', (payload) => {
          activeWorkspaceIdRef.current = payload.activeWorkspaceId;
          setActiveWorkspaceId(payload.activeWorkspaceId);
          // Full refetch — rules/collections/templates/pauseMarkers all
          // change atomically on workspace switch.
          refreshRules();
        });
    const unsubConnection = subscribe('connectionStatus', (payload) => {
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

  // Pause-marker storage subscription — rebinds when the active
  // workspace id changes so every switch picks up the new workspace's
  // persisted markers without a polling round-trip.
  useEffect(() => {
    if (!activeWorkspaceId) return;
    const unsub = extensionStorage.subscribe(wsKeys(activeWorkspaceId).pauseMarkers, (record) => {
      setPauseMarkers(record ? new Map(Object.entries(record)) : new Map());
    });
    return unsub;
  }, [activeWorkspaceId]);

  // Override-mode storage subscriptions (workbench surface only). The
  // popup / sidepanel branch reads workspace data via `popupOpen` +
  // `rulesUpdated` / `templatesUpdated` broadcasts (always global
  // default). The workbench branch reads materialized snapshots
  // directly from `wsKeys(override).*` so a diverged tab editing
  // workspace X sees X's rules / collections / templates — not the
  // global default's. Mirror writes by the cache layer drive
  // `chrome.storage.local.onChanged`; the resulting hook fires
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
    if (!activeWorkspaceId) return;
    const wsId = activeWorkspaceId;
    let currentRules: V5.Rule[] = rules;
    let currentCollections: V5.Collection[] = localCollections;
    let currentFolders: PersistedLocalFolder[] = [];
    let currentTemplates: V5.Template[] = templates;
    let currentTemplateCollections: V5.Collection[] = templateCollections;
    let currentTemplateFolders: PersistedLocalFolder[] = [];

    const recomputeRulesTree = () => {
      setLocalCollectionTrees(buildLocalCollectionTrees(currentCollections, currentFolders, currentRules));
    };
    const recomputeTemplatesTree = () => {
      setTemplateCollectionTrees(
        buildTemplateCollectionTrees(currentTemplateCollections, currentTemplateFolders, currentTemplates),
      );
    };

    const unsubRules = extensionStorage.subscribe(wsKeys(wsId).rules, (record) => {
      currentRules = record ?? [];
      setRules(currentRules);
      recomputeRulesTree();
    });
    const unsubCollections = extensionStorage.subscribe(wsKeys(wsId).collections, (record) => {
      currentCollections = record ?? [];
      setLocalCollections(currentCollections);
      recomputeRulesTree();
    });
    const unsubFolders = extensionStorage.subscribe(wsKeys(wsId).folders, (record) => {
      currentFolders = record ?? [];
      recomputeRulesTree();
    });
    const unsubTemplates = extensionStorage.subscribe(wsKeys(wsId).templates, (record) => {
      currentTemplates = record ?? [];
      setTemplates(currentTemplates);
      recomputeTemplatesTree();
    });
    const unsubTemplateCollections = extensionStorage.subscribe(
      wsKeys(wsId).templateCollections,
      (record) => {
        currentTemplateCollections = record ?? [];
        setTemplateCollections(currentTemplateCollections);
        recomputeTemplatesTree();
      },
    );
    const unsubTemplateFolders = extensionStorage.subscribe(wsKeys(wsId).templateFolders, (record) => {
      currentTemplateFolders = record ?? [];
      recomputeTemplatesTree();
    });

    // Prime the local snapshots-of-snapshots so subsequent partial-key
    // updates have a coherent tree to recompose against.
    void Promise.all([
      extensionStorage.get(wsKeys(wsId).folders),
      extensionStorage.get(wsKeys(wsId).templateFolders),
    ]).then(([foldersRecord, templateFoldersRecord]) => {
      currentFolders = foldersRecord ?? [];
      currentTemplateFolders = templateFoldersRecord ?? [];
      recomputeRulesTree();
      recomputeTemplatesTree();
    });

    return () => {
      unsubRules();
      unsubCollections();
      unsubFolders();
      unsubTemplates();
      unsubTemplateCollections();
      unsubTemplateFolders();
    };
    // Intentionally narrow deps: this effect rebinds only when the
    // override workspace id flips. Local-cache initial values are
    // captured once at effect-setup time and updated by the per-key
    // listeners thereafter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOverridden, activeWorkspaceId]);

  // ── UI state persistence ──────────────────────────────────────

  useEffect(() => {
    void extensionStorage.get(UI.popupState).then((popupState) => {
      if (popupState?.uiState) {
        setUiState((prev) => ({ ...prev, ...(popupState.uiState as Partial<UiState>) }));
      }
    });
  }, []);

  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      void extensionStorage.get(UI.popupState).then((prev) => {
        void extensionStorage.set(UI.popupState, { ...(prev ?? {}), uiState });
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
      const wsId = activeWorkspaceIdRef.current;
      setPauseMarkers((prev) => {
        const next = mutator(prev);
        // Route every pause-marker write through the sync oracle —
        // concurrent tab toggles serialize through the same
        // `entityLockName(ws, 'pause-markers', 'pause-markers')` lock
        // every other Phase B entity uses. The cache broadcasts via
        // `chrome.storage.local`'s onChanged so other tabs'
        // `extensionStorage.subscribe` listener picks up the canonical
        // state; we don't have to care about the round-trip here —
        // local state is optimistic and the broadcast corrects any
        // divergence.
        if (wsId) {
          void applyPauseMarkersReplacement(next, {
            workspaceId: wsId,
            surfaceId: 'rule-context',
          }).catch(() => undefined);
        }
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
  //
  // Create is no longer in the context surface. Every "+ New Rule"
  // gesture mints a real entity via `applyRuleCreate` at click time
  // (in `useTabOpeners.openCreateTab`); the rule starts unpublished
  // and the editor's Save button is the publication gate.

  const updateLocalRuleFn = useCallback(
    async (uid: string, updates: Partial<Omit<V5.Rule, 'uid' | 'path'>>): Promise<boolean> => {
      if (!activeWorkspaceId) return false;
      const result = await applyRuleUpdate(uid, updates, { workspaceId: activeWorkspaceId, surfaceId });
      if (result.ok) {
        refreshRules();
        return true;
      }
      return false;
    },
    [activeWorkspaceId, surfaceId, refreshRules],
  );

  const deleteLocalRuleFn = useCallback(
    async (uid: string): Promise<boolean> => {
      if (!activeWorkspaceId) return false;
      const result = await applyRuleDelete(uid, { workspaceId: activeWorkspaceId, surfaceId });
      if (result.ok) {
        refreshRules();
        return true;
      }
      return false;
    },
    [activeWorkspaceId, surfaceId, refreshRules],
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
      template: Omit<V5.Template, 'uid' | 'path' | 'schemaVersion' | 'version'>,
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
    async (
      uid: string,
      updates: Partial<Omit<V5.Template, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
    ): Promise<boolean> => {
      const resp = await call('updateTemplate', { templateUid: uid, updates }).catch(() => null);
      if (resp?.ok) {
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
