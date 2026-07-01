/**
 * build-sidebar-menus — pure Ant Design menu-item factories for the
 * sidebar's `+` dropdowns. Both the header-actions toolbar and the
 * per-section header buttons render the same two menus, so they're
 * built once here rather than re-inlined at every Dropdown site.
 *
 *   - buildCreateMenuItems       → HTTP Rules "New rule" menu
 *   - buildRequestImportMenuItems → API Requests "Add request" menu
 */

import { DownloadOutlined, FolderOpenOutlined, PlusOutlined } from '@ant-design/icons';
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
  onImportCurl?: (context?: { collectionId?: string }) => void;
  onImportHar?: (context?: { collectionId?: string }) => void;
  onImportPostman?: () => void;
}

export function buildRequestImportMenuItems({
  createNewRequestCollection,
  onCreateRequest,
  onImportCurl,
  onImportHar,
  onImportPostman,
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
    ...(onImportCurl || onImportHar || onImportPostman
      ? ([{ type: 'divider' as const, key: 'div-import' }] as const)
      : []),
    ...(onImportCurl
      ? [
          {
            key: 'import-curl',
            icon: <DownloadOutlined />,
            label: 'Import from cURL',
            onClick: () => onImportCurl(),
          },
        ]
      : []),
    ...(onImportHar
      ? [
          {
            key: 'import-har',
            icon: <DownloadOutlined />,
            label: 'Import from HAR',
            onClick: () => onImportHar(),
          },
        ]
      : []),
    ...(onImportPostman
      ? [
          {
            key: 'import-postman',
            icon: <DownloadOutlined />,
            label: 'Import from Postman',
            onClick: () => onImportPostman(),
          },
        ]
      : []),
  ];
}
