/**
 * Template CRUD mutators for RuleProvider. Every mutator is dual-path:
 * the override branch (workbench surface) writes through the sync
 * write-clients against the tab's workspace id; the non-override branch
 * (popup / sidepanel) routes through the SW RPCs. The workspace refs are
 * component-owned and threaded in — the hook never mints its own.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { MIN_SCHEMA_VERSION } from '@openheaders/core/schemas';
import type { PersistedLocalFolder } from '@openheaders/core/storage';
import {
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_FOLDER_ENTITY_TYPE,
  type TemplateFolderParentRef,
} from '@openheaders/core/sync';
import type { Collection, Template } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { type RefObject, useCallback } from 'react';
import {
  applyTemplateCollectionCreate,
  applyTemplateCollectionDelete,
  applyTemplateCollectionRename,
} from '../shared/sync/template-collection-write-client';
import {
  applyTemplateFolderCreate,
  applyTemplateFolderDelete,
  applyTemplateFolderRename,
} from '../shared/sync/template-folder-write-client';
import { applyTemplateCreate, applyTemplateDelete, applyTemplateUpdate } from '../shared/sync/template-write-client';

interface TemplateCrudInputs {
  isOverridden: boolean;
  surfaceId: string;
  /** Workspace id ref — read synchronously at mutation time. */
  activeWorkspaceIdRef: RefObject<string | null>;
  templateCollections: Collection[];
  templateFoldersRef: RefObject<PersistedLocalFolder[]>;
  refreshRules: () => void;
}

export interface TemplateCrud {
  createTemplate: (
    template: Omit<Template, 'uid' | 'path' | 'schemaVersion' | 'version'>,
    collectionUid?: string,
    parentPath?: string,
  ) => Promise<Template | null>;
  updateTemplate: (
    uid: string,
    updates: Partial<Omit<Template, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
  ) => Promise<boolean>;
  deleteTemplate: (uid: string) => Promise<boolean>;
  createTemplateCollection: (name: string) => Promise<Collection | null>;
  renameTemplateCollection: (uid: string, name: string) => Promise<boolean>;
  deleteTemplateCollection: (uid: string) => Promise<boolean>;
  createTemplateFolder: (
    name: string,
    parentPath: string,
  ) => Promise<{ uid: string; path: string; name: string } | null>;
  renameTemplateFolder: (uid: string, name: string) => Promise<boolean>;
  deleteTemplateFolder: (uid: string) => Promise<boolean>;
}

export function useTemplateCrud({
  isOverridden,
  surfaceId,
  activeWorkspaceIdRef,
  templateCollections,
  templateFoldersRef,
  refreshRules,
}: TemplateCrudInputs): TemplateCrud {
  // Mirror the SW's `resolveTemplateFolderParent` by walking the
  // per-workspace storage snapshots already cached in
  // `templateCollections` state and the `templateFoldersRef` ref. Pure
  // synchronous lookups — no IO, no oracle reads — so override-branch
  // mutators can compute the parent ref at gesture time.
  const resolveOverrideTemplateFolderParent = useCallback(
    (parentPath: string): TemplateFolderParentRef | null => {
      const collection = templateCollections.find((c) => c.path === parentPath);
      if (collection) return { type: TEMPLATE_COLLECTION_ENTITY_TYPE, uid: collection.uid };
      const folder = templateFoldersRef.current.find((f) => f.path === parentPath);
      if (folder) return { type: TEMPLATE_FOLDER_ENTITY_TYPE, uid: folder.uid };
      return null;
    },
    [templateCollections, templateFoldersRef],
  );

  const createTemplateFn = useCallback(
    async (
      template: Omit<Template, 'uid' | 'path' | 'schemaVersion' | 'version'>,
      collectionUid?: string,
      parentPath?: string,
    ): Promise<Template | null> => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdRef.current;
        if (!wsId) return null;
        const resolvedParent =
          parentPath ?? (collectionUid ? templateCollections.find((c) => c.uid === collectionUid)?.path : undefined);
        if (!resolvedParent) return null;
        const uid = generateUid();
        const folderName = toFolderName(template.name, uid);
        const now = new Date().toISOString();
        const created: Template = {
          schemaVersion: MIN_SCHEMA_VERSION,
          ...template,
          uid,
          path: `${resolvedParent}/${folderName}`,
          createdAt: template.createdAt || now,
          updatedAt: template.updatedAt || now,
        };
        const ack = await applyTemplateCreate(created, { workspaceId: wsId, surfaceId });
        if (!ack.ok) return null;
        refreshRules();
        return created;
      }
      const resp = await hostBridge.call('createTemplate', { template, collectionUid, parentPath }).catch(() => null);
      if (resp?.success && resp.template) {
        refreshRules();
        return resp.template;
      }
      return null;
    },
    [isOverridden, surfaceId, refreshRules, templateCollections, activeWorkspaceIdRef],
  );

  const updateTemplateFn = useCallback(
    async (
      uid: string,
      updates: Partial<Omit<Template, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
    ): Promise<boolean> => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdRef.current;
        if (!wsId) return false;
        const result = await applyTemplateUpdate(uid, updates, { workspaceId: wsId, surfaceId });
        if (result.ok) {
          refreshRules();
          return true;
        }
        return false;
      }
      const resp = await hostBridge.call('updateTemplate', { templateUid: uid, updates }).catch(() => null);
      if (resp?.ok) {
        refreshRules();
        return true;
      }
      return false;
    },
    [isOverridden, surfaceId, refreshRules, activeWorkspaceIdRef],
  );

  const deleteTemplateFn = useCallback(
    async (uid: string): Promise<boolean> => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdRef.current;
        if (!wsId) return false;
        const result = await applyTemplateDelete(uid, { workspaceId: wsId, surfaceId });
        if (result.ok) {
          refreshRules();
          return true;
        }
        return false;
      }
      const resp = await hostBridge.call('deleteTemplate', { templateUid: uid }).catch(() => null);
      if (resp?.success) {
        refreshRules();
        return true;
      }
      return false;
    },
    [isOverridden, surfaceId, refreshRules, activeWorkspaceIdRef],
  );

  const createTemplateCollectionFn = useCallback(
    async (name: string): Promise<Collection | null> => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdRef.current;
        if (!wsId) return null;
        const result = await applyTemplateCollectionCreate({ name }, { workspaceId: wsId, surfaceId });
        if (result.ok) {
          refreshRules();
          return result.collection;
        }
        return null;
      }
      const resp = await hostBridge.call('createTemplateCollection', { name }).catch(() => null);
      if (resp?.success && resp.collection) {
        refreshRules();
        return resp.collection;
      }
      return null;
    },
    [isOverridden, surfaceId, refreshRules, activeWorkspaceIdRef],
  );

  const renameTemplateCollectionFn = useCallback(
    async (uid: string, name: string): Promise<boolean> => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdRef.current;
        if (!wsId) return false;
        const result = await applyTemplateCollectionRename(
          { collectionUid: uid, name },
          { workspaceId: wsId, surfaceId },
        );
        if (result.ok) {
          refreshRules();
          return true;
        }
        return false;
      }
      const resp = await hostBridge.call('renameTemplateCollection', { collectionUid: uid, name }).catch(() => null);
      if (resp?.success) {
        refreshRules();
        return true;
      }
      return false;
    },
    [isOverridden, surfaceId, refreshRules, activeWorkspaceIdRef],
  );

  const deleteTemplateCollectionFn = useCallback(
    async (uid: string): Promise<boolean> => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdRef.current;
        if (!wsId) return false;
        const result = await applyTemplateCollectionDelete({ collectionUid: uid }, { workspaceId: wsId, surfaceId });
        if (result.ok) {
          refreshRules();
          return true;
        }
        return false;
      }
      const resp = await hostBridge.call('deleteTemplateCollection', { collectionUid: uid }).catch(() => null);
      if (resp?.success) {
        refreshRules();
        return true;
      }
      return false;
    },
    [isOverridden, surfaceId, refreshRules, activeWorkspaceIdRef],
  );

  const createTemplateFolderFn = useCallback(
    async (name: string, parentPath: string): Promise<{ uid: string; path: string; name: string } | null> => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdRef.current;
        if (!wsId) return null;
        const parent = resolveOverrideTemplateFolderParent(parentPath);
        if (!parent) return null;
        const folderUid = generateUid();
        const folderName = toFolderName(name, folderUid);
        const result = await applyTemplateFolderCreate({ folderUid, parent, name }, { workspaceId: wsId, surfaceId });
        if (!result.ok) return null;
        refreshRules();
        return { uid: folderUid, path: `${parentPath}/${folderName}`, name };
      }
      const resp = await hostBridge.call('createTemplateFolder', { name, parentPath }).catch(() => null);
      if (resp?.success && resp.folder) {
        refreshRules();
        return resp.folder;
      }
      return null;
    },
    [isOverridden, surfaceId, refreshRules, resolveOverrideTemplateFolderParent, activeWorkspaceIdRef],
  );

  const renameTemplateFolderFn = useCallback(
    async (uid: string, name: string): Promise<boolean> => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdRef.current;
        if (!wsId) return false;
        const result = await applyTemplateFolderRename({ folderUid: uid, name }, { workspaceId: wsId, surfaceId });
        if (result.ok) {
          refreshRules();
          return true;
        }
        return false;
      }
      const resp = await hostBridge.call('renameTemplateFolder', { folderUid: uid, name }).catch(() => null);
      if (resp?.success) {
        refreshRules();
        return true;
      }
      return false;
    },
    [isOverridden, surfaceId, refreshRules, activeWorkspaceIdRef],
  );

  const deleteTemplateFolderFn = useCallback(
    async (uid: string): Promise<boolean> => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdRef.current;
        if (!wsId) return false;
        const folder = templateFoldersRef.current.find((f) => f.uid === uid);
        if (!folder) return false;
        const parentPath = folder.path.substring(0, folder.path.lastIndexOf('/'));
        const parent = resolveOverrideTemplateFolderParent(parentPath);
        if (!parent) return false;
        const result = await applyTemplateFolderDelete({ folderUid: uid, parent }, { workspaceId: wsId, surfaceId });
        if (result.ok) {
          refreshRules();
          return true;
        }
        return false;
      }
      const resp = await hostBridge.call('deleteTemplateFolder', { folderUid: uid }).catch(() => null);
      if (resp?.success) {
        refreshRules();
        return true;
      }
      return false;
    },
    [
      isOverridden,
      surfaceId,
      refreshRules,
      resolveOverrideTemplateFolderParent,
      activeWorkspaceIdRef,
      templateFoldersRef,
    ],
  );

  return {
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
}
