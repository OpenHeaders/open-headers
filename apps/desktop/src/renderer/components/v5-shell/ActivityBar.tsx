/**
 * ActivityBar — permanent vertical icon strip for switching sidebar panels.
 *
 * Always visible on the far left. Clicking an icon:
 *   - If that panel is already shown → hides the sidebar
 *   - If a different panel is shown → switches to that panel
 *   - If sidebar is hidden → shows it with that panel
 *
 * This matches the standard IDE pattern.
 */

import {
  AppstoreOutlined,
  ClockCircleOutlined,
  FolderOutlined,
  SettingOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { Dropdown, Tooltip, theme } from 'antd';
import { useState } from 'react';
import type { ActivityPanel } from './V5Shell';

interface ActivityBarProps {
  activePanel: ActivityPanel;
  sidebarVisible: boolean;
  onPanelToggle: (panel: ActivityPanel) => void;
  onOpenSettings?: () => void;
}

const PANELS: Array<{ key: ActivityPanel; icon: React.ReactNode; label: string }> = [
  { key: 'items', icon: <AppstoreOutlined />, label: 'Items' },
  { key: 'recordings', icon: <VideoCameraOutlined />, label: 'Recordings' },
  { key: 'history', icon: <ClockCircleOutlined />, label: 'History' },
  { key: 'files', icon: <FolderOutlined />, label: 'Local Files' },
];

export function ActivityBar({ activePanel, sidebarVisible, onPanelToggle, onOpenSettings }: ActivityBarProps) {
  const { token } = theme.useToken();
  const [showLabels, setShowLabels] = useState(true);

  const contextMenuItems = [
    {
      key: 'show-labels',
      label: `${showLabels ? '✓ ' : ''}Show Labels`,
      onClick: () => setShowLabels((v) => !v),
    },
  ];

  return (
    <Dropdown menu={{ items: contextMenuItems }} trigger={['contextMenu']}>
      <div
        className={`v5-activity-bar ${showLabels ? '' : 'compact'}`}
        style={{
          background: token.colorBgLayout,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          {PANELS.map((panel) => {
            const isActive = sidebarVisible && activePanel === panel.key;
            return (
              <Tooltip key={panel.key} title={panel.label} placement="right" open={showLabels ? false : undefined}>
                <div
                  className={`v5-activity-icon ${isActive ? 'active' : ''}`}
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
                  onClick={() => onPanelToggle(panel.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onPanelToggle(panel.key);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  {panel.icon}
                  {showLabels && <span className="v5-activity-label">{panel.label}</span>}
                </div>
              </Tooltip>
            );
          })}
        </div>

        {/* Settings at bottom */}
        {onOpenSettings && (
          <Tooltip title="Settings" placement="right" open={showLabels ? false : undefined}>
            <div
              className="v5-activity-icon"
              style={{ color: token.colorTextSecondary, marginBottom: 4 }}
              onClick={onOpenSettings}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onOpenSettings();
              }}
              role="button"
              tabIndex={0}
            >
              <SettingOutlined />
              {showLabels && <span className="v5-activity-label">Settings</span>}
            </div>
          </Tooltip>
        )}
      </div>
    </Dropdown>
  );
}
