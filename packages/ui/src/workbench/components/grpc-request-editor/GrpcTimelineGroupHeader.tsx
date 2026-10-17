/**
 * GrpcTimelineGroupHeader — one group-header row, shared by the
 * in-list entry and the sticky overlay (same anatomy, same collapse
 * action, distinct testid). The marks are the identity's enabled
 * axes: direction badge, type chip, or both (the compound grouping);
 * an un-windowed group's re-window action rides the header beside the
 * total, past a divider.
 */

import { CaretRightOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Typography, theme } from 'antd';
import type React from 'react';
import { type DirectionChips, type GrpcGroupIdentity, groupChip } from './grpc-timeline-model';
import { useGrpcRowParts } from './grpc-timeline-row-parts';

const { Text } = Typography;

interface GrpcTimelineGroupHeaderProps {
  group: GrpcGroupIdentity;
  memberCount: number;
  collapsed: boolean;
  chips: DirectionChips;
  groupRowLimit: number;
  /** The group lifted its row-limit window — the re-window action shows. */
  unwindowed: boolean;
  onToggle: (key: string) => void;
  onToggleWindow: (key: string) => void;
  testId: string;
}

const GrpcTimelineGroupHeader: React.FC<GrpcTimelineGroupHeaderProps> = ({
  group,
  memberCount,
  collapsed,
  chips,
  groupRowLimit,
  unwindowed,
  onToggle,
  onToggleWindow,
  testId,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const { singleRowStyle, directionBadge, chipTag } = useGrpcRowParts();
  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={!collapsed}
      data-testid={testId}
      onClick={() => onToggle(group.key)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggle(group.key);
        }
      }}
      style={{ ...singleRowStyle, background: token.colorFillQuaternary, cursor: 'pointer' }}
    >
      <CaretRightOutlined
        aria-hidden
        rotate={collapsed ? 0 : 90}
        style={{ fontSize: 10, color: token.colorTextTertiary }}
      />
      {group.direction !== null && directionBadge(group.direction === 'up')}
      {group.name !== null && chipTag(groupChip(chips, group.name), 'grpc-timeline-group-badge')}
      <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
        {t('workbench.editors.grpc.timeline.messageCount', { count: memberCount })}
      </Text>
      {/* Re-window action for an un-windowed group — a group-level
          mode switch, so it rides the header (beside the total, past a
          divider) rather than a positional row. Clicks stay off the
          header's collapse action. */}
      {!collapsed && groupRowLimit > 0 && unwindowed && memberCount > groupRowLimit && (
        <>
          <span aria-hidden style={{ width: 1, height: 14, background: token.colorBorderSecondary }} />
          <span
            role="button"
            tabIndex={0}
            data-testid="grpc-timeline-group-rewindow"
            onClick={(event) => {
              event.stopPropagation();
              onToggleWindow(group.key);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onToggleWindow(group.key);
              }
            }}
            style={{ fontSize: 11, color: token.colorPrimary, whiteSpace: 'nowrap', cursor: 'pointer' }}
          >
            {t('shared.timelineGroup.showNewestOnly', { count: groupRowLimit })}
          </span>
        </>
      )}
    </div>
  );
};

export default GrpcTimelineGroupHeader;
