/**
 * MqttSessionPane — the session result surface for an MqttRequest, the
 * `WsSessionPane` sibling: one pane across both phases — live
 * (CONNECTED badge, timeline fed from the `mqttStreamEvent` feed) and
 * materialized (the end record rendered honestly — the clean
 * Disconnect, a broker DISCONNECT with its verbatim reason, the
 * severed-connection absence, Stopped, or the reconnect the broker
 * refused — timeline fed from the snapshot's capture with the
 * session's timestamps joined positionally). Between connections of
 * an auto-reconnecting session the badge reads RECONNECTING. The
 * header is ONE row in the HTTP ResponsePanel's format: tabs left,
 * meta strip right-aligned in the tab bar.
 * Pre-open failures (the session never opened — a CONNACK refusal
 * included, its reason verbatim) render through the SAME pane: the
 * classified message rides the timeline as its error row and the meta
 * strip pills Connect failed — never a bare error wall.
 *
 * The Connection tab states the CONNACK facts — session present,
 * reason code (spec name BESIDE the verbatim number), and the client
 * id the CONNECT actually carried — and nothing more (the capture
 * law's display twin: facts, never synthesis).
 */

import { ClearOutlined, CloseOutlined, EllipsisOutlined } from '@ant-design/icons';
import type { ExecutedMqttSnapshot, MqttRequestProtocolVersion } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Dropdown, Tabs, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import ProxyRouteTag, { proxyRouteHasBadge } from '../request-editor/response/ProxyRouteTag';
import { useTonePillStyle } from '../request-editor/response/response-status';
import TrustCertificateOffer from '../request-editor/response/TrustCertificateOffer';
import ConnectionDetailsTooltip, { type ConnectionDetailsRow } from '../shared/ConnectionDetailsTooltip';
import { ExampleChip } from '../shared/ExampleChip';
import MqttMessageTimeline from './MqttMessageTimeline';
import {
  isReconnectItem,
  type MqttTimelineItem,
  type MqttTimelineLifecycle,
  reconnectingAt,
} from './mqtt-timeline-model';
import { connackReasonLabel, connackReasonName, reconnectLoopEndTagKey, sessionEndedMessage } from './session-display';
import type { LiveMqttSession, MqttSessionTiming } from './useLiveMqttSession';

const { Text } = Typography;

interface MqttSessionPaneProps {
  /** Non-null while the session is open. */
  live: LiveMqttSession | null;
  /** Non-null once the session settled. */
  snapshot: ExecutedMqttSnapshot | null;
  /** Session-only timing captured at materialization. */
  timing: MqttSessionTiming | null;
  /** The session's version knob — scopes the reason-code name space
   *  the display labels ride (codes themselves render verbatim). */
  protocolVersion: MqttRequestProtocolVersion;
  /** Per-knob honesty notice for a page-realm session — names the
   *  configured node-only knobs that did not apply on this host.
   *  Stated inline for the session's whole life, never a gate. */
  hostNotice?: string | null;
  onClear: () => void;
  /** "Save Response" — present only when the settled session can be
   *  captured as an example (connected, non-error). First item of the
   *  ⋯ actions menu. */
  onSaveResponse?: () => void;
  /** Live subscribed-topics count for the meta strip's summary
   *  affordance (rendered only while the session is open). */
  subscribedTopicsCount?: number;
  /** Clicking the summary jumps to the compose Topics tab. */
  onShowTopics?: () => void;
  /** Connect again after a trust gesture — the editor's Connect. */
  onReconnect?: () => void;
}

const MqttSessionPane: React.FC<MqttSessionPaneProps> = ({
  live,
  snapshot,
  timing,
  protocolVersion,
  hostNotice,
  onClear,
  onSaveResponse,
  subscribedTopicsCount,
  onShowTopics,
  onReconnect,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const [activeTab, setActiveTab] = useState('timeline');
  // A verification failure's remedy — shown only once the error row's
  // Trust certificate button asks for it; a new session closes it.
  const trustHint = snapshot?.outcome.kind === 'failed' ? (snapshot.outcome.hint ?? null) : null;
  const [trustOfferOpen, setTrustOfferOpen] = useState(false);
  useEffect(() => {
    if (trustHint === null) setTrustOfferOpen(false);
  }, [trustHint]);
  const [subsHovered, setSubsHovered] = useState(false);
  const v5 = protocolVersion !== '3.1.1';

  const noticeStrip =
    hostNotice != null && hostNotice !== '' ? (
      <div
        style={{
          padding: '4px 12px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          flexShrink: 0,
        }}
        data-testid="mqtt-host-knob-notice"
      >
        <Text type="warning" style={{ fontSize: 11 }}>
          {hostNotice}
        </Text>
      </div>
    ) : null;

  const connack = snapshot?.connack ?? live?.open ?? null;
  const clientId = snapshot?.clientId ?? live?.open?.clientId ?? '';

  const connackFacts = useMemo((): MqttTimelineLifecycle['connack'] => {
    if (connack === null) return undefined;
    const reasonName = connackReasonName(connack.reasonCode, v5);
    return {
      reasonCode: connack.reasonCode,
      ...(reasonName !== undefined ? { reasonName } : {}),
      sessionPresent: connack.sessionPresent,
      ...(connack.remainingLength !== undefined ? { remainingLength: connack.remainingLength } : {}),
    };
  }, [connack, v5]);

  const endedMessage = useMemo(
    () => (snapshot === null ? undefined : sessionEndedMessage(snapshot, t)),
    [snapshot, t],
  );

  // The live phase between connections — auto-reconnect is redialing;
  // read off the item log's last reconnect-cycle fact.
  const reconnecting = live !== null && snapshot === null && reconnectingAt(live.items, live.count);

  const lifecycle = useMemo((): MqttTimelineLifecycle => {
    if (snapshot === null) {
      return {
        ...(live !== null ? { startedAt: live.startedAt } : {}),
        connected: live !== null && live.open !== null,
        ...(live?.connectedAt !== undefined ? { connectedAt: live.connectedAt } : {}),
        ...(connackFacts !== undefined ? { connack: connackFacts } : {}),
      };
    }
    // A pre-open failure (a CONNACK refusal included) settles as the
    // timeline's error row — the classified message verbatim at the
    // new edge; never an opened-session end row. A USER abort (the
    // Cancel click / Stop) renders as the neutral aborted row instead.
    // Terminal instants prefer the observed truth: the end frame's
    // host stamp for the teardown, the Cancel click for the abort;
    // the editor's settle stamp stays the fallback toward hosts that
    // predate the lifecycle stamps.
    const teardownAt = timing?.disconnectedAt ?? timing?.endedAt;
    if (snapshot.outcome.kind !== 'connected') {
      const aborted = snapshot.outcome.kind === 'aborted';
      const terminalAt = aborted ? (timing?.closeRequestedAt ?? timing?.endedAt) : teardownAt;
      return {
        ...(timing?.startedAt !== undefined ? { startedAt: timing.startedAt } : {}),
        connected: false,
        ...(connackFacts !== undefined ? { connack: connackFacts } : {}),
        ...(snapshot.outcome.kind === 'failed'
          ? { errorMessage: snapshot.outcome.error }
          : { aborted: true as const }),
        // The abort tore down an established broker socket — the
        // disconnect logs as its own row with its observed instant.
        ...(aborted && snapshot.end !== null
          ? {
              abortedDisconnected: true as const,
              ...(timing?.disconnectedAt !== undefined ? { abortedDisconnectedAt: timing.disconnectedAt } : {}),
            }
          : {}),
        ...(terminalAt !== undefined ? { endedAt: terminalAt } : {}),
      };
    }
    return {
      ...(timing?.startedAt !== undefined ? { startedAt: timing.startedAt } : {}),
      connected: true,
      ...(timing?.connectedAt !== undefined ? { connectedAt: timing.connectedAt } : {}),
      ...(connackFacts !== undefined ? { connack: connackFacts } : {}),
      endedBy: snapshot.stopped === true ? 'stop' : 'close',
      ...(teardownAt !== undefined ? { endedAt: teardownAt } : {}),
      ...(endedMessage !== undefined ? { endedMessage } : {}),
    };
  }, [snapshot, live, timing, connackFacts, endedMessage]);

  // End pill honesty: a pre-open failure reads as Connect failed on
  // the error tint; the clean client Disconnect wears the ended pill's error tint (the WebSocket pane's picture);
  // a broker DISCONNECT renders on the warning tint with its verbatim
  // reason; a severed connection is named as the absence it is;
  // Stopped is its own state; a reconnect the broker refused, or a
  // spent attempt cap, ended the auto-reconnect loop — their own
  // error-tint states.
  const errorPill = useTonePillStyle('error');
  const warningPill = useTonePillStyle('warning');
  const neutralPill = useTonePillStyle('neutral');
  const endTag = (() => {
    if (snapshot === null) return null;
    if (snapshot.reconnectRefused !== undefined || snapshot.reconnectExhausted !== undefined) {
      return (
        <Tag color="default" style={errorPill} data-testid="mqtt-session-end-tag">
          {t(reconnectLoopEndTagKey(snapshot))}
        </Tag>
      );
    }
    // A user abort pills neutrally — Connect failed is for failures.
    if (snapshot.outcome.kind === 'aborted') {
      return (
        <Tag color="default" style={neutralPill} data-testid="mqtt-session-end-tag">
          {t('workbench.editors.mqtt.session.abortedTag')}
        </Tag>
      );
    }
    if (snapshot.outcome.kind === 'failed') {
      return (
        <Tag color="default" style={errorPill} data-testid="mqtt-session-end-tag">
          {t('workbench.editors.mqtt.session.connectFailedTag')}
        </Tag>
      );
    }
    if (snapshot.stopped === true) {
      return (
        <Tag color="default" style={warningPill} data-testid="mqtt-session-end-tag">
          {t('workbench.editors.mqtt.session.stoppedTag')}
        </Tag>
      );
    }
    if (snapshot.end === null) {
      return (
        <Tag color="default" style={errorPill} data-testid="mqtt-session-end-tag">
          {t('workbench.editors.mqtt.session.severedTag')}
        </Tag>
      );
    }
    return (
      <Tag
        color="default"
        style={snapshot.end.by === 'client' ? errorPill : warningPill}
        data-testid="mqtt-session-end-tag"
      >
        {snapshot.end.by === 'client'
          ? t('workbench.editors.mqtt.session.disconnectedTag')
          : t('workbench.editors.mqtt.session.brokerDisconnectedTag')}
      </Tag>
    );
  })();

  // The state pill's hover details — the session's lifecycle
  // transitions with their observed instants, newest first (the
  // timeline's order, the pill vocabulary); rows without an observed
  // instant stay absent, never fabricated.
  const detailRows = useMemo((): ConnectionDetailsRow[] => {
    const rows: ConnectionDetailsRow[] = [];
    // The reconnect-cycle facts ride the item log with their stamps —
    // newest first, between the end and the first Connected.
    const reconnectRows = (
      items: readonly MqttTimelineItem[],
      count: number,
      stamps: readonly number[] | undefined,
    ): ConnectionDetailsRow[] => {
      const out: ConnectionDetailsRow[] = [];
      for (let i = count - 1; i >= 0; i--) {
        const item = items[i];
        const atMs = stamps?.[i];
        if (!isReconnectItem(item) || atMs === undefined) continue;
        const label =
          item.kind === 'lost'
            ? t('workbench.editors.mqtt.timeline.lost')
            : item.kind === 'reconnecting'
              ? t('workbench.editors.mqtt.timeline.reconnecting', { attempt: item.attempt })
              : t('workbench.editors.mqtt.timeline.reconnected');
        out.push({ label, atMs });
      }
      return out;
    };
    if (snapshot === null) {
      if (live === null) return rows;
      rows.push(...reconnectRows(live.items, live.count, live.timestamps));
      if (live.open !== null && live.connectedAt !== undefined) {
        rows.push({ label: t('workbench.editors.mqtt.timeline.connected'), atMs: live.connectedAt });
      }
      rows.push({ label: t('workbench.editors.mqtt.timeline.connecting'), atMs: live.startedAt });
      return rows;
    }
    if (timing === null) return rows;
    const teardownAt = timing.disconnectedAt ?? timing.endedAt;
    if (snapshot.outcome.kind === 'aborted') {
      if (snapshot.end !== null && timing.disconnectedAt !== undefined) {
        rows.push({ label: t('workbench.editors.mqtt.timeline.abortedDisconnected'), atMs: timing.disconnectedAt });
      }
      const abortAt = timing.closeRequestedAt ?? timing.endedAt;
      if (abortAt !== undefined) rows.push({ label: t('workbench.editors.mqtt.session.abortedTag'), atMs: abortAt });
    } else if (snapshot.outcome.kind === 'failed') {
      if (teardownAt !== undefined) {
        rows.push({ label: t('workbench.editors.mqtt.session.connectFailedTag'), atMs: teardownAt });
      }
    } else {
      if (teardownAt !== undefined) {
        const label =
          snapshot.reconnectRefused !== undefined || snapshot.reconnectExhausted !== undefined
            ? t(reconnectLoopEndTagKey(snapshot))
            : snapshot.stopped === true
              ? t('workbench.editors.mqtt.session.stoppedTag')
              : snapshot.end === null
                ? t('workbench.editors.mqtt.session.severedTag')
                : snapshot.end.by === 'client'
                  ? t('workbench.editors.mqtt.session.disconnectedTag')
                  : t('workbench.editors.mqtt.session.brokerDisconnectedTag');
        rows.push({ label, atMs: teardownAt });
      }
      rows.push(...reconnectRows(snapshot.events, snapshot.events.length, timing.itemTimestamps));
      if (timing.connectedAt !== undefined) {
        rows.push({ label: t('workbench.editors.mqtt.timeline.connected'), atMs: timing.connectedAt });
      }
    }
    rows.push({ label: t('workbench.editors.mqtt.timeline.connecting'), atMs: timing.startedAt });
    return rows;
  }, [snapshot, live, timing, t]);

  // The subscribed-topics summary — the affordance left of the
  // Connected badge: hover-tinted, clicking jumps to the compose
  // Topics tab. Live sessions only (a settled snapshot's subscription
  // state is history, not a fact to summarize).
  const subsSummary =
    live !== null && live.open !== null && snapshot === null && subscribedTopicsCount !== undefined && onShowTopics ? (
      <>
        <button
          type="button"
          onClick={onShowTopics}
          onMouseEnter={() => setSubsHovered(true)}
          onMouseLeave={() => setSubsHovered(false)}
          style={{
            border: 'none',
            background: subsHovered ? token.colorFillTertiary : 'transparent',
            borderRadius: token.borderRadiusSM,
            padding: '2px 6px',
            fontSize: 11,
            color: token.colorTextSecondary,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
          data-testid="mqtt-session-subs-summary"
        >
          {subscribedTopicsCount === 0
            ? t('workbench.editors.mqtt.session.notSubscribed')
            : subscribedTopicsCount === 1
              ? t('workbench.editors.mqtt.session.subscribedOne')
              : t('workbench.editors.mqtt.session.subscribedMany', { count: subscribedTopicsCount })}
        </button>
        <Text type="secondary" style={{ fontSize: 10 }}>
          •
        </Text>
      </>
    ) : null;

  // The live badge wears the HTTP status chip's pill — connected reads
  // as a 2xx, reconnecting as the warning wash, connecting neutral.
  const livePill = useTonePillStyle(reconnecting ? 'warning' : live?.open !== null ? 'success' : 'neutral');

  const metaStrip = (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingLeft: 12 }}>
      {snapshot === null ? (
        <>
          {subsSummary}
          <ConnectionDetailsTooltip rows={detailRows}>
            <Tag color="default" style={livePill} data-testid="mqtt-session-live-badge">
              {reconnecting
                ? t('workbench.editors.mqtt.session.reconnectingBadge')
                : live?.open !== null
                  ? t('workbench.editors.mqtt.session.connectedBadge')
                  : t('workbench.editors.mqtt.session.connectingBadge')}
            </Tag>
          </ConnectionDetailsTooltip>
          {proxyRouteHasBadge(live?.open?.proxyRoute) && <ProxyRouteTag route={live?.open?.proxyRoute} />}
        </>
      ) : (
        <>
          {endTag !== null && <ConnectionDetailsTooltip rows={detailRows}>{endTag}</ConnectionDetailsTooltip>}
          {proxyRouteHasBadge(snapshot.proxyRoute) && <ProxyRouteTag route={snapshot.proxyRoute} />}
          <Dropdown
            trigger={['click']}
            styles={{ root: { minWidth: 180 } }}
            menu={{
              items: [
                // Save Response leads — the HTTP ResponsePanel's menu order.
                ...(onSaveResponse
                  ? [
                      {
                        key: 'save-response',
                        icon: <ExampleChip />,
                        label: (
                          <span data-testid="mqtt-save-response">
                            {t('workbench.editors.mqtt.session.saveResponse')}
                          </span>
                        ),
                        onClick: onSaveResponse,
                      },
                      { type: 'divider' as const },
                    ]
                  : []),
                {
                  key: 'clear',
                  icon: <ClearOutlined />,
                  label: t('workbench.editors.request.response.clearResponse'),
                  onClick: onClear,
                },
              ],
            }}
          >
            <Button
              size="small"
              type="text"
              icon={<EllipsisOutlined />}
              aria-label={t('workbench.editors.request.response.moreActionsAria')}
              data-testid="mqtt-session-actions"
            />
          </Dropdown>
        </>
      )}
    </div>
  );

  const items = snapshot?.events ?? live?.items ?? [];
  const count = snapshot?.events.length ?? live?.count ?? 0;
  const timestamps = snapshot !== null ? timing?.itemTimestamps : live?.timestamps;

  const connectionRow = (label: string, value: string): React.ReactNode => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '4px 0' }}>
      <Text type="secondary" style={{ fontSize: 11, width: 110, flexShrink: 0 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 12, fontFamily: "'SF Mono', monospace" }}>{value}</Text>
    </div>
  );

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
        background: token.colorBgContainer,
      }}
      data-testid="mqtt-session-pane"
    >
      {noticeStrip}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        size="small"
        className="rules-response-tabs"
        style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', minHeight: 0 }}
        tabBarStyle={{ marginBottom: 0 }}
        tabBarExtraContent={{ right: metaStrip }}
        items={[
          {
            key: 'timeline',
            label: t('workbench.editors.mqtt.session.tab.timeline'),
            children: (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '8px 0',
                  minHeight: 0,
                }}
              >
                {trustHint !== null && trustOfferOpen && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 4 }}>
                    <TrustCertificateOffer
                      hint={trustHint}
                      {...(onReconnect !== undefined ? { onResend: onReconnect } : {})}
                    />
                    <Button
                      size="small"
                      type="text"
                      icon={<CloseOutlined style={{ fontSize: 11 }} />}
                      onClick={() => setTrustOfferOpen(false)}
                      aria-label={t('shared.action.close')}
                      data-testid="mqtt-session-trust-offer-close"
                    />
                  </div>
                )}
                <div style={{ flex: 1, minHeight: 120, display: 'flex', flexDirection: 'column' }}>
                  <MqttMessageTimeline
                    items={items}
                    count={count}
                    {...(timestamps !== undefined ? { timestamps } : {})}
                    lifecycle={lifecycle}
                    v5={v5}
                    droppedMessages={snapshot?.droppedMessages ?? 0}
                    {...(trustHint !== null
                      ? { onTrustCertificate: () => setTrustOfferOpen((open) => !open) }
                      : {})}
                    trustOfferOpen={trustOfferOpen}
                  />
                </div>
              </div>
            ),
          },
          {
            key: 'connection',
            label: t('workbench.editors.mqtt.session.tab.connection'),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 0' }} data-testid="mqtt-connection-tab">
                {connectionRow(t('workbench.editors.mqtt.session.connectionClientId'), clientId)}
                {connectionRow(
                  t('workbench.editors.mqtt.session.connectionReason'),
                  connack !== null ? connackReasonLabel(connack.reasonCode, v5) : '—',
                )}
                {connectionRow(
                  t('workbench.editors.mqtt.session.connectionSessionPresent'),
                  connack !== null
                    ? connack.sessionPresent
                      ? t('workbench.editors.mqtt.session.yes')
                      : t('workbench.editors.mqtt.session.no')
                    : '—',
                )}
                <Text type="secondary" style={{ fontSize: 11, marginTop: 8 }}>
                  {t('workbench.editors.mqtt.session.connectionNote')}
                </Text>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

export default MqttSessionPane;
