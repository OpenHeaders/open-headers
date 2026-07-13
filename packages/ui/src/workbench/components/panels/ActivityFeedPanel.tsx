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
 *   - Mark-read fires per-card via an IntersectionObserver in
 *     {@link ActivityFeedCard}: only rows the user actually scrolled
 *     into view (≥50% intersection for ~400ms) flip read. A short
 *     panel-level still exists as a fallback for environments without
 *     IntersectionObserver (jsdom / very old browsers).
 *   - Revert results surface as toasts so failures aren't silent.
 */

import { HistoryOutlined } from '@ant-design/icons';
import { App as AntApp, Empty, List, Spin, theme } from 'antd';
import { useCallback, useMemo } from 'react';
import type { ActivityEntry } from '@openheaders/core/sync';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useActivityFeed } from '@openheaders/ui/shared/hooks/activity/useActivityFeed';
import { useActivityMutes } from '@openheaders/ui/shared/hooks/activity/useActivityMutes';
import { humanizeRevertReason, useActivityRevert } from '@openheaders/ui/shared/hooks/activity/useActivityRevert';
import { groupActivityEntriesByMutation } from './activity-feed-group';
import ActivityFeedCard from './ActivityFeedCard';

interface ActivityFeedPanelProps {
  /** Title-bar `(i)` popover copy. */
  info: InfoPopoverContent;
  onClose: () => void;
  /**
   * Open the entity in its editor tab. Wired by the workbench shell
   * (App.tsx) via `viewActivityEntity` from `activity-view-router.ts`.
   * Optional so the panel can render in isolation (storybook /
   * standalone hosts) without a viewer.
   */
  onViewEntity?: (entityType: string, entityId: string) => void;
}

const ActivityFeedPanel: React.FC<ActivityFeedPanelProps> = ({ info, onClose, onViewEntity }) => {
  const wiring = useMemo(() => createPanelHeaderWiring({ onHide: onClose }), [onClose]);
  const { token } = theme.useToken();
  const workspaceId = useActiveWorkspaceId();
  const { entries, isLoading, markRead } = useActivityFeed(workspaceId);
  const { isMuted, mute, unmute } = useActivityMutes(workspaceId);
  const { revert } = useActivityRevert(workspaceId);
  const { message } = AntApp.useApp();
  const handleRevert = useCallback(
    async (entry: ActivityEntry) => {
      const result = await revert(entry);
      if (result.ok) {
        message.success('Change reverted');
      } else {
        message.error(`Revert failed: ${humanizeRevertReason(result.reason)}`);
      }
    },
    [revert, message],
  );
  const handleCardSeen = useCallback(
    (entryIds: readonly string[]) => {
      if (entryIds.length === 0) return;
      markRead(entryIds);
    },
    [markRead],
  );
  const groups = useMemo(() => groupActivityEntriesByMutation(entries), [entries]);

  return (
    <div
      className="rules-right-panel rules-right-panel--activity"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <PanelHeader wiring={wiring} title={<strong>Activity</strong>} info={info} />
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
            style={{ overflow: 'auto', overscrollBehavior: 'none', flex: '1 1 auto' }}
            renderItem={(group) => (
              <List.Item style={{ display: 'block', padding: '6px 10px' }}>
                <ActivityFeedCard
                  group={group}
                  onView={onViewEntity}
                  onMute={mute}
                  onUnmute={unmute}
                  isMuted={isMuted(group.primary.entityType, group.primary.entityId)}
                  onRevert={handleRevert}
                  onSeen={handleCardSeen}
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
