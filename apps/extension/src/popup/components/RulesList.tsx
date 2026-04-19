import { AppstoreOutlined, AppstoreTwoTone, FolderTwoTone, ThunderboltTwoTone } from '@ant-design/icons';
import { useKeyboardNav } from '@context/KeyboardNavContext';
import { Button, Tabs, Tooltip } from 'antd';
import type React from 'react';
import { ShortcutHintTitle } from '@/components/ShortcutKbd';
import { useSurface } from '@/shared/surface';
import { openWorkspace } from '@/shared/workspace-intent';
import { usePopupShortcutLabel } from '../shortcuts/popup-shortcuts';
import CollectionManager from './CollectionManager';
import RulesTable from './RulesTable';
import ThisPageRules from './ThisPageRules';

const RulesList: React.FC = () => {
  const { activeTab, onTabChange, focusedRowIndex, pendingDeleteIndex, setPageInfo, setRowActions } = useKeyboardNav();
  const surface = useSurface();
  const openWorkspaceLabel = usePopupShortcutLabel('open-workspace');

  const items = [
    {
      key: 'active-rules',
      label: <span className="oh-tab-label">This Page</span>,
      children: (
        <ThisPageRules
          isActive={activeTab === 'active-rules'}
          focusedRowIndex={activeTab === 'active-rules' ? focusedRowIndex : -1}
          pendingDeleteIndex={activeTab === 'active-rules' ? pendingDeleteIndex : -1}
          onPageInfoChange={activeTab === 'active-rules' ? setPageInfo : undefined}
          onRowActionsChange={activeTab === 'active-rules' ? setRowActions : undefined}
        />
      ),
      icon: <ThunderboltTwoTone />,
    },
    {
      key: 'all-rules',
      label: <span className="oh-tab-label">All Rules</span>,
      children: (
        <RulesTable
          focusedRowIndex={activeTab === 'all-rules' ? focusedRowIndex : -1}
          pendingDeleteIndex={activeTab === 'all-rules' ? pendingDeleteIndex : -1}
          onPageInfoChange={activeTab === 'all-rules' ? setPageInfo : undefined}
          onRowActionsChange={activeTab === 'all-rules' ? setRowActions : undefined}
        />
      ),
      icon: <AppstoreTwoTone />,
    },
    {
      key: 'collections',
      label: <span className="oh-tab-label">Collections</span>,
      children: (
        <CollectionManager
          isActive={activeTab === 'collections'}
          focusedRowIndex={activeTab === 'collections' ? focusedRowIndex : -1}
          pendingDeleteIndex={activeTab === 'collections' ? pendingDeleteIndex : -1}
          onPageInfoChange={activeTab === 'collections' ? setPageInfo : undefined}
          onRowActionsChange={activeTab === 'collections' ? setRowActions : undefined}
        />
      ),
      icon: <FolderTwoTone />,
    },
  ];

  if (activeTab === null) return null;

  return (
    <Tabs
      activeKey={activeTab}
      onChange={onTabChange}
      items={items}
      type="card"
      size="middle"
      animated={{ inkBar: true, tabPane: false }}
      destroyOnHidden={false}
      className="header-rules-tabs"
      style={{ height: '100%' }}
      tabBarStyle={{ marginBottom: 8, paddingLeft: 8, paddingRight: 8 }}
      tabBarGutter={4}
      tabBarExtraContent={{
        right: (
          <Tooltip title={<ShortcutHintTitle label={openWorkspaceLabel}>Open full workspace editor</ShortcutHintTitle>}>
            <Button
              size="small"
              icon={<AppstoreOutlined />}
              onClick={() => {
                void openWorkspace({ kind: 'open-workspace' }, surface.mode);
              }}
            >
              Workspace
            </Button>
          </Tooltip>
        ),
      }}
    />
  );
};

export default RulesList;
