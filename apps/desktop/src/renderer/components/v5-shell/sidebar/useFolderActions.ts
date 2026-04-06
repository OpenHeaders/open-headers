/**
 * useFolderActions — sidebar-level folder actions.
 *
 * Wraps the useFolders hook CRUD with sidebar-specific logic:
 * name generation for new folders.
 */

import type { Folder, FolderSection } from '@openheaders/core';
import { useCallback, useMemo } from 'react';

interface UseFolderActionsProps {
  folders: Folder[];
  addFolder: (data: Omit<Folder, 'id'>) => Promise<Folder | null>;
  updateFolder: (id: string, updates: Partial<Folder>) => Promise<boolean>;
  removeFolder: (id: string) => Promise<boolean>;
}

export function useFolderActions({
  folders,
  addFolder: addFolderCrud,
  updateFolder: updateFolderCrud,
  removeFolder: removeFolderCrud,
}: UseFolderActionsProps) {
  const addFolder = useCallback(
    async (section: FolderSection, collectionId: string, parentFolderId: string | null): Promise<Folder | null> => {
      const siblings = folders.filter(
        (f) => f.section === section && f.collectionId === collectionId && f.parentFolderId === parentFolderId,
      );
      const existingNames = new Set(siblings.map((f) => f.name));
      let name = 'New Folder';
      let counter = 2;
      while (existingNames.has(name)) {
        name = `New Folder (${counter})`;
        counter++;
      }
      return addFolderCrud({ name, section, collectionId, parentFolderId });
    },
    [folders, addFolderCrud],
  );

  const renameFolder = useCallback(
    (folderId: string, newName: string) => {
      updateFolderCrud(folderId, { name: newName });
    },
    [updateFolderCrud],
  );

  const deleteFolder = useCallback(
    (folderId: string) => {
      removeFolderCrud(folderId);
    },
    [removeFolderCrud],
  );

  return useMemo(
    () => ({ addFolder, renameFolder, deleteFolder }),
    [addFolder, renameFolder, deleteFolder],
  );
}
