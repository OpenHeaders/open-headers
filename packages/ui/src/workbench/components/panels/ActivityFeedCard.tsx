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

import { Button, Space, Tag, Tooltip, Typography, theme } from 'antd';
import type { ActivityEntry, ActivityEntryKind } from '@openheaders/core/sync';
import { canRevertEntry, getEntryInverse, getEntryRevertUnavailableReason } from '@openheaders/ui/shared/hooks/useActivityRevert';
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
}

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
  readonly label: string;
  readonly color: string;
  readonly tooltip: string;
}

// Highlight kinds get a warning color; structural kinds use neutral
// tags. The classifier keeps highlight kinds rare, so the warning
// shade reading is intentional — these are the rows users should care
// about most.
const KIND_META: Record<ActivityEntryKind, KindMeta> = {
  'create-entity': { label: 'Created', color: 'green', tooltip: 'New entity arrived from a peer.' },
  'edit-entity': { label: 'Edited', color: 'blue', tooltip: 'A peer edited fields on this entity.' },
  'delete-entity': { label: 'Deleted', color: 'red', tooltip: 'A peer deleted this entity.' },
  'supersede-local-edit': {
    label: 'Overrode local edit',
    color: 'orange',
    tooltip: 'An inbound mutation overrode your in-flight local edit.',
  },
  'sensitive-field-rotation': {
    label: 'Sensitive field rotated',
    color: 'gold',
    tooltip: 'A sensitive field (secret / token / sensitive header) was replaced.',
  },
  'permission-scope-expansion': {
    label: 'Scope widened',
    color: 'volcano',
    tooltip: 'A rule condition was loosened — the rule now matches a wider URL/method set.',
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
}) => {
  const { token } = theme.useToken();
  const { primary, kinds, read } = group;
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
  const revertEntry = onRevert !== undefined ? pickRevertEntry(group) : null;
  const revertEnabled = revertEntry !== null && canRevertEntry(revertEntry);
  const revertUnavailableReason = revertEntry !== null ? getEntryRevertUnavailableReason(revertEntry) : null;
  const canRevert = revertEntry !== null;
  const hasFooter = canView || canMute || canRevert;

  return (
    <div
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
            <Tooltip key={kind} title={meta.tooltip}>
              <Tag color={meta.color} style={{ marginInlineEnd: 0 }}>
                {meta.label}
              </Tag>
            </Tooltip>
          );
        })}
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
              View
            </Button>
          )}
          {canMute && (
            <Tooltip
              title={
                isMuted
                  ? 'Stop suppressing inbound activity for this entity.'
                  : 'Suppress further inbound activity rows for this entity. Past rows are kept.'
              }
            >
              <Button
                size="small"
                type="link"
                style={{ padding: 0, height: 'auto', fontSize: 12 }}
                onClick={() =>
                  (isMuted ? onUnmute : onMute)?.(primary.entityType, primary.entityId)
                }
              >
                {isMuted ? 'Unmute' : 'Mute'}
              </Button>
            </Tooltip>
          )}
          {canRevert && (
            <Tooltip
              title={
                revertEnabled
                  ? 'Apply the inverse of this change. Emits a new mutation that brings the entity back to its pre-inbound state.'
                  : revertUnavailableReason === 'delete-irreversible'
                    ? 'Deletes are permanent and cannot be reverted (§7.2 delete-wins).'
                    : 'This change cannot be reverted.'
              }
            >
              <Button
                size="small"
                type="link"
                style={{ padding: 0, height: 'auto', fontSize: 12 }}
                disabled={!revertEnabled}
                onClick={() => revertEntry && onRevert?.(revertEntry)}
              >
                Revert
              </Button>
            </Tooltip>
          )}
        </Space>
      )}
    </div>
  );
};

export default ActivityFeedCard;
