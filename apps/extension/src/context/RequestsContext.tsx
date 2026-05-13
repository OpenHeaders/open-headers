/**
 * RequestsContext — bundled request + request-collection + request-folder
 * provider for popup, sidepanel, panel, and workbench surfaces.
 *
 * Mirrors `RuleProvider`'s shape (per MWPT-FULL § 4.1 + § 8.3.7): one
 * Provider owns all three storage subscriptions (`wsKeys.requests`,
 * `wsKeys.requestCollections`, `wsKeys.requestFolders`) and composes
 * `requestCollectionTrees` in the renderer via `buildRequestCollectionTrees`.
 *
 *   - `activeWorkspaceIdOverride` set ⇒ workbench (override) branch:
 *     reads the three storage keys via `hostStorage.subscribe`;
 *     request entity CRUD routes through `request-write-client` with
 *     the explicit workspaceId. Diverged tabs editing workspace W2
 *     see and write to W2's data, regardless of the runtime-Active
 *     workspace.
 *   - `activeWorkspaceIdOverride` unset ⇒ legacy (system surface)
 *     branch: reads via `getLocalRequests` / `getLocalRequestCollections`
 *     / `getLocalRequestCollectionTrees` RPCs + `requestsUpdated`
 *     broadcast; CRUD via the legacy `call('createLocalRequest'|...)`
 *     handlers.
 *
 * Override-branch coverage: collection + folder CRUD (create / rename /
 * delete) all route through Phase B helpers with the explicit
 * editing-scope workspaceId. Folder parent-ref resolution walks the
 * override-branch's local `collections` + `foldersRef` snapshots to
 * mirror the SW's `resolveRequestFolderParent`. Folder reorder/move is
 * not yet wired (no UI gesture in v1; deferred to a separate pass).
 */

import {
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_FOLDER_ENTITY_TYPE,
  type RequestFolderParentRef,
} from '@openheaders/core/sync';
import type { Collection, CollectionTree, Request } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import type { BridgeRpcResponse } from '@utils/bridge';
import { call, subscribe } from '@utils/bridge';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import { buildRequestCollectionTrees } from '@/shared/local-tree-builder';
import { hostStorage, type PersistedLocalFolder, wsKeys } from '@openheaders/core/storage';
import {
  applyRequestCollectionCreate,
  applyRequestCollectionDelete,
  applyRequestCollectionRename,
} from '@/shared/sync/request-collection-write-client';
import {
  applyRequestFolderCreate,
  applyRequestFolderDelete,
  applyRequestFolderRename,
} from '@/shared/sync/request-folder-write-client';
import { applyRequestCreate, applyRequestDelete, applyRequestUpdate } from '@/shared/sync/request-write-client';

export type RequestWriteResult = BridgeRpcResponse<'updateLocalRequest'>;

export interface RequestsContextValue {
  requests: Request[];
  collections: Collection[];
  collectionTrees: CollectionTree[];
  isReady: boolean;

  getRequest: (requestUid: string) => Promise<Request | null>;

  createRequest: (input: {
    name: string;
    collectionUid?: string;
    parentPath?: string;
    seed?: Partial<Request>;
  }) => Promise<Request | null>;
  updateRequest: (
    requestUid: string,
    updates: Partial<Omit<Request, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
  ) => Promise<RequestWriteResult>;
  deleteRequest: (requestUid: string) => Promise<boolean>;

  createCollection: (name: string) => Promise<Collection | null>;
  renameCollection: (collectionUid: string, name: string) => Promise<boolean>;
  deleteCollection: (collectionUid: string) => Promise<boolean>;

  createFolder: (name: string, parentPath: string) => Promise<{ uid: string; path: string; name: string } | null>;
  renameFolder: (folderUid: string, name: string) => Promise<boolean>;
  deleteFolder: (folderUid: string) => Promise<boolean>;

  execute: (input: {
    requestUid?: string;
    draft?: Request;
    environmentId?: string;
  }) => Promise<ExecutedRequestSnapshot | null>;
}

const defaultContextValue: RequestsContextValue = {
  requests: [],
  collections: [],
  collectionTrees: [],
  isReady: false,
  getRequest: () => Promise.resolve(null),
  createRequest: () => Promise.resolve(null),
  updateRequest: () => Promise.resolve({ ok: false, reason: 'other', message: 'no provider' }),
  deleteRequest: () => Promise.resolve(false),
  createCollection: () => Promise.resolve(null),
  renameCollection: () => Promise.resolve(false),
  deleteCollection: () => Promise.resolve(false),
  createFolder: () => Promise.resolve(null),
  renameFolder: () => Promise.resolve(false),
  deleteFolder: () => Promise.resolve(false),
  execute: () => Promise.resolve(null),
};

export const RequestsContext = createContext<RequestsContextValue>(defaultContextValue);

interface RequestsProviderProps {
  children: React.ReactNode;
  surfaceId: string;
  /**
   * Editing-scope workspace id override (workbench surface only).
   * See `RuleProvider` / `EnvironmentProvider` for the full discipline
   * contract. System surfaces (popup / sidepanel / panel) MUST NOT
   * pass this prop.
   */
  activeWorkspaceIdOverride?: string | null;
}

export const RequestsProvider: React.FC<RequestsProviderProps> = ({
  children,
  surfaceId,
  activeWorkspaceIdOverride,
}) => {
  const isOverridden = activeWorkspaceIdOverride !== undefined;
  const [requests, setRequests] = useState<Request[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionTrees, setCollectionTrees] = useState<CollectionTree[]>([]);
  const [isReady, setIsReady] = useState(false);
  const overrideIdRef = useRef<string | null>(null);
  // Folder list isn't rendered directly — the trees view is — so keep it
  // in a ref instead of state so override-branch mutators (createFolder,
  // deleteFolder) can resolve `RequestFolderParentRef` synchronously
  // from the latest snapshot without forcing re-renders.
  const foldersRef = useRef<PersistedLocalFolder[]>([]);

  // ── Read path (legacy branch) ──────────────────────────────────
  //
  // Bootstraps via the same RPCs `useRequests` used pre-migration;
  // `requestsUpdated` + `workspaceChanged` broadcasts drive live updates.
  // The override branch ignores both — the per-key storage subscribes
  // own the workspace-scoped state.

  const reloadLegacy = useCallback(async () => {
    const [reqResp, colResp, treesResp] = await Promise.all([
      call('getLocalRequests').catch(() => null),
      call('getLocalRequestCollections').catch(() => null),
      call('getLocalRequestCollectionTrees').catch(() => null),
    ]);
    if (reqResp) setRequests(reqResp.requests);
    if (colResp) setCollections(colResp.collections);
    if (treesResp) setCollectionTrees(treesResp.collectionTrees);
  }, []);

  useEffect(() => {
    if (isOverridden) return;
    let cancelled = false;
    void reloadLegacy().then(() => {
      if (!cancelled) setIsReady(true);
    });

    const unsub = subscribe('requestsUpdated', () => {
      if (!isOverridden) void reloadLegacy();
    });
    const unsubWs = subscribe('workspaceChanged', () => {
      if (!isOverridden) void reloadLegacy();
    });

    return () => {
      cancelled = true;
      unsub();
      unsubWs();
    };
  }, [isOverridden, reloadLegacy]);

  // ── Read path (override branch) ─────────────────────────────────
  //
  // Workbench-only: subscribe to the three persisted arrays under
  // `wsKeys(override).*` and recompose `collectionTrees` purely in the
  // renderer. Same shape as `RuleContext` rules+collections+folders.
  // Mirror writes by the cache layer drive `chrome.storage.local`'s
  // onChanged regardless of which oracle is currently running, so a
  // diverged tab editing workspace W2 sees W2's data without any SW
  // round-trip.

  useEffect(() => {
    if (!isOverridden) return;
    const wsId = activeWorkspaceIdOverride ?? null;
    overrideIdRef.current = wsId;
    if (!wsId) {
      setRequests([]);
      setCollections([]);
      setCollectionTrees([]);
      setIsReady(true);
      return;
    }

    setIsReady(false);
    let currentRequests: Request[] = [];
    let currentCollections: Collection[] = [];
    let currentFolders: PersistedLocalFolder[] = [];

    const recomputeTrees = () => {
      setCollectionTrees(buildRequestCollectionTrees(currentCollections, currentFolders, currentRequests));
    };

    const unsubRequests = hostStorage.subscribe(wsKeys(wsId).requests, (record) => {
      currentRequests = record ?? [];
      setRequests(currentRequests);
      recomputeTrees();
    });
    const unsubCollections = hostStorage.subscribe(wsKeys(wsId).requestCollections, (record) => {
      currentCollections = record ?? [];
      setCollections(currentCollections);
      recomputeTrees();
    });
    const unsubFolders = hostStorage.subscribe(wsKeys(wsId).requestFolders, (record) => {
      currentFolders = record ?? [];
      foldersRef.current = currentFolders;
      recomputeTrees();
    });

    void Promise.all([
      hostStorage.get(wsKeys(wsId).requests),
      hostStorage.get(wsKeys(wsId).requestCollections),
      hostStorage.get(wsKeys(wsId).requestFolders),
    ]).then(([reqRecord, colRecord, foldersRecord]) => {
      if (overrideIdRef.current !== wsId) return;
      currentRequests = reqRecord ?? [];
      currentCollections = colRecord ?? [];
      currentFolders = foldersRecord ?? [];
      foldersRef.current = currentFolders;
      setRequests(currentRequests);
      setCollections(currentCollections);
      recomputeTrees();
      setIsReady(true);
    });

    return () => {
      unsubRequests();
      unsubCollections();
      unsubFolders();
    };
  }, [isOverridden, activeWorkspaceIdOverride]);

  // ── Mutators ──────────────────────────────────────────────────
  //
  // Override branch: every CRUD path routes through the Phase B
  // *-write-client modules with the explicit editing-scope workspaceId.
  // Legacy branch: every gesture against the SW's runtime-Active
  // workspace via `call(...)`.

  const getRequest = useCallback<RequestsContextValue['getRequest']>(async (requestUid) => {
    const resp = await call('getLocalRequest', { requestUid }).catch(() => null);
    return resp?.success ? (resp.request ?? null) : null;
  }, []);

  const createRequest = useCallback<RequestsContextValue['createRequest']>(
    async (input) => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdOverride ?? null;
        if (!wsId) return null;
        // Resolve target collection: explicit `parentPath` wins; else
        // resolve `collectionUid` against the override branch's local
        // `collections` snapshot. If neither resolves, fall back to the
        // legacy RPC — that path uses `ensureDefaultRequestCollection`
        // SW-side which writes to runtime-Active (BC-MWPT-FULL-10
        // residual edge — accepted because the override branch's
        // typical gesture comes from the sidebar with a known parent).
        const parentPath =
          input.parentPath ??
          (input.collectionUid ? collections.find((c) => c.uid === input.collectionUid)?.path : undefined);
        if (!parentPath) {
          const resp = await call('createLocalRequest', input).catch(() => null);
          return resp?.success ? (resp.request ?? null) : null;
        }
        const uid = generateUid();
        const folderName = toFolderName(input.name, uid);
        const seed = input.seed;
        const created: Request = {
          schemaVersion: 5,
          uid,
          path: `${parentPath}/${folderName}`,
          name: input.name,
          method: seed?.method ?? 'GET',
          url: seed?.url ?? '',
          headers: seed?.headers ?? [],
          params: seed?.params ?? [],
          auth: seed?.auth ?? { type: 'inherit' },
          body: seed?.body ?? { type: 'none' },
          ...(seed?.description ? { description: seed.description } : {}),
          ...(seed?.credentialsMode ? { credentialsMode: seed.credentialsMode } : {}),
          ...(seed?.followRedirects !== undefined ? { followRedirects: seed.followRedirects } : {}),
          ...(seed?.preRequestScript ? { preRequestScript: seed.preRequestScript } : {}),
          ...(seed?.postResponseScript ? { postResponseScript: seed.postResponseScript } : {}),
        };
        const result = await applyRequestCreate(created, { workspaceId: wsId, surfaceId });
        return result.ok ? created : null;
      }
      const resp = await call('createLocalRequest', input).catch(() => null);
      return resp?.success ? (resp.request ?? null) : null;
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId, collections],
  );

  const updateRequest = useCallback<RequestsContextValue['updateRequest']>(
    async (requestUid, updates) => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdOverride ?? null;
        if (!wsId) return { ok: false, reason: 'other', message: 'no workspace' };
        const result = await applyRequestUpdate(requestUid, updates, { workspaceId: wsId, surfaceId });
        if (result.ok) return { ok: true, request: result.request };
        if (result.reason === 'not-found') return { ok: false, reason: 'not-found' };
        return { ok: false, reason: 'other', message: result.message ?? '' };
      }
      return call('updateLocalRequest', { requestUid, updates }).catch(
        (err: Error) => ({ ok: false, reason: 'other', message: err.message }) as RequestWriteResult,
      );
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const deleteRequest = useCallback<RequestsContextValue['deleteRequest']>(
    async (requestUid) => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdOverride ?? null;
        if (!wsId) return false;
        const result = await applyRequestDelete(requestUid, { workspaceId: wsId, surfaceId });
        return result.ok;
      }
      const resp = await call('deleteLocalRequest', { requestUid }).catch(() => null);
      return Boolean(resp?.success);
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const createCollection = useCallback<RequestsContextValue['createCollection']>(
    async (name) => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdOverride ?? null;
        if (!wsId) return null;
        const result = await applyRequestCollectionCreate({ name }, { workspaceId: wsId, surfaceId });
        return result.ok ? result.collection : null;
      }
      const resp = await call('createLocalRequestCollection', { name }).catch(() => null);
      return resp?.success ? (resp.collection ?? null) : null;
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const renameCollection = useCallback<RequestsContextValue['renameCollection']>(
    async (collectionUid, name) => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdOverride ?? null;
        if (!wsId) return false;
        const result = await applyRequestCollectionRename({ collectionUid, name }, { workspaceId: wsId, surfaceId });
        return result.ok;
      }
      const resp = await call('renameLocalRequestCollection', { collectionUid, name }).catch(() => null);
      return Boolean(resp?.success);
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const deleteCollection = useCallback<RequestsContextValue['deleteCollection']>(
    async (collectionUid) => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdOverride ?? null;
        if (!wsId) return false;
        const result = await applyRequestCollectionDelete({ collectionUid }, { workspaceId: wsId, surfaceId });
        return result.ok;
      }
      const resp = await call('deleteLocalRequestCollection', { collectionUid }).catch(() => null);
      return Boolean(resp?.success);
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  // Resolve `parentPath` to a {@link RequestFolderParentRef} via the
  // override branch's local snapshots. Mirrors `resolveRequestFolderParent`
  // in `request-store.ts`. Returns null when the path matches neither a
  // collection nor a folder — caller falls back to legacy RPC, which is
  // the runtime-Active-workspace path.
  const resolveOverrideFolderParent = useCallback(
    (parentPath: string): RequestFolderParentRef | null => {
      const collection = collections.find((c) => c.path === parentPath);
      if (collection) return { type: REQUEST_COLLECTION_ENTITY_TYPE, uid: collection.uid };
      const folder = foldersRef.current.find((f) => f.path === parentPath);
      if (folder) return { type: REQUEST_FOLDER_ENTITY_TYPE, uid: folder.uid };
      return null;
    },
    [collections],
  );

  const createFolder = useCallback<RequestsContextValue['createFolder']>(
    async (name, parentPath) => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdOverride ?? null;
        if (!wsId) return null;
        const parent = resolveOverrideFolderParent(parentPath);
        if (!parent) return null;
        const folderUid = generateUid();
        const folderName = toFolderName(name, folderUid);
        const result = await applyRequestFolderCreate({ folderUid, parent, name }, { workspaceId: wsId, surfaceId });
        if (!result.ok) return null;
        return { uid: folderUid, path: `${parentPath}/${folderName}`, name };
      }
      const resp = await call('createLocalRequestFolder', { name, parentPath }).catch(() => null);
      return resp?.success ? (resp.folder ?? null) : null;
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId, resolveOverrideFolderParent],
  );

  const renameFolder = useCallback<RequestsContextValue['renameFolder']>(
    async (folderUid, name) => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdOverride ?? null;
        if (!wsId) return false;
        const result = await applyRequestFolderRename({ folderUid, name }, { workspaceId: wsId, surfaceId });
        return result.ok;
      }
      const resp = await call('renameLocalRequestFolder', { folderUid, name }).catch(() => null);
      return Boolean(resp?.success);
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const deleteFolder = useCallback<RequestsContextValue['deleteFolder']>(
    async (folderUid) => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdOverride ?? null;
        if (!wsId) return false;
        const folder = foldersRef.current.find((f) => f.uid === folderUid);
        if (!folder) return false;
        const parentPath = folder.path.substring(0, folder.path.lastIndexOf('/'));
        const parent = resolveOverrideFolderParent(parentPath);
        if (!parent) return false;
        const result = await applyRequestFolderDelete({ folderUid, parent }, { workspaceId: wsId, surfaceId });
        return result.ok;
      }
      const resp = await call('deleteLocalRequestFolder', { folderUid }).catch(() => null);
      return Boolean(resp?.success);
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId, resolveOverrideFolderParent],
  );

  const execute = useCallback<RequestsContextValue['execute']>(async (input) => {
    const resp = await call('executeRequest', input).catch(() => null);
    return resp?.success ? (resp.snapshot ?? null) : null;
  }, []);

  const value = useMemo<RequestsContextValue>(
    () => ({
      requests,
      collections,
      collectionTrees,
      isReady,
      getRequest,
      createRequest,
      updateRequest,
      deleteRequest,
      createCollection,
      renameCollection,
      deleteCollection,
      createFolder,
      renameFolder,
      deleteFolder,
      execute,
    }),
    [
      requests,
      collections,
      collectionTrees,
      isReady,
      getRequest,
      createRequest,
      updateRequest,
      deleteRequest,
      createCollection,
      renameCollection,
      deleteCollection,
      createFolder,
      renameFolder,
      deleteFolder,
      execute,
    ],
  );

  return <RequestsContext.Provider value={value}>{children}</RequestsContext.Provider>;
};

export function useRequestsContext(): RequestsContextValue {
  return useContext(RequestsContext);
}
