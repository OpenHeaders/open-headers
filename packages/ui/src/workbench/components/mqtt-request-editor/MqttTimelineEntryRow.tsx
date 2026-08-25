/**
 * MqttTimelineEntryRow — one display entry of the MQTT timeline,
 * rendered from the model plane's `MqttTimelineEntry` vocabulary: the
 * lifecycle rows (Connecting / Connected with its expandable CONNACK
 * facts / error / aborted / ended), the subscription facts at their
 * true chronological positions, the message rows (direction glyph ·
 * topic chip · QoS / Retained / DUP tags · payload preview · byte
 * count · session time · expand slot), and the expanded payload
 * viewer. Purely presentational — expansion state and its toggles
 * belong to the orchestrator (`MqttMessageTimeline.tsx`).
 */

import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DisconnectOutlined,
  DownOutlined,
  InfoCircleOutlined,
  MinusCircleOutlined,
  PlusCircleOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { Tag, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import CodeEditor from '../shared/CodeEditor';
import {
  CONNACK_DETAIL_PX,
  cellFont,
  formatMessageTime,
  type MqttFrameDerivations,
  type MqttTimelineEntry,
  type MqttTimelineItem,
  type MqttTimelineLifecycle,
  SINGLE_ROW_PX,
  topicBadgeColor,
  VIEWER_PX,
} from './mqtt-timeline-model';
import { grantLabel } from './session-display';

interface MqttTimelineEntryRowProps {
  entry: MqttTimelineEntry;
  items: readonly MqttTimelineItem[];
  /** Session-only positional times (items[i] ↔ timestamps[i]). */
  timestamps?: readonly number[] | undefined;
  lifecycle: MqttTimelineLifecycle;
  derive: MqttFrameDerivations;
  /** Expanded message-row indexes — the viewer entry follows each. */
  expanded: ReadonlySet<number>;
  /** The Connected row's CONNACK details are open. */
  connackExpanded: boolean;
  onToggleRow: (index: number) => void;
  onToggleConnack: () => void;
  wrapLines: boolean;
}

const MqttTimelineEntryRow: React.FC<MqttTimelineEntryRowProps> = ({
  entry,
  items,
  timestamps,
  lifecycle,
  derive,
  expanded,
  connackExpanded,
  onToggleRow,
  onToggleConnack,
  wrapLines,
}) => {
  const { token } = theme.useToken();
  const t = useT();

  const singleRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: SINGLE_ROW_PX,
    boxSizing: 'border-box',
    padding: '0 10px',
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
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

  // Boxed direction badge — ↑ amber, ↓ blue on their tinted
  // backgrounds (the gRPC/WS anatomy).
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

  const topicChip = (topic: string): React.ReactNode => (
    <Tag
      data-testid="mqtt-timeline-topic-chip"
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

  switch (entry.kind) {
    case 'sent':
      return (
        <div data-testid="mqtt-timeline-sent-row" style={lifecycleRowStyle}>
          <InfoCircleOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t('workbench.editors.mqtt.timeline.connecting')}
          </span>
          {lifecycleTime(lifecycle.startedAt)}
          {expandSlot(null)}
        </div>
      );
    case 'connected': {
      const expandable = lifecycle.connack !== undefined;
      return (
        <div
          data-testid="mqtt-timeline-connected-row"
          {...(expandable
            ? {
                role: 'button',
                tabIndex: 0,
                'aria-expanded': connackExpanded,
                className: 'oh-stream-row',
                onClick: onToggleConnack,
                onKeyDown: (event: React.KeyboardEvent) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onToggleConnack();
                  }
                },
              }
            : {})}
          style={{ ...lifecycleRowStyle, ...(expandable ? { cursor: 'pointer' } : {}) }}
        >
          <CheckCircleOutlined aria-hidden style={{ fontSize: 11, color: token.colorSuccess }} />
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t('workbench.editors.mqtt.timeline.connected')}
          </span>
          {lifecycleTime(lifecycle.connectedAt)}
          {expandSlot(expandable ? connackExpanded : null)}
        </div>
      );
    }
    case 'connackDetail': {
      const connack = lifecycle.connack;
      if (connack === undefined) return null;
      // The CONNACK facts as key: value rows — wire field names raw,
      // the reason code verbatim with its spec name beside it.
      const factRow = (label: string, value: string): React.ReactNode => (
        <div
          key={label}
          style={{
            ...cellFont,
            lineHeight: '20px',
            height: 20,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <span style={{ color: token.colorTextSecondary }}>{label}: </span>
          <span style={{ color: token.colorText }}>{value}</span>
        </div>
      );
      return (
        <div
          data-testid="mqtt-timeline-connack-details"
          style={{
            height: CONNACK_DETAIL_PX,
            boxSizing: 'border-box',
            padding: '6px 10px 6px 37px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            overflow: 'hidden',
          }}
        >
          <div style={{ ...cellFont, fontSize: 11, lineHeight: '18px', height: 18, color: token.colorTextTertiary }}>
            CONNACK
          </div>
          {factRow('cmd', 'connack')}
          {factRow('length', connack.remainingLength !== undefined ? String(connack.remainingLength) : '—')}
          {factRow(
            'reasonCode',
            `${connack.reasonCode}${connack.reasonName !== undefined ? ` (${connack.reasonName})` : ''}`,
          )}
          {factRow('sessionPresent', connack.sessionPresent ? 'true' : 'false')}
        </div>
      );
    }
    case 'abortedEnd':
      // The socket the abort tore down was really up — its close is
      // an event of its own (no captured time of its own: the settle
      // instant rides the aborted row).
      return (
        <div data-testid="mqtt-timeline-aborted-end-row" style={lifecycleRowStyle}>
          <InfoCircleOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t('workbench.editors.mqtt.timeline.abortedDisconnected')}
          </span>
          {lifecycleTime(undefined)}
          {expandSlot(null)}
        </div>
      );
    case 'error': {
      // A user abort is not a failure — the neutral info row.
      if (lifecycle.aborted === true) {
        return (
          <div data-testid="mqtt-timeline-aborted-row" style={lifecycleRowStyle}>
            <InfoCircleOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('workbench.editors.mqtt.timeline.aborted')}
            </span>
            {lifecycleTime(lifecycle.endedAt)}
            {expandSlot(null)}
          </div>
        );
      }
      if (lifecycle.errorMessage === undefined) return null;
      return (
        <div data-testid="mqtt-timeline-error-row" style={lifecycleRowStyle}>
          <CloseCircleOutlined aria-hidden style={{ fontSize: 11, color: token.colorError }} />
          <span
            title={lifecycle.errorMessage}
            data-testid="mqtt-session-error-detail"
            style={{
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: token.colorError,
            }}
          >
            {lifecycle.errorMessage}
          </span>
          {lifecycleTime(lifecycle.endedAt)}
          {expandSlot(null)}
        </div>
      );
    }
    case 'ended': {
      if (lifecycle.endedBy === undefined) return null;
      return (
        <div data-testid="mqtt-timeline-ended-row" style={lifecycleRowStyle}>
          {lifecycle.endedBy === 'close' ? (
            <CheckCircleOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
          ) : (
            <DisconnectOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
          )}
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lifecycle.endedBy === 'close'
              ? t('workbench.editors.mqtt.timeline.disconnected')
              : t('workbench.editors.mqtt.timeline.stopped')}
            {lifecycle.endedMessage ? ` — ${lifecycle.endedMessage}` : ''}
          </span>
          {lifecycleTime(lifecycle.endedAt)}
          {expandSlot(null)}
        </div>
      );
    }
    case 'noMatches':
      return (
        <div style={lifecycleRowStyle}>
          <span>{t('workbench.editors.mqtt.timeline.noMatches')}</span>
        </div>
      );
    case 'row': {
      const item = items[entry.index];
      const ts = timestamps?.[entry.index];
      if (item.kind === 'subscribed') {
        // Prefix + the topic as its colored chip (the message rows'
        // palette — equal topic, equal color) + the SUBACK grant
        // verbatim beside it, failure codes on the error tint.
        return (
          <div data-testid="mqtt-timeline-subscribed-row" style={lifecycleRowStyle}>
            <PlusCircleOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
            <span style={{ flexShrink: 0 }}>{t('workbench.editors.mqtt.timeline.subscribed')}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
              {item.grants.map((grant, grantIndex) => (
                <span
                  key={`${String(grantIndex)}:${grant.topicFilter}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}
                >
                  {topicChip(grant.topicFilter)}
                  <span
                    style={{
                      fontSize: 11,
                      flexShrink: 0,
                      color: grant.reasonCode > 2 ? token.colorError : token.colorTextTertiary,
                    }}
                  >
                    {` (${grantLabel(grant.reasonCode, t)})`}
                  </span>
                </span>
              ))}
            </span>
            {lifecycleTime(ts)}
            {expandSlot(null)}
          </div>
        );
      }
      if (item.kind === 'unsubscribed') {
        return (
          <div data-testid="mqtt-timeline-unsubscribed-row" style={lifecycleRowStyle}>
            <MinusCircleOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
            <span style={{ flexShrink: 0 }}>{t('workbench.editors.mqtt.timeline.unsubscribed')}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
              {item.topicFilters.map((topicFilter, filterIndex) => (
                <span key={`${String(filterIndex)}:${topicFilter}`} style={{ display: 'inline-flex', minWidth: 0 }}>
                  {topicChip(topicFilter)}
                </span>
              ))}
            </span>
            {lifecycleTime(ts)}
            {expandSlot(null)}
          </div>
        );
      }
      const up = item.direction === 'up';
      const isExpanded = expanded.has(entry.index);
      const view = derive.viewOf(item);
      return (
        <div
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          className="oh-stream-row"
          data-testid="mqtt-timeline-message-row"
          onClick={() => onToggleRow(entry.index)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onToggleRow(entry.index);
            }
          }}
          style={{ ...singleRowStyle, cursor: 'pointer' }}
        >
          {directionBadge(up)}
          {topicChip(item.topic)}
          {item.qos > 0 && factTag(`QoS ${item.qos}`, 'mqtt-timeline-qos-tag')}
          {item.retain && factTag(t('workbench.editors.mqtt.timeline.retainedTag'), 'mqtt-timeline-retained-tag')}
          {item.dup && factTag('DUP', 'mqtt-timeline-dup-tag')}
          <span
            style={{
              ...cellFont,
              color: token.colorTextSecondary,
              flex: 1,
              minWidth: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              ...(view.kind === 'binary' ? { fontStyle: 'italic', color: token.colorTextTertiary } : {}),
            }}
          >
            {view.kind === 'binary'
              ? t('workbench.editors.mqtt.timeline.binaryMessage', { bytes: view.byteLength })
              : derive.previewOf(item)}
          </span>
          <span
            style={{ ...cellFont, fontSize: 11, color: token.colorTextTertiary, flexShrink: 0 }}
            data-testid="mqtt-timeline-byte-count"
          >
            {t('workbench.editors.mqtt.timeline.byteCount', { bytes: view.byteLength })}
          </span>
          {ts !== undefined && (
            <span
              data-testid="mqtt-timeline-message-time"
              style={{ ...cellFont, fontSize: 11, color: token.colorTextTertiary, flexShrink: 0 }}
            >
              {formatMessageTime(ts)}
            </span>
          )}
          {expandSlot(isExpanded)}
        </div>
      );
    }
    case 'viewer': {
      const item = items[entry.index];
      if (item.kind !== 'message') return null;
      const view = derive.viewOf(item);
      return (
        <div
          data-testid="mqtt-timeline-message-viewer"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          style={{ height: VIEWER_PX - 1, borderBottom: `1px solid ${token.colorBorderSecondary}` }}
        >
          <CodeEditor
            value={view.text}
            language={view.kind === 'json' ? 'json' : 'text'}
            readOnly
            fill
            variableAutoComplete={false}
            wordWrapOverride={wrapLines ? 'on' : 'off'}
          />
        </div>
      );
    }
    default: {
      const _exhaustive: never = entry;
      void _exhaustive;
      return null;
    }
  }
};

export default MqttTimelineEntryRow;
