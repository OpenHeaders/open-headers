/**
 * ActivityFeedPanel — Phase C F5.
 *
 * Workspace-wide feed of inbound mutations: every change another peer
 * pushed lands here with classification (create / edit / delete /
 * supersede-local-edit / sensitive-field-rotation /
 * permission-scope-expansion). Rows are grouped by `mutationId` so a
 * single envelope that fans out to a structural kind + one or more
 * highlight kinds renders as one card with multiple chips, never as
 * separate rows.
 *
 * Data flow:
 *   - {@link useActivityFeed} seeds the list via `oh.sync.listActivity`
 *     and live-tails via `bridge.subscribe('activityEntry')`.
 *   - Mark-read fires when a card scrolls into view (IntersectionObserver)
 *     so the unread badge decays passively.
 *
 * F6 actions (View / Revert / Mute) and F7 auto-decay land in their own
 * slices.
 */

import { HistoryOutlined } from '@ant-design/icons';
import { Empty, List, Spin, theme } from 'antd';
import { useEffect, useMemo, useRef } from 'react';
import type { ActivityEntry } from '@openheaders/core/sync';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/useActiveWorkspaceId';
import { useActivityFeed } from '@openheaders/ui/shared/hooks/useActivityFeed';
import { useActivityMutes } from '@openheaders/ui/shared/hooks/useActivityMutes';
import { groupActivityEntriesByMutation } from './activity-feed-group';
import ActivityFeedCard from './ActivityFeedCard';

interface ActivityFeedPanelProps {
  onClose: () => void;
  /**
   * Open the entity in its editor tab. Wired by the workbench shell
   * (App.tsx) via `viewActivityEntity` from `activity-view-router.ts`.
   * Optional so the panel can render in isolation (storybook /
   * standalone hosts) without a viewer.
   */
  onViewEntity?: (entityType: string, entityId: string) => void;
}

const ActivityFeedPanel: React.FC<ActivityFeedPanelProps> = ({ onClose, onViewEntity }) => {
  const wiring = useMemo(() => createPanelHeaderWiring({ onHide: onClose }), [onClose]);
  const { token } = theme.useToken();
  const workspaceId = useActiveWorkspaceId();
  const { entries, isLoading, markRead } = useActivityFeed(workspaceId);
  const { isMuted, mute, unmute } = useActivityMutes(workspaceId);
  const groups = useMemo(() => groupActivityEntriesByMutation(entries), [entries]);

  // Mark cards read after a short dwell. The list is short and renders
  // newest-first, so the visible rows are exactly the ones the user is
  // looking at — no IntersectionObserver gymnastics needed for F5.
  const seenRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (entries.length === 0) return;
    const handle = window.setTimeout(() => {
      const unread = entries.filter((e) => !e.read && !seenRef.current.has(e.id));
      if (unread.length === 0) return;
      for (const e of unread) seenRef.current.add(e.id);
      markRead(unread.map((e) => e.id));
    }, 750);
    return () => window.clearTimeout(handle);
  }, [entries, markRead]);

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
        }}
      >
        {isLoading && entries.length === 0 ? (
          <div
            style={{
              flex: '1 1 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Spin />
          </div>
        ) : entries.length === 0 ? (
          <div
            style={{
              flex: '1 1 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              color: token.colorTextSecondary,
            }}
          >
            <Empty
              image={<HistoryOutlined style={{ fontSize: 32, color: token.colorTextQuaternary }} />}
              imageStyle={{ height: 40 }}
              description={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span>No activity yet</span>
                  <span style={{ fontSize: 12, color: token.colorTextTertiary }}>
                    Inbound changes from peers will appear here.
                  </span>
                </div>
              }
            />
          </div>
        ) : (
          <List<(typeof groups)[number]>
            size="small"
            dataSource={groups}
            style={{ overflow: 'auto', flex: '1 1 auto' }}
            renderItem={(group) => (
              <List.Item style={{ display: 'block', padding: '6px 10px' }}>
                <ActivityFeedCard
                  group={group}
                  onView={onViewEntity}
                  onMute={mute}
                  onUnmute={unmute}
                  isMuted={isMuted(group.primary.entityType, group.primary.entityId)}
                />
              </List.Item>
            )}
            // Disable antd's split borders; the card draws its own.
            split={false}
          />
        )}
      </div>
    </div>
  );
};

export type { ActivityEntry };
export default ActivityFeedPanel;
