/**
 * ActivityFeedIcon — tool-window icon for the `activity` registry entry.
 *
 * Wraps a {@link BellOutlined} in an antd {@link Badge} so the activity-bar
 * chip pulses an unread count next to the icon. The count comes from the
 * Status subsystem snapshot — `snapshot.activity.context.unread` — which
 * the F3 status reporter (extension SW today, desktop main next) writes
 * on every classified inbound entry and re-baselines on workspace switch.
 *
 * Self-contained: stateful tool-window icons are allowed because the
 * registry treats `icon` as `React.ReactNode`. Keeping the badge wiring
 * here means {@link tool-windows} stays a flat declarative table.
 */

import { HistoryOutlined } from '@ant-design/icons';
import { Badge } from 'antd';
import { useStatus } from '@openheaders/ui/shared/hooks/useStatus';

const ActivityFeedIcon: React.FC = () => {
  const { snapshot } = useStatus();
  const rawUnread = snapshot.activity?.context?.unread;
  const unread = typeof rawUnread === 'number' && rawUnread > 0 ? rawUnread : 0;

  return (
    <Badge
      count={unread}
      size="small"
      offset={[2, -2]}
      // The tab strip places this inside a small chip; cap the rendered
      // number so a runaway feed never breaks the bar's width budget.
      overflowCount={99}
    >
      <HistoryOutlined />
    </Badge>
  );
};

export default ActivityFeedIcon;
