/**
 * useRequests — single source of API-request state for UI surfaces.
 *
 * Mirrors `useRules`: one snapshot at mount + a `requestsUpdated`
 * broadcast subscription keeps every component in sync. Mutations are
 * thin wrappers over the bridge RPCs.
 *
 * Workspace switch: workspace-store fires `workspaceChanged` which
 * triggers a fresh list fetch — requests are per-workspace, just like
 * rules and templates.
 */

import type { V5 } from '@openheaders/core/types';
import { call, subscribe } from '@utils/bridge';
import { useCallback, useEffect, useState } from 'react';
import type { ExecutedRequestSnapshot } from '@/background/modules/request-executor';

export interface UseRequestsApi {
  requests: V5.Request[];
  collections: V5.Collection[];
  collectionTrees: V5.CollectionTree[];
  isReady: boolean;

  /** Load a request's full shape from the SW. Useful after the user
   *  opens a request-edit tab — the hook's `requests` list carries
   *  summary info but the full `V5.Request` is fetched on demand. */
  getRequest: (requestUid: string) => Promise<V5.Request | null>;

  createRequest: (input: {
    name: string;
    collectionUid?: string;
    parentPath?: string;
    seed?: Partial<V5.Request>;
  }) => Promise<V5.Request | null>;
  updateRequest: (requestUid: string, updates: Partial<Omit<V5.Request, 'uid' | 'path'>>) => Promise<boolean>;
  deleteRequest: (requestUid: string) => Promise<boolean>;

  createCollection: (name: string) => Promise<V5.Collection | null>;
  renameCollection: (collectionUid: string, name: string) => Promise<boolean>;
  deleteCollection: (collectionUid: string) => Promise<boolean>;

  createFolder: (name: string, parentPath: string) => Promise<{ uid: string; path: string; name: string } | null>;
  renameFolder: (folderUid: string, name: string) => Promise<boolean>;
  deleteFolder: (folderUid: string) => Promise<boolean>;

  /** Execute a persisted request or an in-memory draft. */
  execute: (input: {
    requestUid?: string;
    draft?: V5.Request;
    environmentId?: string;
  }) => Promise<ExecutedRequestSnapshot | null>;
}

export function useRequests(): UseRequestsApi {
  const [requests, setRequests] = useState<V5.Request[]>([]);
  const [collections, setCollections] = useState<V5.Collection[]>([]);
  const [collectionTrees, setCollectionTrees] = useState<V5.CollectionTree[]>([]);
  const [isReady, setIsReady] = useState(false);

  const reload = useCallback(async () => {
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
    let cancelled = false;
    void reload().then(() => {
      if (!cancelled) setIsReady(true);
    });

    const unsub = subscribe('requestsUpdated', () => {
      void reload();
    });
    // Workspace switches don't fan `requestsUpdated` — reload explicitly.
    const unsubWs = subscribe('workspaceChanged', () => {
      void reload();
    });

    return () => {
      cancelled = true;
      unsub();
      unsubWs();
    };
  }, [reload]);

  const getRequest = useCallback(async (requestUid: string) => {
    const resp = await call('getLocalRequest', { requestUid }).catch(() => null);
    return resp?.success ? (resp.request ?? null) : null;
  }, []);

  const createRequest = useCallback<UseRequestsApi['createRequest']>(async (input) => {
    const resp = await call('createLocalRequest', input).catch(() => null);
    return resp?.success ? (resp.request ?? null) : null;
  }, []);

  const updateRequest = useCallback<UseRequestsApi['updateRequest']>(async (requestUid, updates) => {
    const resp = await call('updateLocalRequest', { requestUid, updates }).catch(() => null);
    return Boolean(resp?.success);
  }, []);

  const deleteRequest = useCallback(async (requestUid: string) => {
    const resp = await call('deleteLocalRequest', { requestUid }).catch(() => null);
    return Boolean(resp?.success);
  }, []);

  const createCollection = useCallback(async (name: string) => {
    const resp = await call('createLocalRequestCollection', { name }).catch(() => null);
    return resp?.success ? (resp.collection ?? null) : null;
  }, []);

  const renameCollection = useCallback(async (collectionUid: string, name: string) => {
    const resp = await call('renameLocalRequestCollection', { collectionUid, name }).catch(() => null);
    return Boolean(resp?.success);
  }, []);

  const deleteCollection = useCallback(async (collectionUid: string) => {
    const resp = await call('deleteLocalRequestCollection', { collectionUid }).catch(() => null);
    return Boolean(resp?.success);
  }, []);

  const createFolder = useCallback(async (name: string, parentPath: string) => {
    const resp = await call('createLocalRequestFolder', { name, parentPath }).catch(() => null);
    return resp?.success ? (resp.folder ?? null) : null;
  }, []);

  const renameFolder = useCallback(async (folderUid: string, name: string) => {
    const resp = await call('renameLocalRequestFolder', { folderUid, name }).catch(() => null);
    return Boolean(resp?.success);
  }, []);

  const deleteFolder = useCallback(async (folderUid: string) => {
    const resp = await call('deleteLocalRequestFolder', { folderUid }).catch(() => null);
    return Boolean(resp?.success);
  }, []);

  const execute = useCallback<UseRequestsApi['execute']>(async (input) => {
    const resp = await call('executeRequest', input).catch(() => null);
    return resp?.success ? (resp.snapshot ?? null) : null;
  }, []);

  return {
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
  };
}
