import type { V5 } from '@openheaders/core/types';
import { useCallback } from 'react';
import { useCentralizedWorkspace } from '@/renderer/hooks/useCentralizedWorkspace';
import { showMessage } from '@/renderer/utils';

interface UseCollectionsReturn {
  collections: V5.Collection[];
  requestCollections: V5.CollectionTree[];
  ruleCollections: V5.CollectionTree[];
  addCollection: (section: 'requests' | 'rules', data: Omit<V5.Collection, 'uid' | 'path'>) => Promise<V5.Collection | null>;
  updateCollection: (section: 'requests' | 'rules', uid: string, updates: Partial<V5.Collection>) => Promise<boolean>;
  removeCollection: (section: 'requests' | 'rules', uid: string) => Promise<boolean>;
  addFolder: (collectionUid: string, section: 'requests' | 'rules', name: string, parentPath?: string) => Promise<V5.FolderNode | null>;
  renameFolder: (section: 'requests' | 'rules', uid: string, newName: string) => Promise<boolean>;
  removeFolder: (section: 'requests' | 'rules', uid: string) => Promise<boolean>;
}

export function useCollections(): UseCollectionsReturn {
  const { requestCollections, ruleCollections, service } = useCentralizedWorkspace();

  // Flat list of all collections (request + rule) for backward compat
  const collections: V5.Collection[] = [
    ...requestCollections.map(({ tree: _tree, ...c }) => c),
    ...ruleCollections.map(({ tree: _tree, ...c }) => c),
  ];

  const addCollection = useCallback(
    async (
      section: 'requests' | 'rules',
      data: Omit<V5.Collection, 'uid' | 'path'>,
    ): Promise<V5.Collection | null> => {
      try {
        return await service.addCollection(section, data);
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return null;
      }
    },
    [service],
  );

  const updateCollection = useCallback(
    async (section: 'requests' | 'rules', uid: string, updates: Partial<V5.Collection>): Promise<boolean> => {
      try {
        await service.updateCollection(section, uid, updates);
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  const removeCollection = useCallback(
    async (section: 'requests' | 'rules', uid: string): Promise<boolean> => {
      try {
        await service.removeCollection(section, uid);
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  const addFolder = useCallback(
    async (
      collectionUid: string,
      section: 'requests' | 'rules',
      name: string,
      parentPath?: string,
    ): Promise<V5.FolderNode | null> => {
      try {
        return await service.addFolder(collectionUid, section, name, parentPath);
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return null;
      }
    },
    [service],
  );

  const renameFolder = useCallback(
    async (section: 'requests' | 'rules', uid: string, newName: string): Promise<boolean> => {
      try {
        await service.renameFolder(section, uid, newName);
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  const removeFolder = useCallback(
    async (section: 'requests' | 'rules', uid: string): Promise<boolean> => {
      try {
        await service.removeFolder(section, uid);
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  return {
    collections,
    requestCollections,
    ruleCollections,
    addCollection,
    updateCollection,
    removeCollection,
    addFolder,
    renameFolder,
    removeFolder,
  };
}
