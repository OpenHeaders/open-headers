/**
 * WsExampleResultPane — the captured-session surface of a saved
 * WebSocket example, rendered through the WsSessionPane's settled
 * conventions: ONE-row header (tabs left, the close pill · duration
 * meta strip right-aligned in the tab bar, capture provenance on
 * hover), the message timeline over the capture (timestamps absent by
 * the session-only law), and the Handshake tab's honest
 * protocol/extensions rows. Read-only — the capture is a record, so
 * there is no Clear.
 */

import type { CapturedWsResponse, WebSocketFlavor } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Tabs, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import WsMessageTimeline, { type WsTimelineLifecycle } from '../websocket-request-editor/WsMessageTimeline';

const { Text } = Typography;

interface WsExampleResultPaneProps {
  response: CapturedWsResponse;
  /** Session wire family — forwarded to the timeline's display decode. */
  flavor: WebSocketFlavor;
  /** ISO capture moment — the strip's hover provenance. */
  capturedAt: string;
}

const WsExampleResultPane: React.FC<WsExampleResultPaneProps> = ({ response, flavor, capturedAt }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [activeTab, setActiveTab] = useState('timeline');

  const lifecycle = useMemo((): WsTimelineLifecycle => {
    const endedMessage =
      response.close !== null
        ? `${response.close.code}${response.close.reason !== '' ? ` ${response.close.reason}` : ''}`
        : response.stopped === true
          ? undefined
          : t('workbench.editors.websocket.session.noCloseFrame');
    return {
      connected: true,
      ...(response.protocol !== '' ? { protocol: response.protocol } : {}),
      endedBy: response.stopped === true ? 'stop' : 'close',
      ...(endedMessage !== undefined ? { endedMessage } : {}),
    };
  }, [response, t]);

  // Close pill honesty — the WsSessionPane's settled vocabulary.
  const closeTag =
    response.stopped === true ? (
      <Tag color="warning" style={{ marginInlineEnd: 0 }} data-testid="ws-example-close-tag">
        {t('workbench.editors.websocket.session.stoppedTag')}
      </Tag>
    ) : response.close === null ? (
      <Tag color="error" style={{ marginInlineEnd: 0 }} data-testid="ws-example-close-tag">
        {t('workbench.editors.websocket.session.noCloseFrame')}
      </Tag>
    ) : (
      <Tag
        color={response.close.code === 1000 ? 'success' : 'warning'}
        style={{ marginInlineEnd: 0 }}
        data-testid="ws-example-close-tag"
      >
        {t('workbench.editors.websocket.session.closedTag', { code: response.close.code })}
      </Tag>
    );

  const metaStrip = (
    <Tooltip title={t('workbench.editors.wsExample.capturedTooltip', { date: new Date(capturedAt).toLocaleString() })}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingLeft: 12 }}>
        {closeTag}
        <Text type="secondary" style={{ fontSize: 11 }}>
          {t('workbench.editors.websocket.session.duration', { ms: response.durationMs })}
        </Text>
      </span>
    </Tooltip>
  );

  const handshakeRow = (label: string, value: string): React.ReactNode => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '4px 0' }}>
      <Text type="secondary" style={{ fontSize: 11, width: 110, flexShrink: 0 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 12, fontFamily: "'SF Mono', monospace" }}>
        {value !== '' ? value : t('workbench.editors.websocket.session.handshakeNone')}
      </Text>
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
      data-testid="ws-example-result-pane"
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
            label: t('workbench.editors.websocket.session.tab.timeline'),
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
                  <WsMessageTimeline
                    items={response.messages}
                    count={response.messages.length}
                    lifecycle={lifecycle}
                    droppedMessages={response.droppedMessages}
                    flavor={flavor}
                  />
                </div>
              </div>
            ),
          },
          {
            key: 'handshake',
            label: t('workbench.editors.websocket.session.tab.handshake'),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 0' }}>
                {handshakeRow(t('workbench.editors.websocket.session.handshakeProtocol'), response.protocol)}
                {handshakeRow(t('workbench.editors.websocket.session.handshakeExtensions'), response.extensions)}
                <Text type="secondary" style={{ fontSize: 11, marginTop: 8 }}>
                  {t('workbench.editors.websocket.session.handshakeNote')}
                </Text>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

export default WsExampleResultPane;
