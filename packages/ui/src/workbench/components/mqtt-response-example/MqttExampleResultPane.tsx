/**
 * MqttExampleResultPane — the captured-session surface of a saved MQTT
 * example, rendered through the MqttSessionPane's settled conventions:
 * ONE-row header (tabs left, the end pill · duration meta strip
 * right-aligned in the tab bar, capture provenance on hover), the
 * message timeline over the capture (timestamps absent by the
 * session-only law), and the Connection tab's honest CONNACK rows.
 * Read-only — the capture is a record, so there is no Clear.
 */

import type { CapturedMqttResponse, MqttRequestProtocolVersion } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Tabs, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import MqttMessageTimeline from '../mqtt-request-editor/MqttMessageTimeline';
import type { MqttTimelineLifecycle } from '../mqtt-request-editor/mqtt-timeline-model';
import {
  connackReasonLabel,
  connackReasonName,
  reconnectLoopEndTagKey,
  sessionEndedMessage,
} from '../mqtt-request-editor/session-display';

const { Text } = Typography;

interface MqttExampleResultPaneProps {
  response: CapturedMqttResponse;
  /** The captured session's version knob — scopes the reason-code name
   *  space the display labels ride (codes themselves render verbatim). */
  protocolVersion: MqttRequestProtocolVersion;
  /** ISO capture moment — the strip's hover provenance. */
  capturedAt: string;
}

const MqttExampleResultPane: React.FC<MqttExampleResultPaneProps> = ({ response, protocolVersion, capturedAt }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [activeTab, setActiveTab] = useState('timeline');
  const v5 = protocolVersion !== '3.1.1';

  const connackFacts = useMemo((): MqttTimelineLifecycle['connack'] => {
    const reasonName = connackReasonName(response.connack.reasonCode, v5);
    return {
      reasonCode: response.connack.reasonCode,
      ...(reasonName !== undefined ? { reasonName } : {}),
      sessionPresent: response.connack.sessionPresent,
      ...(response.connack.remainingLength !== undefined
        ? { remainingLength: response.connack.remainingLength }
        : {}),
    };
  }, [response.connack, v5]);

  const endedMessage = useMemo(() => sessionEndedMessage(response, t), [response, t]);

  const lifecycle = useMemo(
    (): MqttTimelineLifecycle => ({
      connected: true,
      ...(connackFacts !== undefined ? { connack: connackFacts } : {}),
      endedBy: response.stopped === true ? 'stop' : 'close',
      ...(endedMessage !== undefined ? { endedMessage } : {}),
    }),
    [connackFacts, endedMessage, response.stopped],
  );

  // End pill honesty — the MqttSessionPane's settled vocabulary.
  const endTag =
    response.reconnectRefused !== undefined || response.reconnectExhausted !== undefined ? (
      <Tag color="error" style={{ marginInlineEnd: 0 }} data-testid="mqtt-example-end-tag">
        {t(reconnectLoopEndTagKey(response))}
      </Tag>
    ) : response.stopped === true ? (
      <Tag color="warning" style={{ marginInlineEnd: 0 }} data-testid="mqtt-example-end-tag">
        {t('workbench.editors.mqtt.session.stoppedTag')}
      </Tag>
    ) : response.end === null ? (
      <Tag color="error" style={{ marginInlineEnd: 0 }} data-testid="mqtt-example-end-tag">
        {t('workbench.editors.mqtt.session.severedTag')}
      </Tag>
    ) : (
      <Tag
        color={response.end.by === 'client' ? 'success' : 'warning'}
        style={{ marginInlineEnd: 0 }}
        data-testid="mqtt-example-end-tag"
      >
        {response.end.by === 'client'
          ? t('workbench.editors.mqtt.session.disconnectedTag')
          : t('workbench.editors.mqtt.session.brokerDisconnectedTag')}
      </Tag>
    );

  const metaStrip = (
    <Tooltip title={t('workbench.editors.mqttExample.capturedTooltip', { date: new Date(capturedAt).toLocaleString() })}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingLeft: 12 }}>
        {endTag}
        <Text type="secondary" style={{ fontSize: 11 }}>
          {t('workbench.editors.mqtt.session.duration', { ms: response.durationMs })}
        </Text>
      </span>
    </Tooltip>
  );

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
      data-testid="mqtt-example-result-pane"
    >
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
                    items={response.events}
                    count={response.events.length}
                    lifecycle={lifecycle}
                    v5={v5}
                    droppedMessages={response.droppedMessages}
                  />
                </div>
              </div>
            ),
          },
          {
            key: 'connection',
            label: t('workbench.editors.mqtt.session.tab.connection'),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 0' }}>
                {connectionRow(t('workbench.editors.mqtt.session.connectionClientId'), response.clientId)}
                {connectionRow(
                  t('workbench.editors.mqtt.session.connectionReason'),
                  connackReasonLabel(response.connack.reasonCode, v5),
                )}
                {connectionRow(
                  t('workbench.editors.mqtt.session.connectionSessionPresent'),
                  response.connack.sessionPresent
                    ? t('workbench.editors.mqtt.session.yes')
                    : t('workbench.editors.mqtt.session.no'),
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

export default MqttExampleResultPane;
