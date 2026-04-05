/**
 * TabBar — horizontal tab strip for editor tabs.
 *
 * Uses custom CSS tabs instead of antd Tabs to avoid EllipsisMeasure crashes
 * inside Allotment panes. All styles use the existing v5-shell.less classes
 * (.v5-tab, .v5-tab-label, .v5-tab-close, etc.).
 *
 * Features: method-colored labels, unsaved orange dot, close on X, pinned tabs.
 */

import { CloseOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { theme } from 'antd';
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

function TabIcon({ tab }: { tab: Tab }) {
  const { token } = theme.useToken();

  if (tab.type === 'request' || tab.type === 'collection') {
    const method = tab.icon || 'GET';
    const color = METHOD_COLORS[method] || token.colorPrimary;
    return <span className="v5-method-badge" style={{ background: color }}>{method}</span>;
  }
  if (tab.type === 'rule') {
    return <ThunderboltOutlined style={{ color: '#1890ff', fontSize: 12 }} />;
  }
  if (tab.type === 'environment') {
    return (
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
  }
  if (tab.type === 'settings') {
    return <span style={{ fontSize: 11 }}>⚙</span>;
  }
  return null;
}

export function TabBar({ tabs, activeTabId, onSwitch, onClose }: TabBarProps) {
  const { token } = theme.useToken();

  if (tabs.length === 0) return null;

  return (
    <div
      className="v5-tabs-bar"
      style={{
        background: token.colorBgLayout,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div className="v5-tabs-scroll">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`v5-tab${isActive ? ' active' : ''}`}
              style={{
                color: isActive ? token.colorText : token.colorTextSecondary,
                borderBottomColor: isActive ? token.colorPrimary : 'transparent',
                background: isActive ? token.colorBgContainer : undefined,
              }}
              onClick={() => onSwitch(tab.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSwitch(tab.id);
              }}
              role="tab"
              tabIndex={0}
              aria-selected={isActive}
            >
              <TabIcon tab={tab} />
              <span className="v5-tab-label">{tab.label}</span>
              {tab.unsaved && (
                <span className="v5-tab-unsaved" style={{ background: '#ff7875' }} />
              )}
              {!tab.pinned && (
                <CloseOutlined
                  className="v5-tab-close"
                  style={{ fontSize: 10, color: token.colorTextTertiary }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(tab.id);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
