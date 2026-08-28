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
import { Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
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

  const lifecycle = useMemo(
    (): WsTimelineLifecycle => ({
      connected: true,
      handshake: { protocol: response.protocol, extensions: response.extensions },
      endedBy: response.stopped === true ? 'stop' : 'close',
      // The Close frame verbatim, or the honest null for a severed
      // connection; a Stop carries no close record.
      ...(response.stopped === true ? {} : { close: response.close }),
    }),
    [response],
  );

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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 12px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Text strong style={{ fontSize: 12 }}>
          {t('workbench.editors.websocket.session.paneTitle')}
        </Text>
        <span style={{ marginLeft: 'auto', display: 'inline-flex' }}>{metaStrip}</span>
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '8px 12px',
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
    </div>
  );
};

export default WsExampleResultPane;
