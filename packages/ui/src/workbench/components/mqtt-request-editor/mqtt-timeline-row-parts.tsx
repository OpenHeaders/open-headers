/**
 * mqtt-timeline-row-parts — the row anatomy every MQTT timeline row
 * composes from: the single-row and lifecycle-row styles, the
 * right-aligned session time, the trailing expand slot, the lifecycle
 * glyph slot, the boxed direction badge, the topic chip and the fact
 * tag. One hook reads the theme and the locale once; the entry row and
 * the group header (in the list and as the sticky overlay) share the
 * result.
 */

import { ArrowDownOutlined, ArrowUpOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Tag, theme } from 'antd';
import type React from 'react';
import { STREAM_HAIRLINE } from '../shared/TimelineMessageViewer';
import { cellFont, formatMessageTime, SINGLE_ROW_PX, topicBadgeColor } from './mqtt-timeline-model';

export interface MqttRowParts {
  singleRowStyle: React.CSSProperties;
  lifecycleRowStyle: React.CSSProperties;
  lifecycleTime: (ts: number | undefined) => React.ReactNode;
  expandSlot: (isExpanded: boolean | null) => React.ReactNode;
  lifecycleGlyph: (icon: React.ReactNode) => React.ReactNode;
  directionBadge: (up: boolean) => React.ReactNode;
  topicChip: (topic: string, testid?: string) => React.ReactNode;
  factTag: (label: string, testid: string) => React.ReactNode;
}

export function useMqttRowParts(): MqttRowParts {
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

  // Trailing expand slot — fixed width on EVERY row so the
  // right-aligned timestamps line up in one column; expandable rows
  // render their chevron in it, the rest leave it empty.
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
  // backgrounds (the gRPC/WS anatomy), shared by message rows and
  // direction-grouped headers.
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
          aria-label={t('workbench.editors.mqtt.timeline.sentAria')}
          style={{ fontSize: 11, color: token.colorTextSecondary }}
        />
      ) : (
        <ArrowDownOutlined
          aria-label={t('workbench.editors.mqtt.timeline.receivedAria')}
          style={{ fontSize: 11, color: token.colorTextSecondary }}
        />
      )}
    </span>
  );

  // The topic as its colored chip — equal topic, equal color — on the
  // message rows, the subscription rows and a topic-grouped header.
  const topicChip = (topic: string, testid = 'mqtt-timeline-topic-chip'): React.ReactNode => (
    <Tag
      data-testid={testid}
      color={topicBadgeColor(topic)}
      style={{
        marginInlineEnd: 0,
        fontSize: 11,
        lineHeight: '18px',
        flexShrink: 1,
        minWidth: 0,
        maxWidth: 220,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {topic}
    </Tag>
  );

  const factTag = (label: string, testid: string): React.ReactNode => (
    <Tag style={{ marginInlineEnd: 0, fontSize: 10, lineHeight: '16px', flexShrink: 0 }} data-testid={testid}>
      {label}
    </Tag>
  );

  return {
    singleRowStyle,
    lifecycleRowStyle,
    lifecycleTime,
    expandSlot,
    lifecycleGlyph,
    directionBadge,
    topicChip,
    factTag,
  };
}
