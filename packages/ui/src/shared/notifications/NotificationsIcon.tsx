/**
 * NotificationsIcon — tool-window icon for the `notifications` registry
 * entry. A bell with a small light-blue dot while entries are unseen;
 * the dot clears when the user closes the panel (see NotificationsPanel)
 * and re-lights on the next new entry.
 */

import { BellOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import type React from 'react';
import { useUnseenNotificationCount } from './store';

const NotificationsIcon: React.FC = () => {
  const { token } = theme.useToken();
  const unseen = useUnseenNotificationCount();
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <BellOutlined />
      {unseen > 0 && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: -3,
            right: -4,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: token.colorPrimaryHover,
            pointerEvents: 'none',
          }}
        />
      )}
    </span>
  );
};

export default NotificationsIcon;
