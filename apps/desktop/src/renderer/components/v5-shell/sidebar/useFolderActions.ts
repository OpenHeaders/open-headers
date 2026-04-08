/**
 * useFolderActions — sidebar-level folder actions.
 *
 * In V5, folders are part of the CollectionTree structure.
 * Folder CRUD operates through the storage layer (not separate IPC).
 * Stubbed for now — will be implemented when folder IPC is added.
 */

import { useMemo } from 'react';

export function useFolderActions() {
  return useMemo(
    () => ({
      addFolder: async (_section: string, _collectionId: string, _parentFolderId: string | null) => {
        // TODO: add folder via IPC
        return null;
      },
      renameFolder: (_folderId: string, _newName: string) => {
        // TODO: rename folder via IPC
      },
      deleteFolder: (_folderId: string) => {
        // TODO: delete folder via IPC
      },
    }),
    [],
  );
}
