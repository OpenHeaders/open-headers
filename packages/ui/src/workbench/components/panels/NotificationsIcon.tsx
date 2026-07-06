/**
 * NotificationsIcon — tool-window icon for the `notifications` registry
 * entry. A bell with a small primary-colored dot while entries pushed
 * since the panel was last viewed are pending; opening the panel marks
 * them seen and the dot clears.
 */

import { BellOutlined } from '@ant-design/icons';
import { Badge, theme } from 'antd';
import type React from 'react';
import { useUnseenNotificationCount } from '../../notifications/store';

const NotificationsIcon: React.FC = () => {
  const { token } = theme.useToken();
  const unseen = useUnseenNotificationCount();
  return (
    <Badge dot={unseen > 0} color={token.colorPrimary} offset={[1, 1]}>
      <BellOutlined />
    </Badge>
  );
};

export default NotificationsIcon;
