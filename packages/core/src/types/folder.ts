/**
 * Folder — organizational container within a collection.
 *
 * Folders nest inside collections and can be nested arbitrarily
 * deep via parentFolderId.
 */

export type FolderSection = 'requests' | 'rules' | 'environments' | 'recordings';

export interface Folder {
  id: string;
  name: string;
  section: FolderSection;
  /** The collection this folder belongs to */
  collectionId: string;
  parentFolderId: string | null;
  createdAt?: string;
}
