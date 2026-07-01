/**
 * Local rule / collection / folder CRUD mutators for RuleProvider.
 * Every mutator is dual-path: the override branch (workbench surface)
 * writes through the sync write-clients against the tab's workspace id;
 * the non-override branch (popup / sidepanel) routes through the SW
 * RPCs. The workspace refs are component-owned and threaded in — the
 * hook never mints its own.
 *
 * Create-rule is not in this surface. Every "+ New Rule" gesture mints
 * a real entity via `applyRuleCreate` at click time (in
 * `useTabOpeners.openCreateTab`); the rule starts unpublished and the
 * editor's Save button is the publication gate.
 */

import { hostBridge } from '@openheaders/core/bridge';
import type { PersistedLocalFolder } from '@openheaders/core/storage';
import { COLLECTION_ENTITY_TYPE, FOLDER_ENTITY_TYPE, type FolderParentRef } from '@openheaders/core/sync';
import type { Collection, Rule } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { type RefObject, useCallback } from 'react';
import {
  applyCollectionCreate,
  applyCollectionDelete,
  applyRenameCollection,
} from '../shared/sync/collection-write-client';
import { applyFolderCreate, applyFolderDelete, applyFolderRename } from '../shared/sync/folder-write-client';
import { applyRuleDelete, applyRuleUpdate } from '../shared/sync/rule-write-client';

interface LocalEntityCrudInputs {
  isOverridden: boolean;
  surfaceId: string;
  /** Workspace id state — rule mutators bail while it's null. */
  activeWorkspaceId: string | null;
  /** Workspace id ref — read synchronously at mutation time. */
  activeWorkspaceIdRef: RefObject<string | null>;
  localCollections: Collection[];
  foldersRef: RefObject<PersistedLocalFolder[]>;
  refreshRules: () => void;
}

export interface LocalEntityCrud {
  updateLocalRule: (uid: string, updates: Partial<Omit<Rule, 'uid' | 'path'>>) => Promise<boolean>;
  deleteLocalRule: (uid: string) => Promise<boolean>;
  createLocalCollection: (name: string) => Promise<Collection | null>;
  renameLocalCollection: (uid: string, name: string) => Promise<boolean>;
  deleteLocalCollection: (uid: string) => Promise<boolean>;
  createLocalFolder: (name: string, parentPath: string) => Promise<{ uid: string; path: string; name: string } | null>;
  renameLocalFolder: (uid: string, name: string) => Promise<boolean>;
  deleteLocalFolder: (uid: string) => Promise<boolean>;
}

export function useLocalEntityCrud({
  isOverridden,
  surfaceId,
  activeWorkspaceId,
  activeWorkspaceIdRef,
  localCollections,
  foldersRef,
  refreshRules,
}: LocalEntityCrudInputs): LocalEntityCrud {
  const updateLocalRuleFn = useCallback(
    async (uid: string, updates: Partial<Omit<Rule, 'uid' | 'path'>>): Promise<boolean> => {
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

  // Mirror the SW's `resolveFolderParent` by walking the per-workspace
  // storage snapshots already cached in `localCollections` state and
  // the `foldersRef` ref. Pure synchronous lookups — no IO, no oracle
  // reads — so override-branch mutators can compute the parent ref at
  // gesture time.
  const resolveOverrideRuleFolderParent = useCallback(
    (parentPath: string): FolderParentRef | null => {
      const collection = localCollections.find((c) => c.path === parentPath);
      if (collection) return { type: COLLECTION_ENTITY_TYPE, uid: collection.uid };
      const folder = foldersRef.current.find((f) => f.path === parentPath);
      if (folder) return { type: FOLDER_ENTITY_TYPE, uid: folder.uid };
      return null;
    },
    [localCollections, foldersRef],
  );

  const createLocalCollectionFn = useCallback(
    async (name: string): Promise<Collection | null> => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdRef.current;
        if (!wsId) return null;
        const result = await applyCollectionCreate({ name }, { workspaceId: wsId, surfaceId });
        if (result.ok) {
          refreshRules();
          return result.collection;
        }
        return null;
      }
      const resp = await hostBridge.call('createLocalCollection', { name }).catch(() => null);
      if (resp?.success && resp.collection) {
        refreshRules();
        return resp.collection;
      }
      return null;
    },
    [isOverridden, surfaceId, refreshRules, activeWorkspaceIdRef],
  );

  const renameLocalCollectionFn = useCallback(
    async (uid: string, name: string): Promise<boolean> => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdRef.current;
        if (!wsId) return false;
        const result = await applyRenameCollection({ collectionUid: uid, name }, { workspaceId: wsId, surfaceId });
        if (result.ok) {
          refreshRules();
          return true;
        }
        return false;
      }
      const resp = await hostBridge.call('renameLocalCollection', { collectionUid: uid, name }).catch(() => null);
      if (resp?.success) {
        refreshRules();
        return true;
      }
      return false;
    },
    [isOverridden, surfaceId, refreshRules, activeWorkspaceIdRef],
  );

  const deleteLocalCollectionFn = useCallback(
    async (uid: string): Promise<boolean> => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdRef.current;
        if (!wsId) return false;
        const result = await applyCollectionDelete({ collectionUid: uid }, { workspaceId: wsId, surfaceId });
        if (result.ok) {
          refreshRules();
          return true;
        }
        return false;
      }
      const resp = await hostBridge.call('deleteLocalCollection', { collectionUid: uid }).catch(() => null);
      if (resp?.success) {
        refreshRules();
        return true;
      }
      return false;
    },
    [isOverridden, surfaceId, refreshRules, activeWorkspaceIdRef],
  );

  const createLocalFolderFn = useCallback(
    async (name: string, parentPath: string): Promise<{ uid: string; path: string; name: string } | null> => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdRef.current;
        if (!wsId) return null;
        const parent = resolveOverrideRuleFolderParent(parentPath);
        if (!parent) return null;
        const folderUid = generateUid();
        const folderName = toFolderName(name, folderUid);
        const result = await applyFolderCreate({ folderUid, parent, name }, { workspaceId: wsId, surfaceId });
        if (!result.ok) return null;
        refreshRules();
        return { uid: folderUid, path: `${parentPath}/${folderName}`, name };
      }
      const resp = await hostBridge.call('createLocalFolder', { name, parentPath }).catch(() => null);
      if (resp?.success && resp.folder) {
        refreshRules();
        return resp.folder;
      }
      return null;
    },
    [isOverridden, surfaceId, refreshRules, resolveOverrideRuleFolderParent, activeWorkspaceIdRef],
  );

  const renameLocalFolderFn = useCallback(
    async (uid: string, name: string): Promise<boolean> => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdRef.current;
        if (!wsId) return false;
        const result = await applyFolderRename({ folderUid: uid, name }, { workspaceId: wsId, surfaceId });
        if (result.ok) {
          refreshRules();
          return true;
        }
        return false;
      }
      const resp = await hostBridge.call('renameLocalFolder', { folderUid: uid, name }).catch(() => null);
      if (resp?.success) {
        refreshRules();
        return true;
      }
      return false;
    },
    [isOverridden, surfaceId, refreshRules, activeWorkspaceIdRef],
  );

  const deleteLocalFolderFn = useCallback(
    async (uid: string): Promise<boolean> => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdRef.current;
        if (!wsId) return false;
        const folder = foldersRef.current.find((f) => f.uid === uid);
        if (!folder) return false;
        const parentPath = folder.path.substring(0, folder.path.lastIndexOf('/'));
        const parent = resolveOverrideRuleFolderParent(parentPath);
        if (!parent) return false;
        const result = await applyFolderDelete({ folderUid: uid, parent }, { workspaceId: wsId, surfaceId });
        if (result.ok) {
          refreshRules();
          return true;
        }
        return false;
      }
      const resp = await hostBridge.call('deleteLocalFolder', { folderUid: uid }).catch(() => null);
      if (resp?.success) {
        refreshRules();
        return true;
      }
      return false;
    },
    [isOverridden, surfaceId, refreshRules, resolveOverrideRuleFolderParent, activeWorkspaceIdRef, foldersRef],
  );

  return {
    updateLocalRule: updateLocalRuleFn,
    deleteLocalRule: deleteLocalRuleFn,
    createLocalCollection: createLocalCollectionFn,
    renameLocalCollection: renameLocalCollectionFn,
    deleteLocalCollection: deleteLocalCollectionFn,
    createLocalFolder: createLocalFolderFn,
    renameLocalFolder: renameLocalFolderFn,
    deleteLocalFolder: deleteLocalFolderFn,
  };
}
