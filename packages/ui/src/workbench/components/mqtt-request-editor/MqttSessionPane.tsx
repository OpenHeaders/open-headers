/**
 * MqttSessionPane — the session result surface for an MqttRequest, the
 * `WsSessionPane` sibling: one pane across both phases — live
 * (CONNECTED badge, timeline fed from the `mqttStreamEvent` feed) and
 * materialized (the end record rendered honestly — the clean
 * Disconnect, a broker DISCONNECT with its verbatim reason, the
 * severed-connection absence, or Stopped — timeline fed from the
 * snapshot's capture with the session's timestamps joined
 * positionally). The header is ONE row in the HTTP ResponsePanel's
 * format: tabs left, meta strip right-aligned in the tab bar.
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

import { ClearOutlined, EllipsisOutlined } from '@ant-design/icons';
import { MQTT_CONNACK_RETURN_CODE_NAMES, mqttReasonCodeName } from '@openheaders/core/mqtt';
import type { ExecutedMqttSnapshot, MqttRequestProtocolVersion } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Dropdown, Tabs, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import ProxyRouteTag, { proxyRouteHasBadge } from '../request-editor/response/ProxyRouteTag';
import { ExampleChip } from '../shared/ExampleChip';
import MqttMessageTimeline, { type MqttTimelineLifecycle } from './MqttMessageTimeline';
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
}

/** CONNACK reason name — the version scopes which numeric space names
 *  the verbatim code. */
function connackReasonName(reasonCode: number, v5: boolean): string | undefined {
  return v5 ? mqttReasonCodeName(reasonCode, 'connack') : MQTT_CONNACK_RETURN_CODE_NAMES[reasonCode];
}

/** CONNACK reason display: the spec name beside the verbatim code. */
function connackReasonLabel(reasonCode: number, v5: boolean): string {
  const name = connackReasonName(reasonCode, v5);
  return name !== undefined ? `${name} (${reasonCode})` : String(reasonCode);
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
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const [activeTab, setActiveTab] = useState('timeline');
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

  const endedMessage = useMemo(() => {
    if (snapshot === null) return undefined;
    if (snapshot.stopped === true) return undefined;
    if (snapshot.end === null) return t('workbench.editors.mqtt.session.severed');
    if (snapshot.end.by === 'client') return t('workbench.editors.mqtt.session.cleanDisconnect');
    const reasonCode = snapshot.end.reasonCode;
    if (reasonCode === null) return t('workbench.editors.mqtt.session.brokerDisconnectBare');
    const name = mqttReasonCodeName(reasonCode, 'disconnect');
    return t('workbench.editors.mqtt.session.brokerDisconnect', {
      reason: name !== undefined ? `${name} (${reasonCode})` : String(reasonCode),
    });
  }, [snapshot, t]);

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
    // Cancel click / Stop) carries the stopped mark and renders as the
    // neutral aborted row instead.
    if (snapshot.error !== null) {
      return {
        ...(timing?.startedAt !== undefined ? { startedAt: timing.startedAt } : {}),
        connected: false,
        ...(connackFacts !== undefined ? { connack: connackFacts } : {}),
        errorMessage: snapshot.error,
        ...(snapshot.stopped === true ? { aborted: true as const } : {}),
        // The abort tore down an established broker socket — the
        // disconnect logs as its own row.
        ...(snapshot.stopped === true && snapshot.end !== null ? { abortedDisconnected: true as const } : {}),
        ...(timing?.endedAt !== undefined ? { endedAt: timing.endedAt } : {}),
      };
    }
    return {
      ...(timing?.startedAt !== undefined ? { startedAt: timing.startedAt } : {}),
      connected: snapshot.connected,
      ...(timing?.connectedAt !== undefined ? { connectedAt: timing.connectedAt } : {}),
      ...(connackFacts !== undefined ? { connack: connackFacts } : {}),
      endedBy: snapshot.stopped === true ? 'stop' : 'close',
      ...(timing?.endedAt !== undefined ? { endedAt: timing.endedAt } : {}),
      ...(endedMessage !== undefined ? { endedMessage } : {}),
    };
  }, [snapshot, live, timing, connackFacts, endedMessage]);

  // End pill honesty: a pre-open failure reads as Connect failed on
  // the error tint; the clean client Disconnect reads success-green;
  // a broker DISCONNECT renders on the warning tint with its verbatim
  // reason; a severed connection is named as the absence it is;
  // Stopped is its own state.
  const endTag = (() => {
    if (snapshot === null) return null;
    if (snapshot.error !== null) {
      // A user abort pills neutrally — Connect failed is for failures.
      if (snapshot.stopped === true) {
        return (
          <Tag style={{ marginInlineEnd: 0 }} data-testid="mqtt-session-end-tag">
            {t('workbench.editors.mqtt.session.abortedTag')}
          </Tag>
        );
      }
      return (
        <Tag color="error" style={{ marginInlineEnd: 0 }} data-testid="mqtt-session-end-tag">
          {t('workbench.editors.mqtt.session.connectFailedTag')}
        </Tag>
      );
    }
    if (snapshot.stopped === true) {
      return (
        <Tag color="warning" style={{ marginInlineEnd: 0 }} data-testid="mqtt-session-end-tag">
          {t('workbench.editors.mqtt.session.stoppedTag')}
        </Tag>
      );
    }
    if (snapshot.end === null) {
      return (
        <Tag color="error" style={{ marginInlineEnd: 0 }} data-testid="mqtt-session-end-tag">
          {t('workbench.editors.mqtt.session.severedTag')}
        </Tag>
      );
    }
    return (
      <Tag
        color={snapshot.end.by === 'client' ? 'success' : 'warning'}
        style={{ marginInlineEnd: 0 }}
        data-testid="mqtt-session-end-tag"
      >
        {snapshot.end.by === 'client'
          ? t('workbench.editors.mqtt.session.disconnectedTag')
          : t('workbench.editors.mqtt.session.brokerDisconnectedTag')}
      </Tag>
    );
  })();

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

  const metaStrip = (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingLeft: 12 }}>
      {snapshot === null ? (
        <>
          {subsSummary}
          <Tag
            color={live?.open !== null ? 'processing' : 'default'}
            style={{ marginInlineEnd: 0 }}
            data-testid="mqtt-session-live-badge"
          >
            {live?.open !== null
              ? t('workbench.editors.mqtt.session.connectedBadge')
              : t('workbench.editors.mqtt.session.connectingBadge')}
          </Tag>
          {proxyRouteHasBadge(live?.open?.proxyRoute) && <ProxyRouteTag route={live?.open?.proxyRoute} />}
        </>
      ) : (
        <>
          {endTag}
          {proxyRouteHasBadge(snapshot.proxyRoute) && <ProxyRouteTag route={snapshot.proxyRoute} />}
          <Text type="secondary" style={{ fontSize: 11 }} data-testid="mqtt-session-duration">
            {t('workbench.editors.mqtt.session.duration', { ms: snapshot.durationMs })}
          </Text>
          <Dropdown
            trigger={['click']}
            overlayStyle={{ minWidth: 180 }}
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
                <div style={{ flex: 1, minHeight: 120, display: 'flex', flexDirection: 'column' }}>
                  <MqttMessageTimeline
                    items={items}
                    count={count}
                    {...(timestamps !== undefined ? { timestamps } : {})}
                    lifecycle={lifecycle}
                    droppedMessages={snapshot?.droppedMessages ?? 0}
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
