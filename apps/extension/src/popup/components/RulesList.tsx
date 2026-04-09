import { AppstoreOutlined, AppstoreTwoTone, FolderTwoTone, ThunderboltTwoTone } from '@ant-design/icons';
import { useKeyboardNav } from '@context/KeyboardNavContext';
import { Button, Tabs, Tooltip } from 'antd';
import type React from 'react';
import { getBrowserAPI } from '@/types/browser';
import CollectionManager from './CollectionManager';
import RulesTable from './RulesTable';
import ThisPageRules from './ThisPageRules';

const RulesList: React.FC = () => {
  const { activeTab, onTabChange, focusedRowIndex, pendingDeleteIndex, setPageInfo, setRowActions } = useKeyboardNav();

  const items = [
    {
      key: 'active-rules',
      label: 'This Page',
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
      label: 'All Rules',
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
      label: 'Collections',
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
          <Tooltip title="Open full workspace editor">
            <Button
              size="small"
              icon={<AppstoreOutlined />}
              onClick={() => {
                const url = getBrowserAPI().runtime.getURL('workspace.html');
                getBrowserAPI().tabs.create({ url });
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
