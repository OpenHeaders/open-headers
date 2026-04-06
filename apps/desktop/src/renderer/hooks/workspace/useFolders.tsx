import type { Folder } from '@openheaders/core';
import { useCallback } from 'react';
import { useCentralizedWorkspace } from '@/renderer/hooks/useCentralizedWorkspace';
import { showMessage } from '@/renderer/utils';

interface UseFoldersReturn {
  folders: Folder[];
  addFolder: (data: Omit<Folder, 'id'>) => Promise<Folder | null>;
  updateFolder: (id: string, updates: Partial<Folder>) => Promise<boolean>;
  removeFolder: (id: string) => Promise<boolean>;
}

export function useFolders(): UseFoldersReturn {
  const { folders, service } = useCentralizedWorkspace();

  const addFolder = useCallback(
    async (data: Omit<Folder, 'id'>): Promise<Folder | null> => {
      try {
        return await service.addFolder(data);
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return null;
      }
    },
    [service],
  );

  const updateFolder = useCallback(
    async (id: string, updates: Partial<Folder>): Promise<boolean> => {
      try {
        await service.updateFolder(id, updates);
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  const removeFolder = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await service.removeFolder(id);
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  return { folders, addFolder, updateFolder, removeFolder };
}
