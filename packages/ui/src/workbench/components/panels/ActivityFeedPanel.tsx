/**
 * ActivityFeedPanel — F4 sidebar entry, placeholder body for F5.
 *
 * Workspace-wide feed of inbound mutations: every change another peer
 * pushes lands here with classification (create / edit / delete /
 * supersede-local-edit / sensitive-field-rotation /
 * permission-scope-expansion).
 *
 * F4 ships the sidebar entry, the dock slot registration, the unread
 * badge wiring (via {@link ActivityFeedIcon}), and the keyboard
 * shortcut. The actual feed list — entries grouped by `mutationId`,
 * per-entry expand-to-diff, View / Revert / Mute actions — lands in F5
 * once the renderer-facing `listActivity` RPC is plumbed.
 */

import { BellOutlined } from '@ant-design/icons';
import { Empty, theme } from 'antd';
import { useMemo } from 'react';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { useStatus } from '@openheaders/ui/shared/hooks/useStatus';

interface ActivityFeedPanelProps {
  onClose: () => void;
}

const ActivityFeedPanel: React.FC<ActivityFeedPanelProps> = ({ onClose }) => {
  const wiring = useMemo(() => createPanelHeaderWiring({ onHide: onClose }), [onClose]);
  const { token } = theme.useToken();
  const { snapshot } = useStatus();
  const message = snapshot.activity?.message ?? 'Activity up to date';

  return (
    <div
      className="rules-right-panel rules-right-panel--activity"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <PanelHeader wiring={wiring} title={<strong>Activity</strong>} />
      <div
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: 16,
          color: token.colorTextSecondary,
        }}
      >
        <Empty
          image={<BellOutlined style={{ fontSize: 32, color: token.colorTextQuaternary }} />}
          imageStyle={{ height: 40 }}
          description={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>{message}</span>
              <span style={{ fontSize: 12, color: token.colorTextTertiary }}>
                Feed entries will appear here as peers push changes.
              </span>
            </div>
          }
        />
      </div>
    </div>
  );
};

export default ActivityFeedPanel;
