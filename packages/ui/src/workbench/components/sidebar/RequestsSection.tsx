/**
 * RequestsSection — the `api-requests` view's single REQUESTS section.
 * Header `+` opens the import/create menu; the body renders the request
 * collection tree with folder-reorder dnd (or the empty-state Create
 * link). Owns only its own `theme.useToken()` read; the node tree, its
 * dnd config, the import menu, the create action, and the expansion state
 * arrive as props.
 */

import { PlusOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Dropdown, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { FolderDndConfig } from './FolderDndTree';
import { SectionHeader } from './SectionHeader';
import type { TreeNode } from './types';
import type { SidebarNodeRenderers } from './useSidebarNodeRenderers';

interface RequestsSectionProps {
  sectionsExpanded: Record<string, boolean>;
  toggleSection: (key: string) => void;
  requestImportMenuItems: MenuProps['items'];
  requestNodes: TreeNode[];
  requestFolderDndConfig: FolderDndConfig;
  createNewRequestCollection: () => Promise<void>;
  renderFolderDndNodes: SidebarNodeRenderers['renderFolderDndNodes'];
}

const RequestsSection: React.FC<RequestsSectionProps> = ({
  sectionsExpanded,
  toggleSection,
  requestImportMenuItems,
  requestNodes,
  requestFolderDndConfig,
  createNewRequestCollection,
  renderFolderDndNodes,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <>
      <SectionHeader
        title={t('workbench.sidebar.section.requests')}
        expanded={sectionsExpanded['api-requests']}
        onToggle={() => toggleSection('api-requests')}
        actions={
          <Dropdown menu={{ items: requestImportMenuItems }} trigger={['click']} placement="bottomRight">
            <PlusOutlined
              style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'pointer' }}
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>
        }
      />
      {sectionsExpanded['api-requests'] && (
        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'none' }}>
          {renderFolderDndNodes(requestNodes, requestFolderDndConfig, () => void createNewRequestCollection())}
        </div>
      )}
    </>
  );
};

export default RequestsSection;
