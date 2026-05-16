/**
 * ActivityFeedCard — one row in the F5 panel list.
 *
 * Renders a single {@link ActivityFeedGroup} (one mutationId, one or
 * more classified kinds): entity descriptor + relative time + a chip
 * per distinct kind. Unread groups carry a left accent stripe; read
 * groups render flat. Per-entry actions (View / Revert / Mute) land
 * in F6 as additions to the card's footer.
 */

import { Tag, Tooltip, Typography, theme } from 'antd';
import type { ActivityEntryKind } from '@openheaders/core/sync';
import { formatRelativeMs } from '../live/live-display';
import type { ActivityFeedGroup } from './activity-feed-group';

const { Text } = Typography;

interface ActivityFeedCardProps {
  group: ActivityFeedGroup;
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

const ActivityFeedCard: React.FC<ActivityFeedCardProps> = ({ group }) => {
  const { token } = theme.useToken();
  const { primary, kinds, read } = group;
  const time = formatRelativeMs(primary.observedAt);
  const isoTime = new Date(primary.observedAt).toISOString();

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
    </div>
  );
};

export default ActivityFeedCard;
