// ── Hydration / workspace switch ────────────────────────────────────
//
// Rules + collections + folders persistence is owned by the sync
// engine's {@link RuleCache} + {@link CollectionCache} +
// {@link FolderCache} — `chrome.storage.local` writes happen on every
// broadcast-driven re-projection.

import { CollectionSchema, FolderSchema, RuleSchema } from '@openheaders/core/schemas';
import type { Collection, Rule } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { requireActiveWorkspaceId } from '@openheaders/oracle/sync';
import { driftRecorder } from '@openheaders/oracle/sync/storage-drift';
import { getRules } from './reads';
import {
  collections,
  folders,
  type LocalFolder,
  loadedWorkspaceId,
  notifyChange,
  rules,
  setCollections,
  setFolders,
  setLoadedWorkspaceId,
  setRules,
} from './state';

interface WorkspaceSnapshot {
  rules: Rule[];
  collections: Collection[];
  folders: LocalFolder[];
}

async function readWorkspaceSnapshot(workspaceId: string): Promise<WorkspaceSnapshot> {
  const keys = wsKeys(workspaceId);
  const [rules, collections, folders] = await Promise.all([
    hostStorage.getValidatedArray(keys.rules, RuleSchema, {
      onError: driftRecorder({
        subsystem: 'rule-engine',
        statusSubsystem: 'rules',
        storageKey: keys.rules.key,
        workspaceId,
      }),
    }),
    hostStorage.getValidatedArray(keys.collections, CollectionSchema, {
      onError: driftRecorder({
        subsystem: 'rule-engine',
        statusSubsystem: 'rules',
        storageKey: keys.collections.key,
        workspaceId,
      }),
    }),
    hostStorage.getValidatedArray(keys.folders, FolderSchema, {
      onError: driftRecorder({
        subsystem: 'rule-engine',
        statusSubsystem: 'rules',
        storageKey: keys.folders.key,
        workspaceId,
      }),
    }),
  ]);
  return { rules, collections, folders };
}

/**
 * Hydrate the store from the currently active workspace's persisted
 * data. Call after `workspaceStore.bootstrap()` so getActiveWorkspaceId
 * resolves. Idempotent — subsequent calls re-load from storage, which
 * is fine because the single owner (background.ts) calls us once.
 */
export async function hydrateFromStorage(): Promise<Rule[]> {
  const workspaceId = requireActiveWorkspaceId();
  const snapshot = await readWorkspaceSnapshot(workspaceId);
  setRules(snapshot.rules);
  setCollections(snapshot.collections);
  setFolders(snapshot.folders);
  setLoadedWorkspaceId(workspaceId);
  logger.debug(
    'RuleStore',
    `Hydrated ws=${workspaceId}: ${rules.length} rules, ${collections.length} collections, ${folders.length} folders`,
  );
  return getRules();
}

/**
 * Atomically swap the in-memory state to a different workspace. Reads
 * the target workspace's persisted data first, then replaces the
 * singletons and notifies. Writes in flight for the previous workspace
 * are serialized through the in-process event loop — storage.local.set
 * calls are queued in order, so calling this after the last mutation
 * in workspace A is safe.
 */
export async function switchToWorkspace(workspaceId: string): Promise<void> {
  if (loadedWorkspaceId === workspaceId) return;
  const snapshot = await readWorkspaceSnapshot(workspaceId);
  setRules(snapshot.rules);
  setCollections(snapshot.collections);
  setFolders(snapshot.folders);
  setLoadedWorkspaceId(workspaceId);
  logger.info(
    'RuleStore',
    `Switched to ws=${workspaceId}: ${rules.length} rules, ${collections.length} collections, ${folders.length} folders`,
  );
  notifyChange();
}
