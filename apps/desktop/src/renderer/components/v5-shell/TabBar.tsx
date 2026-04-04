/**
 * TabBar — horizontal tab strip with pinning, unsaved indicators, overflow, and close.
 */

import { CloseOutlined, EllipsisOutlined, PushpinOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Dropdown, theme } from 'antd';
import type { Tab } from './hooks/useTabs';

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onSwitch: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onTogglePin: (tabId: string) => void;
  maxVisibleTabs?: number;
}

function TabIcon({ tab }: { tab: Tab }) {
  const { token } = theme.useToken();

  switch (tab.type) {
    case 'request':
      return (
        <span
          className="v5-method-badge"
          style={{
            background:
              tab.icon === 'POST' ? token.colorSuccess : tab.icon === 'DELETE' ? token.colorError : token.colorPrimary,
          }}
        >
          {tab.icon ?? 'GET'}
        </span>
      );
    case 'rule':
      return <ThunderboltOutlined style={{ color: token.colorWarning, fontSize: 11 }} />;
    case 'environment':
      return <span style={{ fontSize: 11 }}>🌐</span>;
    case 'recording':
      return <span style={{ fontSize: 11 }}>🎬</span>;
    default:
      return null;
  }
}

export function TabBar({
  tabs,
  activeTabId,
  onSwitch,
  onClose,
  onTogglePin: _onTogglePin,
  maxVisibleTabs = 8,
}: TabBarProps) {
  const { token } = theme.useToken();

  const visibleTabs = tabs.slice(0, maxVisibleTabs);
  const overflowTabs = tabs.slice(maxVisibleTabs);

  return (
    <div
      className="v5-tabs-bar"
      style={{
        background: token.colorBgElevated,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div className="v5-tabs-scroll">
        {visibleTabs.map((tab) => (
          <div
            key={tab.id}
            className={`v5-tab ${tab.id === activeTabId ? 'active' : ''}`}
            style={
              tab.id === activeTabId
                ? { background: token.colorBgContainer, borderBottomColor: token.colorPrimary, color: token.colorText }
                : { color: token.colorTextSecondary }
            }
            onClick={() => onSwitch(tab.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              // Context menu would go here
            }}
            role="tab"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSwitch(tab.id);
            }}
          >
            {tab.pinned && <PushpinOutlined style={{ fontSize: 9, color: token.colorTextTertiary }} />}
            <TabIcon tab={tab} />
            <span className="v5-tab-label">{tab.label}</span>
            {tab.unsaved && <span className="v5-tab-unsaved" style={{ background: token.colorTextSecondary }} />}
            {!tab.pinned && (
              <CloseOutlined
                className="v5-tab-close"
                style={{ color: token.colorTextTertiary, fontSize: 10 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
              />
            )}
          </div>
        ))}
      </div>

      {overflowTabs.length > 0 && (
        <Dropdown
          menu={{
            items: overflowTabs.map((tab) => ({
              key: tab.id,
              label: tab.label,
              icon: <TabIcon tab={tab} />,
              onClick: () => onSwitch(tab.id),
            })),
          }}
          trigger={['click']}
        >
          <div className="v5-tab-overflow" style={{ borderLeft: `1px solid ${token.colorBorderSecondary}` }}>
            <EllipsisOutlined />
            <span
              className="v5-tab-overflow-count"
              style={{ background: token.colorBgElevated, color: token.colorTextSecondary }}
            >
              +{overflowTabs.length}
            </span>
          </div>
        </Dropdown>
      )}
    </div>
  );
}
