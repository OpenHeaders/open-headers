/**
 * In-memory state for the rule store — the active workspace's
 * rules/collections/folders singletons, the change-listener set, the
 * hydration guard, and the sync-bridge unsubscribe holders. All
 * mutation flows through the exported setters so live bindings stay
 * consistent across the folder module.
 */

import type { Collection, Rule } from '@openheaders/core/types';
import type { PersistedLocalFolder } from '@openheaders/oracle/storage';

/** Stored folder — same concept as a directory with _folder.yaml on disk.
 *  Identical shape to the `PersistedLocalFolder` declared in the key
 *  registry; exported under this name because rule-store is the
 *  historical home of the type. */
export type LocalFolder = PersistedLocalFolder;

// ── In-memory state (scoped to the currently active workspace) ──────

export let rules: Rule[] = [];
export let collections: Collection[] = [];
export let folders: LocalFolder[] = [];
/** Id of the workspace whose data is currently loaded. Null until first
 *  hydration. Used to assert that reads/writes never outlive a switch. */
export let loadedWorkspaceId: string | null = null;

export function setRules(next: Rule[]): void {
  rules = next;
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

/** Register a listener that fires after any rule/collection/folder mutation. */
export function onStoreChange(listener: ChangeListener): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

export function notifyChange(): void {
  for (const listener of changeListeners) listener();
}

export function assertLoaded(): string {
  if (!loadedWorkspaceId) {
    throw new Error('RuleStore: mutation before hydration');
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
