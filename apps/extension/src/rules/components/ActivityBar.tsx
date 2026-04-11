/**
 * ActivityBar — permanent vertical icon strip.
 *
 * Only "Items" is functional; other panels show a "desktop only" tooltip.
 * Mirrors the desktop V5Shell ActivityBar pattern.
 */

import {
  AppstoreOutlined,
  ClockCircleOutlined,
  FolderOutlined,
  SettingOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { Tooltip, theme } from 'antd';
import type React from 'react';
import { forwardRef } from 'react';

interface ActivityBarProps {
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
}

const PANELS: Array<{
  key: string;
  icon: React.ReactNode;
  label: string;
  enabled: boolean;
  tooltip?: string;
}> = [
  { key: 'items', icon: <AppstoreOutlined />, label: 'Items', enabled: true },
  {
    key: 'recordings',
    icon: <VideoCameraOutlined />,
    label: 'Recordings',
    enabled: false,
    tooltip: 'Available in desktop app',
  },
  {
    key: 'history',
    icon: <ClockCircleOutlined />,
    label: 'History',
    enabled: false,
    tooltip: 'Available in desktop app',
  },
  { key: 'files', icon: <FolderOutlined />, label: 'Local Files', enabled: false, tooltip: 'Available in desktop app' },
];

const ActivityBar = forwardRef<HTMLDivElement, ActivityBarProps>(({ sidebarVisible, onToggleSidebar }, ref) => {
  const { token } = theme.useToken();

  return (
    <div
      ref={ref}
      className="rules-activity-bar"
      style={{
        background: token.colorBgLayout,
        borderRight: `1px solid ${token.colorBorderSecondary}`,
      }}
      tabIndex={-1}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        {PANELS.map((panel) => {
          const isActive = panel.key === 'items' && sidebarVisible;
          const tooltipTitle = panel.enabled ? panel.label : panel.tooltip;

          return (
            <Tooltip key={panel.key} title={tooltipTitle} placement="right">
              <div
                className={`rules-activity-icon ${!panel.enabled ? 'disabled' : ''}`}
                style={
                  isActive
                    ? {
                        background: token.colorPrimaryBg,
                        borderLeft: `2px solid ${token.colorPrimary}`,
                        color: token.colorPrimary,
                        borderRadius: 0,
                        width: '100%',
                      }
                    : { color: token.colorTextSecondary }
                }
                onClick={panel.enabled ? onToggleSidebar : undefined}
                role="button"
                tabIndex={panel.enabled ? 0 : -1}
                onKeyDown={(e) => {
                  if (panel.enabled && (e.key === 'Enter' || e.key === ' ')) onToggleSidebar();
                }}
              >
                {panel.icon}
                <span className="rules-activity-label">{panel.label}</span>
              </div>
            </Tooltip>
          );
        })}
      </div>

      {/* Settings at bottom — disabled */}
      <Tooltip title="Available in desktop app" placement="right">
        <div className="rules-activity-icon disabled" style={{ color: token.colorTextSecondary, marginBottom: 4 }}>
          <SettingOutlined />
          <span className="rules-activity-label">Settings</span>
        </div>
      </Tooltip>
    </div>
  );
});

ActivityBar.displayName = 'ActivityBar';

export default ActivityBar;
