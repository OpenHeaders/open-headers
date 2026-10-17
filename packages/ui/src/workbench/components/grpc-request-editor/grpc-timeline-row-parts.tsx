/**
 * grpc-timeline-row-parts — the row anatomy every gRPC timeline row
 * composes from: the single-row and lifecycle-row styles, the
 * right-aligned session time, the trailing expand slot, the lifecycle
 * glyph slot, the boxed direction badge and the type chip. One hook
 * reads the theme and the locale once; the entry row and the group
 * header (in the list and as the sticky overlay) share the result.
 */

import { ArrowDownOutlined, ArrowUpOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Tag, theme } from 'antd';
import type React from 'react';
import { STREAM_HAIRLINE } from '../shared/TimelineMessageViewer';
import { cellFont, chipColor, type DirectionChip, formatMessageTime, SINGLE_ROW_PX } from './grpc-timeline-model';

export interface GrpcRowParts {
  singleRowStyle: React.CSSProperties;
  lifecycleRowStyle: React.CSSProperties;
  lifecycleTime: (ts: number | undefined) => React.ReactNode;
  expandSlot: (isExpanded: boolean | null) => React.ReactNode;
  lifecycleGlyph: (icon: React.ReactNode) => React.ReactNode;
  directionBadge: (up: boolean) => React.ReactNode;
  chipTag: (chip: DirectionChip, testid: string) => React.ReactNode;
}

export function useGrpcRowParts(): GrpcRowParts {
  const { token } = theme.useToken();
  const t = useT();

  const singleRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: SINGLE_ROW_PX,
    boxSizing: 'border-box',
    padding: '0 10px',
    borderBottom: STREAM_HAIRLINE,
    overflow: 'hidden',
  };

  const lifecycleRowStyle: React.CSSProperties = {
    ...singleRowStyle,
    color: token.colorTextSecondary,
    fontSize: 12,
  };

  const lifecycleTime = (ts: number | undefined): React.ReactNode =>
    ts !== undefined ? (
      <span style={{ ...cellFont, fontSize: 11, marginLeft: 'auto', color: token.colorTextTertiary }}>
        {formatMessageTime(ts)}
      </span>
    ) : null;

  // Trailing expand slot — fixed width on the timestamped rows so the
  // right-aligned times line up in one column; expandable rows render
  // their chevron in it, the rest leave it empty (the WS/MQTT
  // timelines' anatomy).
  const expandSlot = (isExpanded: boolean | null): React.ReactNode => (
    <span
      aria-hidden
      style={{ width: 12, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {isExpanded !== null &&
        (isExpanded ? (
          <UpOutlined style={{ fontSize: 9, color: token.colorTextTertiary }} />
        ) : (
          <DownOutlined style={{ fontSize: 9, color: token.colorTextTertiary }} />
        ))}
    </span>
  );

  // Lifecycle glyph — centered in the direction badge's 18px slot so
  // every row's leading mark sits on ONE column, drawn at the size the
  // badge reads at (the circle's footprint ≈ the tinted box).
  const lifecycleGlyph = (icon: React.ReactNode): React.ReactNode => (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        flexShrink: 0,
        fontSize: 15,
      }}
    >
      {icon}
    </span>
  );

  // Boxed direction badge — ↑ amber, ↓ blue on their tinted
  // backgrounds (the Postman anatomy; the tint tokens adapt per
  // theme), shared by message rows and direction-grouped headers.
  const directionBadge = (up: boolean): React.ReactNode => (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        borderRadius: 4,
        flexShrink: 0,
        background: up ? token.colorWarningBgHover : token.colorPrimaryBg,
      }}
    >
      {up ? (
        <ArrowUpOutlined
          aria-label={t('workbench.editors.grpc.timeline.sentAria')}
          style={{ fontSize: 11, color: token.colorTextSecondary }}
        />
      ) : (
        <ArrowDownOutlined
          aria-label={t('workbench.editors.grpc.timeline.receivedAria')}
          style={{ fontSize: 11, color: token.colorTextSecondary }}
        />
      )}
    </span>
  );

  const chipTag = (chip: DirectionChip, testid: string): React.ReactNode => (
    <Tag
      data-testid={testid}
      color={chip.resolved ? chipColor(chip.name) : undefined}
      style={{
        marginInlineEnd: 0,
        fontSize: 11,
        lineHeight: '18px',
        flexShrink: 0,
        ...(chip.resolved ? {} : { fontStyle: 'italic', color: token.colorTextTertiary }),
      }}
    >
      {chip.name}
    </Tag>
  );

  return { singleRowStyle, lifecycleRowStyle, lifecycleTime, expandSlot, lifecycleGlyph, directionBadge, chipTag };
}
