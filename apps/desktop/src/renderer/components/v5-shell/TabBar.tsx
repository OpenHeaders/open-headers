/**
 * TabBar — horizontal tab strip for editor tabs.
 *
 * Uses custom CSS tabs instead of antd Tabs to avoid EllipsisMeasure crashes
 * inside Allotment panes. All styles use the existing v5-shell.less classes
 * (.v5-tab, .v5-tab-label, .v5-tab-close, etc.).
 *
 * Features: method-colored labels, unsaved orange dot, close on X, pinned tabs,
 * drag-and-drop reorder, right-click context menu.
 */

import { CloseOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Dropdown, theme } from 'antd';
import { useCallback, useRef, useState } from 'react';
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
  onReorder: (fromId: string, toId: string, side: 'left' | 'right') => void;
  onCloseOther: (tabId: string) => void;
  onCloseAll: () => void;
  onCloseUnmodified: () => void;
  onCloseToLeft: (tabId: string) => void;
  onCloseToRight: (tabId: string) => void;
}

function TabIcon({ tab }: { tab: Tab }) {
  const { token } = theme.useToken();

  if (tab.type === 'request' || tab.type === 'collection') {
    const method = tab.icon || 'GET';
    const color = METHOD_COLORS[method] || token.colorPrimary;
    return (
      <span className="v5-method-badge" style={{ background: color }}>
        {method}
      </span>
    );
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
    return <span style={{ fontSize: 11 }}>&#x2699;</span>;
  }
  return null;
}

export function TabBar({
  tabs,
  activeTabId,
  onSwitch,
  onClose,
  onReorder,
  onCloseOther,
  onCloseAll,
  onCloseUnmodified,
  onCloseToLeft,
  onCloseToRight,
}: TabBarProps) {
  const { token } = theme.useToken();
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragSide, setDragSide] = useState<'left' | 'right' | null>(null);
  const dragSourceRef = useRef<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, tabId: string) => {
    dragSourceRef.current = tabId;
    e.dataTransfer.effectAllowed = 'move';
    // Make the drag image semi-transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragSourceRef.current === tabId) {
      setDragOverId(null);
      return;
    }
    // Determine left/right side based on cursor position
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    setDragOverId(tabId);
    setDragSide(e.clientX < midX ? 'left' : 'right');
  }, []);

  const dragSideRef = useRef<'left' | 'right' | null>(null);
  // Keep ref in sync with state so handleDrop always reads the latest value
  dragSideRef.current = dragSide;

  const handleDrop = useCallback(
    (e: React.DragEvent, tabId: string) => {
      e.preventDefault();
      if (dragSourceRef.current && dragSourceRef.current !== tabId) {
        onReorder(dragSourceRef.current, tabId, dragSideRef.current || 'right');
      }
      dragSourceRef.current = null;
      setDragOverId(null);
      setDragSide(null);
    },
    [onReorder],
  );

  const handleDragEnd = useCallback(() => {
    dragSourceRef.current = null;
    setDragOverId(null);
    setDragSide(null);
  }, []);

  const buildContextMenu = useCallback(
    (tab: Tab, tabIndex: number) => ({
      items: [
        {
          key: 'close',
          label: 'Close',
          onClick: () => onClose(tab.id),
          disabled: tab.pinned,
        },
        {
          key: 'close-others',
          label: 'Close Other Tabs',
          onClick: () => onCloseOther(tab.id),
          disabled: tabs.length <= 1,
        },
        {
          key: 'close-all',
          label: 'Close All Tabs',
          onClick: () => onCloseAll(),
        },
        {
          key: 'close-unmodified',
          label: 'Close Unmodified Tabs',
          onClick: () => onCloseUnmodified(),
        },
        { type: 'divider' as const, key: 'd1' },
        {
          key: 'close-left',
          label: 'Close Tabs to the Left',
          onClick: () => onCloseToLeft(tab.id),
          disabled: tabIndex === 0,
        },
        {
          key: 'close-right',
          label: 'Close Tabs to the Right',
          onClick: () => onCloseToRight(tab.id),
          disabled: tabIndex === tabs.length - 1,
        },
      ],
    }),
    [tabs, onClose, onCloseOther, onCloseAll, onCloseUnmodified, onCloseToLeft, onCloseToRight],
  );

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
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const isDragOver = dragOverId === tab.id;
          const dropIndicatorStyle: React.CSSProperties | undefined =
            isDragOver && dragSide
              ? {
                  [dragSide === 'left' ? 'borderLeft' : 'borderRight']: `2px solid ${token.colorPrimary}`,
                }
              : undefined;

          return (
            <Dropdown key={tab.id} menu={buildContextMenu(tab, index)} trigger={['contextMenu']}>
              <div
                className={`v5-tab${isActive ? ' active' : ''}`}
                style={{
                  color: isActive ? token.colorText : token.colorTextSecondary,
                  borderBottomColor: isActive ? token.colorPrimary : 'transparent',
                  background: isActive ? token.colorBgContainer : undefined,
                  ...dropIndicatorStyle,
                }}
                onClick={() => onSwitch(tab.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSwitch(tab.id);
                }}
                role="tab"
                tabIndex={0}
                aria-selected={isActive}
                draggable
                onDragStart={(e) => handleDragStart(e, tab.id)}
                onDragOver={(e) => handleDragOver(e, tab.id)}
                onDrop={(e) => handleDrop(e, tab.id)}
                onDragEnd={handleDragEnd}
                onDragLeave={() => {
                  if (dragOverId === tab.id) setDragOverId(null);
                }}
              >
                <TabIcon tab={tab} />
                <span className="v5-tab-label">{tab.label}</span>
                {tab.unsaved && <span className="v5-tab-unsaved" style={{ background: '#ff7875' }} />}
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
            </Dropdown>
          );
        })}
      </div>
    </div>
  );
}
