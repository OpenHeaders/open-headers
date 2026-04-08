/**
 * TabBar — horizontal tab strip for open rule editors.
 *
 * Mirrors the desktop V5Shell TabBar (simplified for extension).
 * Features: rule type icons, unsaved dot, close button, scrollable, + button.
 */

import {
  CloseOutlined,
  CodeOutlined,
  LinkOutlined,
  PlusOutlined,
  SendOutlined,
  StopOutlined,
  SwapOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Dropdown, Tooltip, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import type { RulesTab } from '../types';

const RULE_TYPE_ICONS: Record<string, React.ReactNode> = {
  header: <SwapOutlined style={{ fontSize: 12, color: '#1890ff' }} />,
  block: <StopOutlined style={{ fontSize: 12, color: '#f5222d' }} />,
  redirect: <SendOutlined style={{ fontSize: 12, color: '#fa8c16' }} />,
  'query-param': <LinkOutlined style={{ fontSize: 12, color: '#52c41a' }} />,
  inject: <CodeOutlined style={{ fontSize: 12, color: '#722ed1' }} />,
};

interface TabBarProps {
  tabs: RulesTab[];
  activeTabId: string | null;
  onSwitch: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onCreateRule: (type: string) => void;
}

const TabBar: React.FC<TabBarProps> = ({ tabs, activeTabId, onSwitch, onClose, onCreateRule }) => {
  const { token } = theme.useToken();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll active tab into view
  useEffect(() => {
    if (!scrollRef.current || !activeTabId) return;
    const activeEl = scrollRef.current.querySelector(`[data-tab-id="${activeTabId}"]`) as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeTabId]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  const createMenuItems = [
    { key: 'header', icon: <SwapOutlined />, label: 'Modify Headers', onClick: () => onCreateRule('header') },
    { key: 'block', icon: <StopOutlined />, label: 'Block Requests', onClick: () => onCreateRule('block') },
    { key: 'redirect', icon: <SendOutlined />, label: 'Redirect Requests', onClick: () => onCreateRule('redirect') },
    { key: 'query-param', icon: <LinkOutlined />, label: 'Modify Query Params', onClick: () => onCreateRule('query-param') },
    { key: 'inject', icon: <CodeOutlined />, label: 'Inject Scripts/CSS', onClick: () => onCreateRule('inject') },
  ];

  return (
    <div
      className="rules-tabs-bar"
      style={{
        background: token.colorBgLayout,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div className="rules-tabs-scroll" ref={scrollRef} onWheel={handleWheel}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <Tooltip key={tab.id} title={tab.label} placement="bottom" mouseEnterDelay={0.5}>
              <div
                className={`rules-tab${isActive ? ' active' : ''}`}
                data-tab-id={tab.id}
                style={{
                  color: isActive ? token.colorText : token.colorTextSecondary,
                  borderBottomColor: isActive ? token.colorPrimary : 'transparent',
                  background: isActive ? token.colorBgContainer : undefined,
                }}
                onClick={() => onSwitch(tab.id)}
                role="tab"
                tabIndex={0}
                aria-selected={isActive}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSwitch(tab.id);
                }}
              >
                <span className="rules-type-badge">
                  {RULE_TYPE_ICONS[tab.ruleType] ?? <ThunderboltOutlined style={{ fontSize: 12 }} />}
                </span>
                <span className="rules-tab-label">{tab.label}</span>
                {tab.dirty && (
                  <span className="rules-tab-unsaved" style={{ background: '#ff7875' }} />
                )}
                <CloseOutlined
                  className="rules-tab-close"
                  style={{ fontSize: 10, color: token.colorTextTertiary }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(tab.id);
                  }}
                />
              </div>
            </Tooltip>
          );
        })}

        {/* + button */}
        <Dropdown menu={{ items: createMenuItems }} trigger={['click']} placement="bottomRight">
          <div className="rules-tab-action" style={{ color: token.colorTextSecondary, flexShrink: 0 }}>
            <PlusOutlined style={{ fontSize: 12 }} />
          </div>
        </Dropdown>
      </div>
    </div>
  );
};

export default TabBar;
