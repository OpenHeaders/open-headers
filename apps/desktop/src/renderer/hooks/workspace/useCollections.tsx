import type { Collection } from '@openheaders/core';
import { useCallback } from 'react';
import { useCentralizedWorkspace } from '@/renderer/hooks/useCentralizedWorkspace';
import { showMessage } from '@/renderer/utils';

interface UseCollectionsReturn {
  collections: Collection[];
  addCollection: (data: Omit<Collection, 'id'>) => Promise<Collection | null>;
  updateCollection: (id: string, updates: Partial<Collection>) => Promise<boolean>;
  removeCollection: (id: string) => Promise<boolean>;
}

export function useCollections(): UseCollectionsReturn {
  const { collections, service } = useCentralizedWorkspace();

  const addCollection = useCallback(
    async (data: Omit<Collection, 'id'>): Promise<Collection | null> => {
      try {
        return await service.addCollection(data);
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return null;
      }
    },
    [service],
  );

  const updateCollection = useCallback(
    async (id: string, updates: Partial<Collection>): Promise<boolean> => {
      try {
        await service.updateCollection(id, updates);
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  const removeCollection = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await service.removeCollection(id);
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  return { collections, addCollection, updateCollection, removeCollection };
}
