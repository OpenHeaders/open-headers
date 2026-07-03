// ── Hydration / workspace switch ────────────────────────────────────
//
// All three caches own `chrome.storage.local` writes via broadcast-
// driven re-projection: {@link RequestCache} for requests, the
// request-collection cache for `requestCollections`, the request-folder
// cache for `requestFolders`.

import { CollectionSchema, FolderSchema, RequestSchema } from '@openheaders/core/schemas';
import type { Collection, Request } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { requireActiveWorkspaceId } from '@openheaders/oracle/sync';
import { driftRecorder } from '@openheaders/oracle/sync/storage-drift';
import { getRequests } from './reads';
import {
  collections,
  folders,
  type LocalFolder,
  loadedWorkspaceId,
  notifyChange,
  requests,
  setCollections,
  setFolders,
  setLoadedWorkspaceId,
  setRequests,
} from './state';

interface WorkspaceSnapshot {
  requests: Request[];
  collections: Collection[];
  folders: LocalFolder[];
}

async function readWorkspaceSnapshot(workspaceId: string): Promise<WorkspaceSnapshot> {
  const keys = wsKeys(workspaceId);
  const [requests, collections, folders] = await Promise.all([
    hostStorage.getValidatedArray(keys.requests, RequestSchema, {
      onError: driftRecorder({ subsystem: 'request-executor', storageKey: keys.requests.key, workspaceId }),
    }),
    hostStorage.getValidatedArray(keys.requestCollections, CollectionSchema, {
      onError: driftRecorder({ subsystem: 'request-executor', storageKey: keys.requestCollections.key, workspaceId }),
    }),
    hostStorage.getValidatedArray(keys.requestFolders, FolderSchema, {
      onError: driftRecorder({ subsystem: 'request-executor', storageKey: keys.requestFolders.key, workspaceId }),
    }),
  ]);
  return { requests, collections, folders };
}

export async function hydrateFromStorage(): Promise<Request[]> {
  const workspaceId = requireActiveWorkspaceId();
  const snapshot = await readWorkspaceSnapshot(workspaceId);
  setRequests(snapshot.requests);
  setCollections(snapshot.collections);
  setFolders(snapshot.folders);
  setLoadedWorkspaceId(workspaceId);
  logger.info(
    'RequestStore',
    `Hydrated ws=${workspaceId}: ${requests.length} requests, ${collections.length} collections, ${folders.length} folders`,
  );
  return getRequests();
}

export async function switchToWorkspace(workspaceId: string): Promise<void> {
  if (loadedWorkspaceId === workspaceId) return;
  const snapshot = await readWorkspaceSnapshot(workspaceId);
  setRequests(snapshot.requests);
  setCollections(snapshot.collections);
  setFolders(snapshot.folders);
  setLoadedWorkspaceId(workspaceId);
  logger.info(
    'RequestStore',
    `Switched to ws=${workspaceId}: ${requests.length} requests, ${collections.length} collections, ${folders.length} folders`,
  );
  notifyChange();
}
