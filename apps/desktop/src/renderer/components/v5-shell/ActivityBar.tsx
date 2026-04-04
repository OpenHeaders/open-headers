/**
 * ActivityBar — vertical icon strip for switching sidebar panels.
 *
 * Icons: Items (primary), Recordings, History, Files.
 */

import { AppstoreOutlined, ClockCircleOutlined, FolderOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { Tooltip, theme } from 'antd';
import type { ActivityPanel } from './V5Shell';

interface ActivityBarProps {
  activePanel: ActivityPanel;
  onPanelChange: (panel: ActivityPanel) => void;
}

const PANELS: Array<{ key: ActivityPanel; icon: React.ReactNode; label: string }> = [
  { key: 'items', icon: <AppstoreOutlined />, label: 'Items' },
  { key: 'recordings', icon: <VideoCameraOutlined />, label: 'Recordings' },
  { key: 'history', icon: <ClockCircleOutlined />, label: 'History' },
  { key: 'files', icon: <FolderOutlined />, label: 'Local Files' },
];

export function ActivityBar({ activePanel, onPanelChange }: ActivityBarProps) {
  const { token } = theme.useToken();

  return (
    <div
      className="v5-activity-bar"
      style={{
        background: token.colorBgElevated,
        borderRight: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      {PANELS.map((panel) => (
        <Tooltip key={panel.key} title={panel.label} placement="right">
          <div
            className={`v5-activity-icon ${activePanel === panel.key ? 'active' : ''}`}
            style={
              activePanel === panel.key
                ? {
                    background: token.colorBgContainer,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    color: token.colorText,
                  }
                : { color: token.colorTextSecondary }
            }
            onClick={() => onPanelChange(panel.key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onPanelChange(panel.key);
            }}
            role="button"
            tabIndex={0}
          >
            {panel.icon}
          </div>
        </Tooltip>
      ))}
    </div>
  );
}
