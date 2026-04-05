/**
 * TabBar — horizontal tab strip using Ant Design Tabs for proper tab styling.
 *
 * Features: method-colored labels, unsaved orange dot, close on X, pinned tabs.
 */

import { ThunderboltOutlined } from '@ant-design/icons';
import { Space, Tabs, theme } from 'antd';
import type { Tab } from './hooks/useTabs';

const METHOD_COLORS: Record<string, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
};

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onSwitch: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onTogglePin: (tabId: string) => void;
}

function TabLabel({ tab }: { tab: Tab }) {
  const { token } = theme.useToken();

  let icon: React.ReactNode = null;

  if (tab.type === 'request' || tab.type === 'collection') {
    const method = tab.icon || 'GET';
    const color = METHOD_COLORS[method] || token.colorPrimary;
    icon = <span style={{ color, fontWeight: 600, fontSize: 11 }}>{method}</span>;
  } else if (tab.type === 'rule') {
    icon = <ThunderboltOutlined style={{ color: '#1890ff', fontSize: 12 }} />;
  } else if (tab.type === 'environment') {
    icon = (
      <span
        style={{
          background: '#52c41a',
          color: 'white',
          fontSize: 9,
          fontWeight: 700,
          padding: '0 4px',
          borderRadius: 3,
          lineHeight: '16px',
        }}
      >
        E
      </span>
    );
  } else if (tab.type === 'settings') {
    icon = <span style={{ fontSize: 11 }}>⚙</span>;
  }

  return (
    <Space size={4}>
      {icon}
      <span>{tab.label}</span>
      {tab.unsaved && (
        <span
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#ff7875',
            marginLeft: 2,
          }}
        />
      )}
    </Space>
  );
}

export function TabBar({ tabs, activeTabId, onSwitch, onClose }: TabBarProps) {
  const { token } = theme.useToken();

  if (tabs.length === 0) return null;

  const items = tabs.map((tab) => ({
    key: tab.id,
    label: <TabLabel tab={tab} />,
    closable: !tab.pinned,
  }));

  return (
    <div
      className="v5-tabs-bar"
      style={{
        background: token.colorBgElevated,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Tabs
        type="editable-card"
        size="small"
        activeKey={activeTabId ?? undefined}
        onChange={onSwitch}
        onEdit={(targetKey, action) => {
          if (action === 'remove' && typeof targetKey === 'string') {
            onClose(targetKey);
          }
        }}
        items={items}
        hideAdd
        style={{ margin: 0 }}
        tabBarStyle={{ margin: 0, height: 34 }}
      />
    </div>
  );
}
