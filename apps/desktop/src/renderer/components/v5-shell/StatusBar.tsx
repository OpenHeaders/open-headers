/**
 * StatusBar — bottom bar with status info and panel toggle icons.
 *
 * Left: clients, active rules, git sync.
 * Right: workspace, environment, version, panel toggles.
 */

import {
  CheckOutlined,
  CodeOutlined,
  GlobalOutlined,
  LayoutOutlined,
  SwapOutlined,
  SyncOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Dropdown, Space, Tooltip, theme } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useWorkspaces } from '@/renderer/hooks/useCentralizedWorkspace';

interface PanelVisibility {
  sidebar: boolean;
  workbench: boolean;
  bottomPanel: boolean;
  inspector: boolean;
}

interface StatusBarProps {
  panels: PanelVisibility;
  onTogglePanel: (panel: keyof PanelVisibility) => void;
  onOpenBottomTab?: (tab: string) => void;
  responseSideBySide?: boolean;
  onToggleResponseLayout?: () => void;
  onResetLayout?: () => void;
  sidebarsSwapped?: boolean;
  onSwapSidebars?: () => void;
}

function PanelToggle({
  title,
  shortcut,
  active,
  position,
  onClick,
  tooltipPlacement = 'top',
}: {
  title: string;
  shortcut: string;
  active: boolean;
  position: 'left' | 'bottom' | 'right';
  onClick: () => void;
  tooltipPlacement?: 'top' | 'topRight' | 'topLeft';
}) {
  const { token } = theme.useToken();
  const fillColor = active ? token.colorTextSecondary : 'none';
  const strokeColor = token.colorTextTertiary;

  return (
    <Tooltip title={`${title} (${shortcut})`} placement={tooltipPlacement}>
      <div
        className="v5-panel-toggle"
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onClick();
        }}
        role="button"
        tabIndex={0}
      >
        <svg viewBox="0 0 16 13" width={16} height={13} role="img">
          <title>{title}</title>
          <rect x="0.5" y="0.5" width="15" height="12" rx="1.5" fill="none" stroke={strokeColor} strokeWidth={1} />
          {position === 'left' && (
            <>
              <rect
                x="0.5"
                y="0.5"
                width="4.5"
                height="12"
                rx="1.5"
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={1}
                opacity={active ? 0.35 : 0.15}
              />
              <line x1="5" y1="0.5" x2="5" y2="12.5" stroke={strokeColor} strokeWidth={1} />
            </>
          )}
          {position === 'bottom' && (
            <>
              <rect
                x="0.5"
                y="8.5"
                width="15"
                height="4"
                rx="1.5"
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={1}
                opacity={active ? 0.35 : 0.15}
              />
              <line x1="0.5" y1="8.5" x2="15.5" y2="8.5" stroke={strokeColor} strokeWidth={1} />
            </>
          )}
          {position === 'right' && (
            <>
              <rect
                x="11"
                y="0.5"
                width="4.5"
                height="12"
                rx="1.5"
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={1}
                opacity={active ? 0.35 : 0.15}
              />
              <line x1="11" y1="0.5" x2="11" y2="12.5" stroke={strokeColor} strokeWidth={1} />
            </>
          )}
        </svg>
      </div>
    </Tooltip>
  );
}

export function StatusBar({
  panels,
  onTogglePanel,
  onOpenBottomTab,
  responseSideBySide,
  onToggleResponseLayout,
  onResetLayout,
  sidebarsSwapped,
  onSwapSidebars,
}: StatusBarProps) {
  const { token } = theme.useToken();
  const { workspaces, activeWorkspaceId, switchWorkspace, syncStatus } = useWorkspaces();
  const [appVersion, setAppVersion] = useState(window.startupData?.version ?? '');
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [clientCount, setClientCount] = useState(0);

  useEffect(() => {
    if (!appVersion && window.electronAPI?.getAppVersion) {
      window.electronAPI
        .getAppVersion()
        .then(setAppVersion)
        .catch(() => {});
    }
  }, [appVersion]);

  const fetchClientCount = useCallback(async () => {
    try {
      if (window.electronAPI?.wsGetConnectionStatus) {
        const status = await window.electronAPI.wsGetConnectionStatus();
        setClientCount(status.totalConnections);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchClientCount();
    const interval = setInterval(() => void fetchClientCount(), 5000);
    const unsubscribe = window.electronAPI?.onWsConnectionStatusChanged?.((data) => {
      setClientCount(data.totalConnections ?? 0);
    });
    return () => {
      clearInterval(interval);
      unsubscribe?.();
    };
  }, [fetchClientCount]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const workspaceName = activeWorkspace?.name ?? 'Workspace';
  const isSyncing = syncStatus[activeWorkspaceId]?.syncing;

  // Workspace dropdown menu items
  const workspaceMenuItems = workspaces.map((ws) => {
    const isActive = ws.id === activeWorkspaceId;
    const wsIcon = ws.type === 'git' ? <TeamOutlined key="icon" /> : <UserOutlined key="icon" />;
    const wsSyncInfo = syncStatus[ws.id];
    return {
      key: ws.id,
      label: (
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            {wsIcon}
            <span>{ws.name}</span>
            {ws.type === 'git' && wsSyncInfo?.syncing && <SyncOutlined spin style={{ fontSize: 12 }} />}
          </Space>
          {isActive && <CheckOutlined style={{ color: token.colorPrimary }} />}
        </Space>
      ),
      onClick: () => {
        if (!isActive) void switchWorkspace(ws.id);
      },
    };
  });

  return (
    <div
      className="v5-statusbar"
      style={{
        background: token.colorBgContainer,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        color: token.colorTextSecondary,
      }}
    >
      <div className="v5-statusbar-left">
        <span className="v5-statusbar-item">
          <span
            className="v5-dot"
            style={{ background: clientCount > 0 ? token.colorSuccess : token.colorTextTertiary }}
          />
          {clientCount} client{clientCount !== 1 ? 's' : ''}
        </span>
        <span
          className="v5-statusbar-item"
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onClick={() => onOpenBottomTab?.('traffic')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onOpenBottomTab?.('traffic');
          }}
        >
          <SwapOutlined style={{ fontSize: 11 }} /> Traffic
        </span>
        <span
          className="v5-statusbar-item"
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onClick={() => onOpenBottomTab?.('console')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onOpenBottomTab?.('console');
          }}
        >
          <CodeOutlined style={{ fontSize: 11 }} /> Console
        </span>
        <span
          className="v5-statusbar-item"
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onClick={() => onOpenBottomTab?.('terminal')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onOpenBottomTab?.('terminal');
          }}
        >
          <GlobalOutlined style={{ fontSize: 11 }} /> Terminal
        </span>
      </div>

      <div className="v5-statusbar-right">
        <Dropdown menu={{ items: workspaceMenuItems }} trigger={['click']} placement="topRight">
          <span className="v5-statusbar-item" style={{ cursor: 'pointer' }}>
            {activeWorkspace?.type === 'git' ? (
              <TeamOutlined style={{ fontSize: 10 }} />
            ) : (
              <UserOutlined style={{ fontSize: 10 }} />
            )}
            {workspaceName}
            {isSyncing && <SyncOutlined spin style={{ fontSize: 9 }} />}▾
          </span>
        </Dropdown>
        {appVersion && (
          <span className="v5-statusbar-item" style={{ fontSize: 10, color: token.colorTextTertiary }}>
            v{appVersion}
          </span>
        )}
        <div className="v5-statusbar-divider" style={{ background: token.colorBorderSecondary }} />

        <div className="v5-panel-toggles">
          <PanelToggle
            title="Left sidebar"
            shortcut="⌘B"
            active={panels.sidebar}
            position={sidebarsSwapped ? 'right' : 'left'}
            onClick={() => onTogglePanel('sidebar')}
          />
          <PanelToggle
            title="Bottom bar"
            shortcut="⌘J"
            active={panels.bottomPanel}
            position="bottom"
            onClick={() => onTogglePanel('bottomPanel')}
          />
          <PanelToggle
            title="Right sidebar"
            shortcut="⌥⌘\"
            active={panels.inspector}
            position={sidebarsSwapped ? 'left' : 'right'}
            onClick={() => onTogglePanel('inspector')}
            tooltipPlacement="topRight"
          />
          <Dropdown
            menu={{
              items: [
                {
                  key: 'two-pane',
                  label: 'Two-pane response view',
                  icon: responseSideBySide ? <CheckOutlined /> : null,
                  extra: '⌘⇧V',
                  onClick: onToggleResponseLayout,
                },
                { type: 'divider' },
                {
                  key: 'sidebar',
                  label: 'Left sidebar',
                  icon: panels.sidebar ? <CheckOutlined /> : null,
                  extra: '⌘B',
                  onClick: () => onTogglePanel('sidebar'),
                },
                {
                  key: 'workbench',
                  label: 'Middle workbench',
                  icon: panels.workbench ? <CheckOutlined /> : null,
                  extra: '⌘⇧M',
                  onClick: () => onTogglePanel('workbench'),
                },
                {
                  key: 'bottomPanel',
                  label: 'Bottom bar',
                  icon: panels.bottomPanel ? <CheckOutlined /> : null,
                  extra: '⌘J',
                  onClick: () => onTogglePanel('bottomPanel'),
                },
                {
                  key: 'inspector',
                  label: 'Right sidebar',
                  icon: panels.inspector ? <CheckOutlined /> : null,
                  extra: '⌥⌘\\',
                  onClick: () => onTogglePanel('inspector'),
                },
                {
                  key: 'swap',
                  label: 'Swap left and right sidebars',
                  icon: sidebarsSwapped ? <CheckOutlined /> : null,
                  extra: '⌘⇧S',
                  onClick: onSwapSidebars,
                },
                { type: 'divider' },
                {
                  key: 'reset',
                  label: 'Reset layout',
                  extra: '⌘⇧R',
                  onClick: onResetLayout,
                },
              ] satisfies MenuProps['items'],
            }}
            trigger={['click']}
            placement="topRight"
            onOpenChange={setLayoutMenuOpen}
          >
            <Tooltip title="Customize layout" placement="topRight" open={layoutMenuOpen ? false : undefined}>
              <div className="v5-panel-toggle" style={{ cursor: 'pointer' }}>
                <LayoutOutlined style={{ fontSize: 13, color: token.colorTextTertiary }} />
              </div>
            </Tooltip>
          </Dropdown>
        </div>
      </div>
    </div>
  );
}
