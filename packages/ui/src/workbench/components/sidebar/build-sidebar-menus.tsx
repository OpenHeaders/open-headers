/**
 * build-sidebar-menus — pure Ant Design menu-item factories for the
 * sidebar's `+` dropdowns. Both the header-actions toolbar and the
 * per-section header buttons render the same two menus, so they're
 * built once here rather than re-inlined at every Dropdown site.
 *
 *   - buildCreateMenuItems       → HTTP Rules "New rule" menu
 *   - buildRequestImportMenuItems → API Requests "Add request" menu
 */

import { FolderOpenOutlined, ImportOutlined, PlusOutlined } from '@ant-design/icons';
import { buildRuleTypeMenuItems } from '../../rule-type-menu';

interface BuildCreateMenuItemsOptions {
  onCreateRule: (type: string, context?: { collectionId: string; folderPath?: string }, templateKey?: string) => void;
  createNewCollection: () => Promise<void>;
}

export function buildCreateMenuItems({ onCreateRule, createNewCollection }: BuildCreateMenuItemsOptions) {
  return [
    {
      key: 'collection',
      icon: <FolderOpenOutlined />,
      label: 'New Collection',
      onClick: () => void createNewCollection(),
    },
    { type: 'divider' as const, key: 'div-collection' },
    ...buildRuleTypeMenuItems(onCreateRule),
  ];
}

interface BuildRequestImportMenuItemsOptions {
  createNewRequestCollection: () => Promise<void>;
  onCreateRequest?: (context?: { collectionId?: string; folderPath?: string }) => void;
  /** Opens the import hub — curl/URL/HAR/Postman/workspace are
   *  auto-detected there, so the menu carries a single entry. */
  onImport?: (context?: { collectionId?: string }) => void;
}

export function buildRequestImportMenuItems({
  createNewRequestCollection,
  onCreateRequest,
  onImport,
}: BuildRequestImportMenuItemsOptions) {
  return [
    {
      key: 'collection',
      icon: <FolderOpenOutlined />,
      label: 'New Collection',
      onClick: () => void createNewRequestCollection(),
    },
    ...(onCreateRequest
      ? [
          { type: 'divider' as const, key: 'div-request' },
          {
            key: 'new-request',
            icon: <PlusOutlined />,
            label: 'New Request',
            onClick: () => onCreateRequest(),
          },
        ]
      : []),
    ...(onImport
      ? [
          { type: 'divider' as const, key: 'div-import' },
          {
            key: 'import',
            icon: <ImportOutlined />,
            label: 'Import…',
            onClick: () => onImport(),
          },
        ]
      : []),
  ];
}
