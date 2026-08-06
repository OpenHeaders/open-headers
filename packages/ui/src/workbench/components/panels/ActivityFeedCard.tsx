/**
 * ActivityFeedCard — one row in the F5 panel list.
 *
 * Renders a single {@link ActivityFeedGroup} (one mutationId, one or
 * more classified kinds): entity descriptor + relative time + a chip
 * per distinct kind + a footer of per-entry actions. Unread groups
 * carry a left accent stripe; read groups render flat.
 *
 * F6 actions surface as buttons in the footer when their callbacks
 * are wired. `onView` is hidden when the entity has no editor surface
 * (singletons that ride ambient UI, files catalogue, etc.) — see
 * `isViewableEntityType` in `activity-view-router.ts`.
 */

import type { MessageKey } from '@openheaders/i18n';
import { Button, Space, Tag, Tooltip, Typography, theme } from 'antd';
import { useEffect, useMemo, useRef } from 'react';
import type { ActivityEntry, ActivityEntryKind } from '@openheaders/core/sync';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { canRevertEntry, getEntryInverse, getEntryRevertUnavailableReason } from '@openheaders/ui/shared/hooks/activity/useActivityRevert';
import { formatRelativeMs } from '../live/live-display';
import type { ActivityFeedGroup } from './activity-feed-group';
import { isViewableEntityType } from './activity-view-router';

const { Text } = Typography;

export interface ActivityFeedCardProps {
  group: ActivityFeedGroup;
  /** Open the entity in its editor tab. Hidden when undefined or when
   *  the entity type has no editor surface. */
  onView?: (entityType: string, entityId: string) => void;
  /** Mute future inbound activity for this entity. Hidden when undefined. */
  onMute?: (entityType: string, entityId: string) => void;
  /** Inverse of {@link onMute}. Surfaces only when the entity is muted. */
  onUnmute?: (entityType: string, entityId: string) => void;
  /** True when the entity is already muted in this workspace. */
  isMuted?: boolean;
  /**
   * Emit the inverse of this group's underlying mutation. Hidden when
   * undefined; disabled (with a tooltip) when the structural entry
   * carries an `unavailable` inverse spec (e.g. delete-irreversible).
   * Triggered against the structural entry within the group — there is
   * one inverse per mutationId.
   */
  onRevert?: (entry: ActivityEntry) => void;
  /**
   * Fired once per card lifetime when the card has been continuously
   * visible (≥50% intersection) for {@link SEEN_DWELL_MS}. Receives the
   * still-unread entry ids the panel should mark read. Skipped entirely
   * when the card has no unread entries or when IntersectionObserver
   * isn't available (jsdom, ancient browsers — read state stays
   * unchanged in those cases, which is the safe default).
   */
  onSeen?: (entryIds: readonly string[]) => void;
}

/** Continuous-visibility dwell before a card is considered "seen". */
const SEEN_DWELL_MS = 400;

/**
 * Find the entry within the group whose `context.inverse` was stamped
 * by the classifier (the structural row). Returns `null` when no entry
 * in the group carries an inverse — the card hides the Revert button
 * entirely in that case.
 */
function pickRevertEntry(group: ActivityFeedGroup): ActivityEntry | null {
  for (const entry of group.entries) {
    if (getEntryInverse(entry) !== null) return entry;
  }
  return null;
}

interface KindMeta {
  readonly labelKey: MessageKey;
  readonly color: string;
  readonly tooltipKey: MessageKey;
}

// Highlight kinds get a warning color; structural kinds use neutral
// tags. The classifier keeps highlight kinds rare, so the warning
// shade reading is intentional — these are the rows users should care
// about most.
const KIND_META: Record<ActivityEntryKind, KindMeta> = {
  'create-entity': {
    labelKey: 'workbench.activityFeed.kind.created',
    color: 'green',
    tooltipKey: 'workbench.activityFeed.kind.createdTip',
  },
  'edit-entity': {
    labelKey: 'workbench.activityFeed.kind.edited',
    color: 'blue',
    tooltipKey: 'workbench.activityFeed.kind.editedTip',
  },
  'delete-entity': {
    labelKey: 'workbench.activityFeed.kind.deleted',
    color: 'red',
    tooltipKey: 'workbench.activityFeed.kind.deletedTip',
  },
  'supersede-local-edit': {
    labelKey: 'workbench.activityFeed.kind.superseded',
    color: 'orange',
    tooltipKey: 'workbench.activityFeed.kind.supersededTip',
  },
  'sensitive-field-rotation': {
    labelKey: 'workbench.activityFeed.kind.sensitiveRotation',
    color: 'gold',
    tooltipKey: 'workbench.activityFeed.kind.sensitiveRotationTip',
  },
  'permission-scope-expansion': {
    labelKey: 'workbench.activityFeed.kind.scopeWidened',
    color: 'volcano',
    tooltipKey: 'workbench.activityFeed.kind.scopeWidenedTip',
  },
  'agent-observe': {
    labelKey: 'workbench.activityFeed.kind.agentObserved',
    color: 'purple',
    tooltipKey: 'workbench.activityFeed.kind.agentObservedTip',
  },
};

function entityLabel(entityType: string, entityId: string): string {
  // Singleton entities use a stable id (e.g. `vault` / `oauth`) — show
  // the type alone in those cases so the row reads naturally. For
  // multi-instance entities (rule / request / template / ...), show
  // type + short id suffix.
  if (entityId === entityType || entityId === 'workspace') return entityType;
  const tail = entityId.length > 10 ? `${entityId.slice(0, 8)}…` : entityId;
  return `${entityType} · ${tail}`;
}

const ActivityFeedCard: React.FC<ActivityFeedCardProps> = ({
  group,
  onView,
  onMute,
  onUnmute,
  isMuted = false,
  onRevert,
  onSeen,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const { primary, kinds, read } = group;
  const cardRef = useRef<HTMLDivElement>(null);
  // Unread entries within this group. Joined as a stable string key so
  // the observer effect's dependency array doesn't re-fire on every
  // render — only on real membership changes.
  const unreadIds = useMemo(
    () => group.entries.filter((e) => !e.read).map((e) => e.id),
    [group.entries],
  );
  const unreadKey = unreadIds.join('|');
  const seenFiredRef = useRef(false);

  useEffect(() => {
    if (!onSeen || unreadIds.length === 0 || seenFiredRef.current) return;
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    let dwellTimer: number | null = null;
    const clearDwell = (): void => {
      if (dwellTimer !== null) {
        window.clearTimeout(dwellTimer);
        dwellTimer = null;
      }
    };
    const observer = new IntersectionObserver(
      (records) => {
        const visible = records.some((r) => r.isIntersecting && r.intersectionRatio >= 0.5);
        if (visible) {
          if (dwellTimer === null && !seenFiredRef.current) {
            dwellTimer = window.setTimeout(() => {
              dwellTimer = null;
              seenFiredRef.current = true;
              onSeen(unreadIds);
            }, SEEN_DWELL_MS);
          }
        } else {
          clearDwell();
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    observer.observe(el);
    return () => {
      clearDwell();
      observer.disconnect();
    };
    // unreadKey covers id-set membership changes; the array reference
    // changes every render but the key only changes when reads land.
  }, [onSeen, unreadKey, unreadIds]);
  const time = formatRelativeMs(primary.observedAt);
  const isoTime = new Date(primary.observedAt).toISOString();
  // Hide the View affordance for deleted entities — the editor tab
  // would open against a tombstoned id and render an empty form. The
  // delete row stays in the feed for context, just without the button.
  const canView =
    onView !== undefined && isViewableEntityType(primary.entityType) && !kinds.includes('delete-entity');
  const canMute = onMute !== undefined && onUnmute !== undefined;
  // Revert acts on the structural entry's inverse-mutation spec. The
  // sentinel `unavailable` variant renders the button as disabled
  // rather than hidden so the user understands why this particular
  // mutation can't be reverted (e.g. deletes are permanent).
  // An agent read that projected RAW values under the archived-session
  // unredacted grant (AGENT_TRAFFIC_PLAN.md §11.5) — flagged on the
  // entry by the observe sink; surfaced here so "what did the agent
  // look at" includes "and how".
  const rawRead = kinds.includes('agent-observe') && group.entries.some((e) => e.context?.raw === true);
  const revertEntry = onRevert !== undefined ? pickRevertEntry(group) : null;
  const revertEnabled = revertEntry !== null && canRevertEntry(revertEntry);
  const revertUnavailableReason = revertEntry !== null ? getEntryRevertUnavailableReason(revertEntry) : null;
  const canRevert = revertEntry !== null;
  const hasFooter = canView || canMute || canRevert;

  return (
    <div
      ref={cardRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '8px 10px',
        background: read ? token.colorBgContainer : token.colorInfoBg,
        borderLeft: read
          ? `2px solid transparent`
          : `2px solid ${token.colorInfo}`,
        borderRadius: token.borderRadiusSM,
      }}
      data-mutation-id={group.mutationId}
      data-unread={!read}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Text strong style={{ fontSize: 13 }}>
          {entityLabel(primary.entityType, primary.entityId)}
        </Text>
        <Tooltip title={isoTime}>
          <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
            {time}
          </Text>
        </Tooltip>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {kinds.map((kind) => {
          const meta = KIND_META[kind];
          return (
            <Tooltip key={kind} title={t(meta.tooltipKey)}>
              <Tag color={meta.color} style={{ marginInlineEnd: 0 }}>
                {t(meta.labelKey)}
              </Tag>
            </Tooltip>
          );
        })}
        {rawRead && (
          <Tooltip title={t('workbench.activityFeed.rawReadTip')}>
            <Tag color="red" style={{ marginInlineEnd: 0 }} data-testid="activity-feed-raw-read">
              {t('workbench.activityFeed.rawRead')}
            </Tag>
          </Tooltip>
        )}
      </div>
      {primary.summary && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {primary.summary}
        </Text>
      )}
      {hasFooter && (
        <Space size={8} style={{ marginTop: 2 }}>
          {canView && (
            <Button
              size="small"
              type="link"
              style={{ padding: 0, height: 'auto', fontSize: 12 }}
              onClick={() => onView?.(primary.entityType, primary.entityId)}
            >
              {t('workbench.activityFeed.view')}
            </Button>
          )}
          {canMute && (
            <Tooltip
              title={isMuted ? t('workbench.activityFeed.unmuteTip') : t('workbench.activityFeed.muteTip')}
            >
              <Button
                size="small"
                type="link"
                style={{ padding: 0, height: 'auto', fontSize: 12 }}
                onClick={() =>
                  (isMuted ? onUnmute : onMute)?.(primary.entityType, primary.entityId)
                }
              >
                {isMuted ? t('workbench.activityFeed.unmute') : t('workbench.activityFeed.mute')}
              </Button>
            </Tooltip>
          )}
          {canRevert && (
            <Tooltip
              title={
                revertEnabled
                  ? t('workbench.activityFeed.revertTip')
                  : revertUnavailableReason === 'delete-irreversible'
                    ? t('workbench.activityFeed.revertUnavailableDelete')
                    : t('workbench.activityFeed.revertUnavailable')
              }
            >
              <Button
                size="small"
                type="link"
                style={{ padding: 0, height: 'auto', fontSize: 12 }}
                disabled={!revertEnabled}
                onClick={() => revertEntry && onRevert?.(revertEntry)}
              >
                {t('workbench.activityFeed.revert')}
              </Button>
            </Tooltip>
          )}
        </Space>
      )}
    </div>
  );
};

export default ActivityFeedCard;
