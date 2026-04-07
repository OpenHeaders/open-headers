/**
 * Collection — top-level organizational container.
 *
 * Every section (requests, rules, environments, recordings) uses
 * collections as the root-level grouping. Folders nest inside
 * collections for deeper organization.
 */

export type CollectionSection = 'requests' | 'rules' | 'environments' | 'recordings';

export interface Collection {
  id: string;
  name: string;
  section: CollectionSection;
  description?: string;
  createdAt?: string;
  /** Environment auto-selected when opening items in this collection */
  pinnedEnvironmentId?: string;
}
