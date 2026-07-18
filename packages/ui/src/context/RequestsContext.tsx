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
 *     broadcast; CRUD via the legacy `hostBridge.call('createLocalRequest'|...)`
 *     handlers.
 *
 * Override-branch coverage: collection + folder CRUD (create / rename /
 * delete) all route through Phase B helpers with the explicit
 * editing-scope workspaceId. Folder parent-ref resolution reads the
 * per-workspace SYNC MIRRORS (not the React snapshots) to mirror the
 * SW's `resolveRequestFolderParent` — the mirrors are post-ack
 * consistent, so a folder can be created inside a collection minted in
 * the same gesture (the Generate Collection flow). Folder reorder/move
 * is not yet wired (no UI gesture in v1; deferred to a separate pass).
 */

import {
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_FOLDER_ENTITY_TYPE,
  type RequestFolderParentRef,
} from '@openheaders/core/sync';
import type {
  Collection,
  CollectionTree,
  GrpcRequest,
  Request,
  SpecLink,
  Variable,
  WebSocketRequest,
} from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { hostBridge, type BridgeRpcResponse } from '@openheaders/core/bridge';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthConfig, ExecutedGrpcSnapshot, ExecutedRequestSnapshot } from '@openheaders/core/types';
import { buildRequestCollectionTrees } from '../shared/local-tree-builder';
import { hostStorage, type PersistedLocalFolder, wsKeys } from '@openheaders/core/storage';
import {
  applyRequestCollectionCreate,
  applyRequestCollectionDelete,
  applyRequestCollectionRename,
  applyRequestCollectionSetAuth,
  applyRequestCollectionSetScripts,
  applyRequestCollectionSetSpecLink,
  applyRequestCollectionVariablesReplacement,
} from '../shared/sync/request-collection-write-client';
import {
  applyRequestFolderCreate,
  applyRequestFolderDelete,
  applyRequestFolderRename,
  applyRequestFolderSetAuth,
  applyRequestFolderSetScripts,
} from '../shared/sync/request-folder-write-client';
import {
  applyGrpcRequestCreate,
  applyGrpcRequestDelete,
  applyGrpcRequestUpdate,
  type GrpcRequestUpdates,
} from '../shared/sync/grpc-request-write-client';
import {
  applyWebSocketRequestCreate,
  applyWebSocketRequestDelete,
  applyWebSocketRequestUpdate,
  type WebSocketRequestUpdates,
} from '../shared/sync/websocket-request-write-client';
import { applyRequestCreate, applyRequestDelete, applyRequestUpdate } from '../shared/sync/request-write-client';
import { getRequestCollectionSyncMirrorForWorkspace } from './mirrors/request-collection-sync-mirror';
import { getRequestFolderSyncMirrorForWorkspace } from './mirrors/request-folder-sync-mirror';

export type RequestWriteResult = BridgeRpcResponse<'updateLocalRequest'>;

/** Structured ack for gRPC request writes (no legacy RPC shape to mirror). */
export type GrpcRequestWriteResult =
  | { ok: true }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

/** Structured ack for WebSocket request writes — same anatomy as {@link GrpcRequestWriteResult}. */
export type WebSocketRequestWriteResult = GrpcRequestWriteResult;

export interface RequestsContextValue {
  requests: Request[];
  /**
   * gRPC requests — the sibling entity kind sharing the collection
   * tree. Populated on the override branch (workbench surfaces);
   * system surfaces have no gRPC gesture and leave it empty.
   */
  grpcRequests: GrpcRequest[];
  /**
   * WebSocket requests — the session-shaped sibling entity kind
   * sharing the collection tree. Same population rules as
   * {@link grpcRequests}.
   */
  websocketRequests: WebSocketRequest[];
  collections: Collection[];
  /**
   * Flat request-folder list. Populated on the override branch
   * (workbench surfaces — per-key storage subscribe); the legacy
   * branch renders folders only through `collectionTrees` and leaves
   * this empty. Consumers that need folder-entity fields the tree
   * nodes don't carry (the ancestor script slots) read this.
   */
  folders: PersistedLocalFolder[];
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

  /**
   * gRPC request CRUD — override branch only (the workbench is the
   * only surface with gRPC gestures); the legacy branch resolves
   * null/false.
   */
  createGrpcRequest: (input: {
    name: string;
    parentPath: string;
    seed?: Partial<GrpcRequest>;
  }) => Promise<GrpcRequest | null>;
  updateGrpcRequest: (grpcRequestUid: string, updates: GrpcRequestUpdates) => Promise<GrpcRequestWriteResult>;
  deleteGrpcRequest: (grpcRequestUid: string) => Promise<boolean>;

  /**
   * WebSocket request CRUD — override branch only (the workbench is
   * the only surface with WebSocket gestures); the legacy branch
   * resolves null/false. `seed.flavor` distinguishes the creation
   * menu's WebSocket / Socket.IO entries (absent = raw).
   */
  createWebSocketRequest: (input: {
    name: string;
    parentPath: string;
    seed?: Partial<WebSocketRequest>;
  }) => Promise<WebSocketRequest | null>;
  updateWebSocketRequest: (
    webSocketRequestUid: string,
    updates: WebSocketRequestUpdates,
  ) => Promise<WebSocketRequestWriteResult>;
  deleteWebSocketRequest: (webSocketRequestUid: string) => Promise<boolean>;

  createCollection: (name: string) => Promise<Collection | null>;
  renameCollection: (collectionUid: string, name: string) => Promise<boolean>;
  deleteCollection: (collectionUid: string) => Promise<boolean>;

  createFolder: (name: string, parentPath: string) => Promise<{ uid: string; path: string; name: string } | null>;
  renameFolder: (folderUid: string, name: string) => Promise<boolean>;
  deleteFolder: (folderUid: string) => Promise<boolean>;

  /**
   * Set a request collection's / folder's ancestor script slots.
   * Override branch only (workbench surfaces — the import modals and
   * the scripts editor); the legacy branch resolves `false` (system
   * surfaces never edit ancestor scripts).
   */
  setCollectionScripts: (
    collectionUid: string,
    scripts: { preRequestScript?: string; postResponseScript?: string },
  ) => Promise<boolean>;
  setFolderScripts: (
    folderUid: string,
    scripts: { preRequestScript?: string; postResponseScript?: string },
  ) => Promise<boolean>;

  /** Ancestor default auth — same override-branch discipline as the
   *  script setters (import modals + the Authorization editor). */
  setCollectionAuth: (collectionUid: string, auth: AuthConfig) => Promise<boolean>;
  setFolderAuth: (folderUid: string, auth: AuthConfig) => Promise<boolean>;

  /** Replace a collection's variables list — import-modal landing leg
   *  (fresh collections; rows arrive uid-minted). Same override-branch
   *  discipline as the other ancestor setters. */
  setCollectionVariables: (collectionUid: string, variables: Variable[]) => Promise<boolean>;

  /** Spec generation bookkeeping — written once by the spec editor's
   *  Generate Collection landing. Same override-branch discipline. */
  setCollectionSpecLink: (collectionUid: string, specLink: SpecLink) => Promise<boolean>;

  execute: (input: {
    requestUid?: string;
    draft?: Request;
    environmentId?: string;
    /** Caller-minted id — lets the send push `requestStreamEvent` live
     *  frames and be stopped via `abortRequestSend` (hosts without the
     *  streaming leg ignore it). */
    sendId?: string;
  }) => Promise<ExecutedRequestSnapshot | null>;

  /** gRPC Invoke — the GrpcRequest entity's executor channel; executed
   *  on node-runtime hosts and forwarded to a connected companion on
   *  extension surfaces (the editor gates the button off the
   *  `requestRuntime` / `grpcCompanionInvoke` capabilities). `sendId`
   *  joins the same active-send registry, so the in-flight call
   *  cancels via `abortRequestSend`. */
  executeGrpc: (input: {
    grpcRequestUid?: string;
    draft?: GrpcRequest;
    environmentId?: string;
    sendId?: string;
  }) => Promise<ExecutedGrpcSnapshot | null>;
}

const defaultContextValue: RequestsContextValue = {
  requests: [],
  grpcRequests: [],
  websocketRequests: [],
  collections: [],
  folders: [],
  collectionTrees: [],
  isReady: false,
  getRequest: () => Promise.resolve(null),
  createRequest: () => Promise.resolve(null),
  updateRequest: () => Promise.resolve({ ok: false, reason: 'other', message: 'no provider' }),
  deleteRequest: () => Promise.resolve(false),
  createGrpcRequest: () => Promise.resolve(null),
  updateGrpcRequest: () => Promise.resolve({ ok: false, reason: 'other', message: 'no provider' }),
  deleteGrpcRequest: () => Promise.resolve(false),
  createWebSocketRequest: () => Promise.resolve(null),
  updateWebSocketRequest: () => Promise.resolve({ ok: false, reason: 'other', message: 'no provider' }),
  deleteWebSocketRequest: () => Promise.resolve(false),
  createCollection: () => Promise.resolve(null),
  renameCollection: () => Promise.resolve(false),
  deleteCollection: () => Promise.resolve(false),
  createFolder: () => Promise.resolve(null),
  renameFolder: () => Promise.resolve(false),
  deleteFolder: () => Promise.resolve(false),
  setCollectionScripts: () => Promise.resolve(false),
  setFolderScripts: () => Promise.resolve(false),
  setCollectionAuth: () => Promise.resolve(false),
  setFolderAuth: () => Promise.resolve(false),
  setCollectionVariables: () => Promise.resolve(false),
  setCollectionSpecLink: () => Promise.resolve(false),
  execute: () => Promise.resolve(null),
  executeGrpc: () => Promise.resolve(null),
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
  const [grpcRequests, setGrpcRequests] = useState<GrpcRequest[]>([]);
  const [websocketRequests, setWebSocketRequests] = useState<WebSocketRequest[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [folders, setFolders] = useState<PersistedLocalFolder[]>([]);
  const [collectionTrees, setCollectionTrees] = useState<CollectionTree[]>([]);
  const [isReady, setIsReady] = useState(false);
  const overrideIdRef = useRef<string | null>(null);

  // ── Read path (legacy branch) ──────────────────────────────────
  //
  // Bootstraps via the same RPCs `useRequests` used pre-migration;
  // `requestsUpdated` + `workspaceChanged` broadcasts drive live updates.
  // The override branch ignores both — the per-key storage subscribes
  // own the workspace-scoped state.

  const reloadLegacy = useCallback(async () => {
    const [reqResp, colResp, treesResp] = await Promise.all([
      hostBridge.call('getLocalRequests').catch(() => null),
      hostBridge.call('getLocalRequestCollections').catch(() => null),
      hostBridge.call('getLocalRequestCollectionTrees').catch(() => null),
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

    const unsub = hostBridge.subscribe('requestsUpdated', () => {
      if (!isOverridden) void reloadLegacy();
    });
    const unsubWs = hostBridge.subscribe('workspaceChanged', () => {
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
  // Mirror writes by the cache layer drive the host storage layer's
  // change events regardless of which oracle is currently running, so a
  // diverged tab editing workspace W2 sees W2's data without any SW
  // round-trip.

  useEffect(() => {
    if (!isOverridden) return;
    const wsId = activeWorkspaceIdOverride ?? null;
    overrideIdRef.current = wsId;
    if (!wsId) {
      setRequests([]);
      setGrpcRequests([]);
      setWebSocketRequests([]);
      setCollections([]);
      setFolders([]);
      setCollectionTrees([]);
      setIsReady(true);
      return;
    }

    setIsReady(false);
    let currentRequests: Request[] = [];
    let currentGrpcRequests: GrpcRequest[] = [];
    let currentWebSocketRequests: WebSocketRequest[] = [];
    let currentCollections: Collection[] = [];
    let currentFolders: PersistedLocalFolder[] = [];

    const recomputeTrees = () => {
      setCollectionTrees(
        buildRequestCollectionTrees(
          currentCollections,
          currentFolders,
          currentRequests,
          currentGrpcRequests,
          currentWebSocketRequests,
        ),
      );
    };

    const unsubRequests = hostStorage.subscribe(wsKeys(wsId).requests, (record) => {
      currentRequests = record ?? [];
      setRequests(currentRequests);
      recomputeTrees();
    });
    const unsubGrpcRequests = hostStorage.subscribe(wsKeys(wsId).grpcRequests, (record) => {
      currentGrpcRequests = record ?? [];
      setGrpcRequests(currentGrpcRequests);
      recomputeTrees();
    });
    const unsubWebSocketRequests = hostStorage.subscribe(wsKeys(wsId).websocketRequests, (record) => {
      currentWebSocketRequests = record ?? [];
      setWebSocketRequests(currentWebSocketRequests);
      recomputeTrees();
    });
    const unsubCollections = hostStorage.subscribe(wsKeys(wsId).requestCollections, (record) => {
      currentCollections = record ?? [];
      setCollections(currentCollections);
      recomputeTrees();
    });
    const unsubFolders = hostStorage.subscribe(wsKeys(wsId).requestFolders, (record) => {
      currentFolders = record ?? [];
      setFolders(currentFolders);
      recomputeTrees();
    });

    void Promise.all([
      hostStorage.get(wsKeys(wsId).requests),
      hostStorage.get(wsKeys(wsId).grpcRequests),
      hostStorage.get(wsKeys(wsId).websocketRequests),
      hostStorage.get(wsKeys(wsId).requestCollections),
      hostStorage.get(wsKeys(wsId).requestFolders),
    ]).then(([reqRecord, grpcRecord, wsRecord, colRecord, foldersRecord]) => {
      if (overrideIdRef.current !== wsId) return;
      currentRequests = reqRecord ?? [];
      currentGrpcRequests = grpcRecord ?? [];
      currentWebSocketRequests = wsRecord ?? [];
      currentCollections = colRecord ?? [];
      currentFolders = foldersRecord ?? [];
      setRequests(currentRequests);
      setGrpcRequests(currentGrpcRequests);
      setWebSocketRequests(currentWebSocketRequests);
      setCollections(currentCollections);
      setFolders(currentFolders);
      recomputeTrees();
      setIsReady(true);
    });

    return () => {
      unsubRequests();
      unsubGrpcRequests();
      unsubWebSocketRequests();
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
    const resp = await hostBridge.call('getLocalRequest', { requestUid }).catch(() => null);
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
          const resp = await hostBridge.call('createLocalRequest', input).catch(() => null);
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
          ...(seed?.sslVerification !== undefined ? { sslVerification: seed.sslVerification } : {}),
          ...(seed?.tlsMinVersion !== undefined ? { tlsMinVersion: seed.tlsMinVersion } : {}),
          ...(seed?.tlsMaxVersion !== undefined ? { tlsMaxVersion: seed.tlsMaxVersion } : {}),
          ...(seed?.tlsCipherSuites !== undefined ? { tlsCipherSuites: seed.tlsCipherSuites } : {}),
          ...(seed?.allowHttp2 !== undefined ? { allowHttp2: seed.allowHttp2 } : {}),
          ...(seed?.resolveToAddress !== undefined ? { resolveToAddress: seed.resolveToAddress } : {}),
          ...(seed?.clientCertificateRef !== undefined ? { clientCertificateRef: seed.clientCertificateRef } : {}),
          ...(seed?.proxyUrl !== undefined ? { proxyUrl: seed.proxyUrl } : {}),
          ...(seed?.proxyCredentialRef !== undefined ? { proxyCredentialRef: seed.proxyCredentialRef } : {}),
          ...(seed?.unixSocketPath !== undefined ? { unixSocketPath: seed.unixSocketPath } : {}),
          ...(seed?.cookieJar !== undefined ? { cookieJar: seed.cookieJar } : {}),
          ...(seed?.timeoutMs !== undefined ? { timeoutMs: seed.timeoutMs } : {}),
          ...(seed?.maxResponseBytes !== undefined ? { maxResponseBytes: seed.maxResponseBytes } : {}),
          ...(seed?.maxRedirects !== undefined ? { maxRedirects: seed.maxRedirects } : {}),
          ...(seed?.followOriginalHttpMethod !== undefined
            ? { followOriginalHttpMethod: seed.followOriginalHttpMethod }
            : {}),
          ...(seed?.followAuthorizationHeader !== undefined
            ? { followAuthorizationHeader: seed.followAuthorizationHeader }
            : {}),
          ...(seed?.preRequestScript ? { preRequestScript: seed.preRequestScript } : {}),
          ...(seed?.postResponseScript ? { postResponseScript: seed.postResponseScript } : {}),
        };
        const result = await applyRequestCreate(created, { workspaceId: wsId, surfaceId });
        return result.ok ? created : null;
      }
      const resp = await hostBridge.call('createLocalRequest', input).catch(() => null);
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
      return hostBridge.call('updateLocalRequest', { requestUid, updates }).catch(
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
      const resp = await hostBridge.call('deleteLocalRequest', { requestUid }).catch(() => null);
      return Boolean(resp?.success);
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const createGrpcRequest = useCallback<RequestsContextValue['createGrpcRequest']>(
    async (input) => {
      if (!isOverridden) return null;
      const wsId = activeWorkspaceIdOverride ?? null;
      if (!wsId) return null;
      const uid = generateUid();
      const created: GrpcRequest = {
        schemaVersion: 5,
        uid,
        path: `${input.parentPath}/${toFolderName(input.name, uid)}`,
        name: input.name,
        url: input.seed?.url ?? '',
        tls: input.seed?.tls ?? true,
        message: input.seed?.message ?? '',
        metadata: input.seed?.metadata ?? [],
        ...(input.seed?.description !== undefined ? { description: input.seed.description } : {}),
        ...(input.seed?.method !== undefined ? { method: input.seed.method } : {}),
        ...(input.seed?.auth !== undefined ? { auth: input.seed.auth } : {}),
        ...(input.seed?.specLink !== undefined ? { specLink: input.seed.specLink } : {}),
        ...(input.seed?.timeoutMs !== undefined ? { timeoutMs: input.seed.timeoutMs } : {}),
        ...(input.seed?.sslVerification !== undefined ? { sslVerification: input.seed.sslVerification } : {}),
      };
      const result = await applyGrpcRequestCreate(created, { workspaceId: wsId, surfaceId });
      return result.ok ? created : null;
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const updateGrpcRequest = useCallback<RequestsContextValue['updateGrpcRequest']>(
    async (grpcRequestUid, updates) => {
      if (!isOverridden) return { ok: false, reason: 'other', message: 'no provider' };
      const wsId = activeWorkspaceIdOverride ?? null;
      if (!wsId) return { ok: false, reason: 'other', message: 'no workspace' };
      const result = await applyGrpcRequestUpdate(grpcRequestUid, updates, { workspaceId: wsId, surfaceId });
      if (result.ok) return { ok: true };
      if (result.reason === 'not-found') return { ok: false, reason: 'not-found' };
      return { ok: false, reason: 'other', message: result.message ?? '' };
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const deleteGrpcRequest = useCallback<RequestsContextValue['deleteGrpcRequest']>(
    async (grpcRequestUid) => {
      if (!isOverridden) return false;
      const wsId = activeWorkspaceIdOverride ?? null;
      if (!wsId) return false;
      const result = await applyGrpcRequestDelete(grpcRequestUid, { workspaceId: wsId, surfaceId });
      return result.ok;
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const createWebSocketRequest = useCallback<RequestsContextValue['createWebSocketRequest']>(
    async (input) => {
      if (!isOverridden) return null;
      const wsId = activeWorkspaceIdOverride ?? null;
      if (!wsId) return null;
      const uid = generateUid();
      const created: WebSocketRequest = {
        schemaVersion: 5,
        uid,
        path: `${input.parentPath}/${toFolderName(input.name, uid)}`,
        name: input.name,
        url: input.seed?.url ?? '',
        flavor: input.seed?.flavor ?? 'raw',
        subprotocols: input.seed?.subprotocols ?? [],
        headers: input.seed?.headers ?? [],
        params: input.seed?.params ?? [],
        message: input.seed?.message ?? '',
        ...(input.seed?.description !== undefined ? { description: input.seed.description } : {}),
        ...(input.seed?.messageFormat !== undefined ? { messageFormat: input.seed.messageFormat } : {}),
        ...(input.seed?.specLink !== undefined ? { specLink: input.seed.specLink } : {}),
        ...(input.seed?.timeoutMs !== undefined ? { timeoutMs: input.seed.timeoutMs } : {}),
      };
      const result = await applyWebSocketRequestCreate(created, { workspaceId: wsId, surfaceId });
      return result.ok ? created : null;
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const updateWebSocketRequest = useCallback<RequestsContextValue['updateWebSocketRequest']>(
    async (webSocketRequestUid, updates) => {
      if (!isOverridden) return { ok: false, reason: 'other', message: 'no provider' };
      const wsId = activeWorkspaceIdOverride ?? null;
      if (!wsId) return { ok: false, reason: 'other', message: 'no workspace' };
      const result = await applyWebSocketRequestUpdate(webSocketRequestUid, updates, {
        workspaceId: wsId,
        surfaceId,
      });
      if (result.ok) return { ok: true };
      if (result.reason === 'not-found') return { ok: false, reason: 'not-found' };
      return { ok: false, reason: 'other', message: result.message ?? '' };
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const deleteWebSocketRequest = useCallback<RequestsContextValue['deleteWebSocketRequest']>(
    async (webSocketRequestUid) => {
      if (!isOverridden) return false;
      const wsId = activeWorkspaceIdOverride ?? null;
      if (!wsId) return false;
      const result = await applyWebSocketRequestDelete(webSocketRequestUid, { workspaceId: wsId, surfaceId });
      return result.ok;
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
      const resp = await hostBridge.call('createLocalRequestCollection', { name }).catch(() => null);
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
      const resp = await hostBridge.call('renameLocalRequestCollection', { collectionUid, name }).catch(() => null);
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
      const resp = await hostBridge.call('deleteLocalRequestCollection', { collectionUid }).catch(() => null);
      return Boolean(resp?.success);
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  // Resolve `parentPath` to a {@link RequestFolderParentRef} via the
  // per-workspace sync mirrors. Mirrors `resolveRequestFolderParent`
  // in `request-store.ts`. The mirrors — not the React state snapshots
  // — are the resolution source: state lands via async storage
  // subscriptions, so a collection created earlier in the SAME gesture
  // (Generate Collection) is only visible mirror-side at this point.
  // Returns null when the path matches neither a collection nor a
  // folder — caller falls back to legacy RPC, which is the
  // runtime-Active-workspace path.
  const resolveOverrideFolderParent = useCallback(
    async (wsId: string, parentPath: string): Promise<RequestFolderParentRef | null> => {
      const collectionMirror = getRequestCollectionSyncMirrorForWorkspace(wsId);
      const folderMirror = getRequestFolderSyncMirrorForWorkspace(wsId);
      await Promise.all([collectionMirror.hydrated, folderMirror.hydrated]);
      const collection = collectionMirror.listRequestCollections().find((c) => c.path === parentPath);
      if (collection) return { type: REQUEST_COLLECTION_ENTITY_TYPE, uid: collection.uid };
      const folder = folderMirror.listRequestFolders().find((f) => f.path === parentPath);
      if (folder) return { type: REQUEST_FOLDER_ENTITY_TYPE, uid: folder.uid };
      return null;
    },
    [],
  );

  const createFolder = useCallback<RequestsContextValue['createFolder']>(
    async (name, parentPath) => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdOverride ?? null;
        if (!wsId) return null;
        const parent = await resolveOverrideFolderParent(wsId, parentPath);
        if (!parent) return null;
        const folderUid = generateUid();
        const folderName = toFolderName(name, folderUid);
        const result = await applyRequestFolderCreate({ folderUid, parent, name }, { workspaceId: wsId, surfaceId });
        if (!result.ok) return null;
        return { uid: folderUid, path: `${parentPath}/${folderName}`, name };
      }
      const resp = await hostBridge.call('createLocalRequestFolder', { name, parentPath }).catch(() => null);
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
      const resp = await hostBridge.call('renameLocalRequestFolder', { folderUid, name }).catch(() => null);
      return Boolean(resp?.success);
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const deleteFolder = useCallback<RequestsContextValue['deleteFolder']>(
    async (folderUid) => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdOverride ?? null;
        if (!wsId) return false;
        const folderMirror = getRequestFolderSyncMirrorForWorkspace(wsId);
        await folderMirror.hydrated;
        const folder = folderMirror.listRequestFolders().find((f) => f.uid === folderUid);
        if (!folder) return false;
        const parentPath = folder.path.substring(0, folder.path.lastIndexOf('/'));
        const parent = await resolveOverrideFolderParent(wsId, parentPath);
        if (!parent) return false;
        const result = await applyRequestFolderDelete({ folderUid, parent }, { workspaceId: wsId, surfaceId });
        return result.ok;
      }
      const resp = await hostBridge.call('deleteLocalRequestFolder', { folderUid }).catch(() => null);
      return Boolean(resp?.success);
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId, resolveOverrideFolderParent],
  );

  const setCollectionScripts = useCallback<RequestsContextValue['setCollectionScripts']>(
    async (collectionUid, scripts) => {
      if (!isOverridden) return false;
      const wsId = activeWorkspaceIdOverride ?? null;
      if (!wsId) return false;
      const updates: Array<{ path: 'preRequestScript' | 'postResponseScript'; value: string | undefined }> = [];
      if (scripts.preRequestScript !== undefined) {
        updates.push({ path: 'preRequestScript', value: scripts.preRequestScript });
      }
      if (scripts.postResponseScript !== undefined) {
        updates.push({ path: 'postResponseScript', value: scripts.postResponseScript });
      }
      if (updates.length === 0) return true;
      const result = await applyRequestCollectionSetScripts(
        { collectionUid, updates },
        { workspaceId: wsId, surfaceId },
      );
      return result.ok;
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const setFolderScripts = useCallback<RequestsContextValue['setFolderScripts']>(
    async (folderUid, scripts) => {
      if (!isOverridden) return false;
      const wsId = activeWorkspaceIdOverride ?? null;
      if (!wsId) return false;
      const updates: Array<{ path: 'preRequestScript' | 'postResponseScript'; value: string | undefined }> = [];
      if (scripts.preRequestScript !== undefined) {
        updates.push({ path: 'preRequestScript', value: scripts.preRequestScript });
      }
      if (scripts.postResponseScript !== undefined) {
        updates.push({ path: 'postResponseScript', value: scripts.postResponseScript });
      }
      if (updates.length === 0) return true;
      const result = await applyRequestFolderSetScripts({ folderUid, updates }, { workspaceId: wsId, surfaceId });
      return result.ok;
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const setCollectionAuth = useCallback<RequestsContextValue['setCollectionAuth']>(
    async (collectionUid, auth) => {
      if (!isOverridden) return false;
      const wsId = activeWorkspaceIdOverride ?? null;
      if (!wsId) return false;
      const result = await applyRequestCollectionSetAuth({ collectionUid, auth }, { workspaceId: wsId, surfaceId });
      return result.ok;
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const setFolderAuth = useCallback<RequestsContextValue['setFolderAuth']>(
    async (folderUid, auth) => {
      if (!isOverridden) return false;
      const wsId = activeWorkspaceIdOverride ?? null;
      if (!wsId) return false;
      const result = await applyRequestFolderSetAuth({ folderUid, auth }, { workspaceId: wsId, surfaceId });
      return result.ok;
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const setCollectionVariables = useCallback<RequestsContextValue['setCollectionVariables']>(
    async (collectionUid, variables) => {
      if (!isOverridden) return false;
      const wsId = activeWorkspaceIdOverride ?? null;
      if (!wsId) return false;
      const result = await applyRequestCollectionVariablesReplacement(collectionUid, variables, [], {
        workspaceId: wsId,
        surfaceId,
      });
      return result.ok;
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const setCollectionSpecLink = useCallback<RequestsContextValue['setCollectionSpecLink']>(
    async (collectionUid, specLink) => {
      if (!isOverridden) return false;
      const wsId = activeWorkspaceIdOverride ?? null;
      if (!wsId) return false;
      const result = await applyRequestCollectionSetSpecLink({ collectionUid, specLink }, { workspaceId: wsId, surfaceId });
      return result.ok;
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const execute = useCallback<RequestsContextValue['execute']>(async (input) => {
    const resp = await hostBridge.call('executeRequest', input).catch(() => null);
    return resp?.success ? (resp.snapshot ?? null) : null;
  }, []);

  const executeGrpc = useCallback<RequestsContextValue['executeGrpc']>(async (input) => {
    const resp = await hostBridge.call('executeGrpcRequest', input).catch(() => null);
    return resp?.success ? (resp.snapshot ?? null) : null;
  }, []);

  const value = useMemo<RequestsContextValue>(
    () => ({
      requests,
      grpcRequests,
      websocketRequests,
      collections,
      folders,
      collectionTrees,
      isReady,
      getRequest,
      createRequest,
      updateRequest,
      deleteRequest,
      createGrpcRequest,
      updateGrpcRequest,
      deleteGrpcRequest,
      createWebSocketRequest,
      updateWebSocketRequest,
      deleteWebSocketRequest,
      createCollection,
      renameCollection,
      deleteCollection,
      createFolder,
      renameFolder,
      deleteFolder,
      setCollectionScripts,
      setFolderScripts,
      setCollectionAuth,
      setFolderAuth,
      setCollectionVariables,
      setCollectionSpecLink,
      execute,
      executeGrpc,
    }),
    [
      requests,
      grpcRequests,
      websocketRequests,
      collections,
      folders,
      collectionTrees,
      isReady,
      getRequest,
      createRequest,
      updateRequest,
      deleteRequest,
      createGrpcRequest,
      updateGrpcRequest,
      deleteGrpcRequest,
      createWebSocketRequest,
      updateWebSocketRequest,
      deleteWebSocketRequest,
      createCollection,
      renameCollection,
      deleteCollection,
      createFolder,
      renameFolder,
      deleteFolder,
      setCollectionScripts,
      setFolderScripts,
      setCollectionAuth,
      setFolderAuth,
      setCollectionVariables,
      setCollectionSpecLink,
      execute,
      executeGrpc,
    ],
  );

  return <RequestsContext.Provider value={value}>{children}</RequestsContext.Provider>;
};

export function useRequestsContext(): RequestsContextValue {
  return useContext(RequestsContext);
}
