/**
 * In-memory state for the request store — the active workspace's
 * requests/collections/folders singletons, the change-listener set, the
 * hydration guard, and the sync-bridge unsubscribe holders. All
 * mutation flows through the exported setters so live bindings stay
 * consistent across the folder module.
 */

import type { Collection, Request } from '@openheaders/core/types';
import type { PersistedLocalFolder } from '@openheaders/oracle/storage';

/** Re-export from rule-store-style shape. Identical runtime layout. */
export type LocalFolder = PersistedLocalFolder;

// ── In-memory state (scoped to the currently active workspace) ──────

export let requests: Request[] = [];
export let collections: Collection[] = [];
export let folders: LocalFolder[] = [];
export let loadedWorkspaceId: string | null = null;

export function setRequests(next: Request[]): void {
  requests = next;
}

export function setCollections(next: Collection[]): void {
  collections = next;
}

export function setFolders(next: LocalFolder[]): void {
  folders = next;
}

export function setLoadedWorkspaceId(next: string | null): void {
  loadedWorkspaceId = next;
}

// ── Change listeners ────────────────────────────────────────────────

type ChangeListener = () => void;
export const changeListeners: Set<ChangeListener> = new Set();

export function onRequestStoreChange(listener: ChangeListener): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

export function notifyChange(): void {
  for (const listener of changeListeners) listener();
}

export function assertLoaded(): string {
  if (!loadedWorkspaceId) {
    throw new Error('RequestStore: mutation before hydration');
  }
  return loadedWorkspaceId;
}

// ── Sync-bridge unsubscribe holders ─────────────────────────────────

export let cacheUnsubscribe: (() => void) | null = null;
export let collectionCacheUnsubscribe: (() => void) | null = null;
export let folderCacheUnsubscribe: (() => void) | null = null;

export function setCacheUnsubscribe(next: (() => void) | null): void {
  cacheUnsubscribe = next;
}

export function setCollectionCacheUnsubscribe(next: (() => void) | null): void {
  collectionCacheUnsubscribe = next;
}

export function setFolderCacheUnsubscribe(next: (() => void) | null): void {
  folderCacheUnsubscribe = next;
}
