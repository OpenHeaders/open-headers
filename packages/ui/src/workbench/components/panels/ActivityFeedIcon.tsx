/**
 * ActivityFeedIcon — tool-window icon for the `activity` registry entry.
 *
 * A history glyph with a small grey dot while unread entries exist —
 * the same affordance as {@link NotificationsIcon}'s blue dot, in a
 * neutral tone since activity is ambient rather than actionable. The
 * unread count comes from the Status subsystem snapshot —
 * `snapshot.activity.context.unread` — which the F3 status reporter
 * (extension SW today, desktop main next) writes on every classified
 * inbound entry and re-baselines on workspace switch.
 *
 * Self-contained: stateful tool-window icons are allowed because the
 * registry treats `icon` as `React.ReactNode`. Keeping the dot wiring
 * here means {@link tool-windows} stays a flat declarative table.
 */

import { HistoryOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import { useStatus } from '@openheaders/ui/shared/hooks/useStatus';

const ActivityFeedIcon: React.FC = () => {
  const { token } = theme.useToken();
  const { snapshot } = useStatus();
  const rawUnread = snapshot.activity?.context?.unread;
  const unread = typeof rawUnread === 'number' && rawUnread > 0 ? rawUnread : 0;

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <HistoryOutlined />
      {unread > 0 && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: -3,
            right: -4,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: token.colorTextTertiary,
            pointerEvents: 'none',
          }}
        />
      )}
    </span>
  );
};

export default ActivityFeedIcon;
