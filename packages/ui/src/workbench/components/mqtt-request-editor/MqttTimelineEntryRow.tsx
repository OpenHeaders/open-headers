/**
 * MqttTimelineEntryRow — one display entry of the MQTT timeline,
 * rendered from the model plane's `MqttTimelineEntry` vocabulary: the
 * lifecycle rows (Connecting / Connected with its expandable CONNACK
 * facts / error / aborted / ended), the subscription and reconnect-
 * cycle facts (lost / reconnect attempt / reconnected with its own
 * CONNACK block) at their true chronological positions, the message
 * rows (direction glyph · topic chip · QoS / Retained / DUP tags ·
 * payload preview · byte count · session time · expand slot), and the
 * expanded payload viewer. Purely presentational — expansion state and its toggles
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
  ReloadOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { Button, Tag, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { formatDurationMs } from '@openheaders/ui/shared/combo-knob';
import TimelineMessageViewer, { STREAM_HAIRLINE, type TimelineViewerModes } from '../shared/TimelineMessageViewer';
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
import { connackReasonName, connectionEndMessage, grantFailureLabel } from './session-display';

interface MqttTimelineEntryRowProps {
  entry: MqttTimelineEntry;
  items: readonly MqttTimelineItem[];
  /** Session-only positional times (items[i] ↔ timestamps[i]). */
  timestamps?: readonly number[] | undefined;
  lifecycle: MqttTimelineLifecycle;
  /** The session's version lens — names a reconnected row's CONNACK
   *  code in the right numeric space. */
  v5: boolean;
  derive: MqttFrameDerivations;
  /** Expanded row indexes — a message row's viewer / a reconnected
   *  row's CONNACK block follows each. */
  expanded: ReadonlySet<number>;
  /** The Connected row's CONNACK details are open. */
  connackExpanded: boolean;
  onToggleRow: (index: number) => void;
  onToggleConnack: () => void;
  wrapLines: boolean;
  onWrapLinesChange: (wrap: boolean) => void;
  viewerModes: TimelineViewerModes;
  /** A verification failure's remedy — present only when the failure
   *  carries the trust hint; the error row shows the Trust certificate
   *  button that reveals the pane's offer. */
  onTrustCertificate?: () => void;
  /** The offer is showing — the button's pressed state (a11y only). */
  trustOfferOpen?: boolean;
}

const MqttTimelineEntryRow: React.FC<MqttTimelineEntryRowProps> = ({
  entry,
  items,
  timestamps,
  lifecycle,
  v5,
  derive,
  expanded,
  connackExpanded,
  onToggleRow,
  onToggleConnack,
  wrapLines,
  onWrapLinesChange,
  viewerModes,
  onTrustCertificate,
  trustOfferOpen = false,
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
      // The first connection's CONNACK, or — with an index — the
      // CONNACK a reconnected row's attempt received.
      let connack: MqttTimelineLifecycle['connack'];
      if ('index' in entry) {
        const item = items[entry.index];
        if (item.kind !== 'reconnected') return null;
        const reasonName = connackReasonName(item.reasonCode, v5);
        connack = {
          reasonCode: item.reasonCode,
          ...(reasonName !== undefined ? { reasonName } : {}),
          sessionPresent: item.sessionPresent,
          remainingLength: item.remainingLength,
        };
      } else {
        connack = lifecycle.connack;
      }
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
            borderBottom: STREAM_HAIRLINE,
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
      // an event of its own, timed by the end frame's host stamp
      // (absent toward hosts that predate the lifecycle stamps).
      return (
        <div data-testid="mqtt-timeline-aborted-end-row" style={lifecycleRowStyle}>
          <InfoCircleOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t('workbench.editors.mqtt.timeline.abortedDisconnected')}
          </span>
          {lifecycleTime(lifecycle.abortedDisconnectedAt)}
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
          {onTrustCertificate !== undefined && (
            <Button
              size="small"
              aria-pressed={trustOfferOpen}
              onClick={(event) => {
                event.stopPropagation();
                onTrustCertificate();
              }}
              style={{ flexShrink: 0 }}
              data-testid="mqtt-timeline-trust-certificate"
            >
              {t('workbench.editors.mqtt.timeline.trustCertificate')}
            </Button>
          )}
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
        // palette — equal topic, equal color). A SUCCESS grant renders
        // as silence — the subscribed row itself is the answer; only
        // failure codes surface, on the error tint.
        return (
          <div data-testid="mqtt-timeline-subscribed-row" style={lifecycleRowStyle}>
            <PlusCircleOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
            <span style={{ flexShrink: 0 }}>{t('workbench.editors.mqtt.timeline.subscribed')}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
              {item.grants.map((grant, grantIndex) => {
                const failure = grantFailureLabel(grant.reasonCode, t);
                return (
                  <span
                    key={`${String(grantIndex)}:${grant.topicFilter}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}
                  >
                    {topicChip(grant.topicFilter)}
                    {failure !== null && (
                      <span style={{ fontSize: 11, flexShrink: 0, color: token.colorError }}>{` (${failure})`}</span>
                    )}
                  </span>
                );
              })}
            </span>
            {lifecycleTime(ts)}
            {expandSlot(null)}
          </div>
        );
      }
      if (item.kind === 'lost') {
        // The connection dropped under the open session — how it
        // ended, verbatim; auto-reconnect's rows follow.
        return (
          <div data-testid="mqtt-timeline-lost-row" style={lifecycleRowStyle}>
            <DisconnectOutlined aria-hidden style={{ fontSize: 11, color: token.colorWarning }} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {`${t('workbench.editors.mqtt.timeline.lost')} — ${connectionEndMessage(item.end, t)}`}
            </span>
            {lifecycleTime(ts)}
            {expandSlot(null)}
          </div>
        );
      }
      if (item.kind === 'reconnecting') {
        // One redial — asked for, on its wait, or (an older capture)
        // without a stated wait; the previous attempt's classified
        // failure rides beside it when there was one.
        return (
          <div data-testid="mqtt-timeline-reconnecting-row" style={lifecycleRowStyle}>
            <ReloadOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
            <span
              {...(item.error !== undefined ? { title: item.error } : {})}
              style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {item.forced
                ? t('workbench.editors.mqtt.timeline.reconnectingNow', { attempt: item.attempt })
                : item.delayMs === undefined
                  ? t('workbench.editors.mqtt.timeline.reconnecting', { attempt: item.attempt })
                  : t('workbench.editors.mqtt.timeline.reconnectingAfter', {
                      attempt: item.attempt,
                      delay: formatDurationMs(item.delayMs),
                    })}
              {item.error !== undefined ? ` — ${item.error}` : ''}
            </span>
            {lifecycleTime(ts)}
            {expandSlot(null)}
          </div>
        );
      }
      if (item.kind === 'reconnected') {
        // The Connected row's twin for a reconnect attempt that took —
        // expandable to that connection's own CONNACK facts.
        const isExpanded = expanded.has(entry.index);
        return (
          <div
            role="button"
            tabIndex={0}
            aria-expanded={isExpanded}
            className="oh-stream-row"
            data-testid="mqtt-timeline-reconnected-row"
            onClick={() => onToggleRow(entry.index)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onToggleRow(entry.index);
              }
            }}
            style={{ ...lifecycleRowStyle, cursor: 'pointer' }}
          >
            <CheckCircleOutlined aria-hidden style={{ fontSize: 11, color: token.colorSuccess }} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('workbench.editors.mqtt.timeline.reconnected')}
              {item.dropped !== undefined
                ? ` — ${t(
                    item.dropped === 1
                      ? 'workbench.editors.mqtt.timeline.reconnectedDroppedOne'
                      : 'workbench.editors.mqtt.timeline.reconnectedDroppedMany',
                    { count: item.dropped },
                  )}`
                : ''}
            </span>
            {lifecycleTime(ts)}
            {expandSlot(isExpanded)}
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
        <TimelineMessageViewer
          text={view.text}
          defaultFormat={view.kind === 'json' ? 'json' : 'text'}
          hexDump={() => derive.hexOf(item)}
          mode={viewerModes.modeOf(entry.index, view.kind === 'binary')}
          onModeChange={(mode) => viewerModes.setMode(entry.index, mode)}
          wrapLines={wrapLines}
          onWrapLinesChange={onWrapLinesChange}
          actionsRef={viewerModes.actionsOf(entry.index)}
          testIdPrefix="mqtt-timeline"
        />
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
