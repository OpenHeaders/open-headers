/**
 * WsSessionPane — the session result surface for a WebSocketRequest,
 * the `GrpcStreamPane` sibling: one pane across both phases — live
 * (CONNECTED badge, timeline fed from the `wsStreamEvent` feed) and
 * materialized (the close record rendered honestly — the clean code,
 * a foreign code verbatim, the no-Close-frame absence, or Stopped —
 * timeline fed from the snapshot's capture with the session's
 * timestamps joined positionally). The header is ONE row in the HTTP
 * ResponsePanel's format: tabs left, meta strip right-aligned in the
 * tab bar. Pre-open failures (the session never opened) render the
 * classified message under the plain title row.
 *
 * The Handshake tab states what the platform socket exposes — the
 * negotiated subprotocol and extensions — and nothing more: undici
 * surfaces no 101 response headers, and absence rendered as absence
 * beats a synthesized grid (the capture law's display twin).
 */

import { ClearOutlined, EllipsisOutlined } from '@ant-design/icons';
import type { ExecutedWsSnapshot, WebSocketFlavor } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Dropdown, Tabs, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import ProxyRouteTag, { proxyRouteHasBadge } from '../request-editor/response/ProxyRouteTag';
import { ExampleChip } from '../shared/ExampleChip';
import WsMessageTimeline, { type WsTimelineLifecycle } from './WsMessageTimeline';
import type { LiveWsSession, WsSessionTiming } from './useLiveWsSession';

const { Text } = Typography;

interface WsSessionPaneProps {
  /** Non-null while the session is open. */
  live: LiveWsSession | null;
  /** Non-null once the session settled. */
  snapshot: ExecutedWsSnapshot | null;
  /** Session-only timing captured at materialization. */
  timing: WsSessionTiming | null;
  /** Per-knob honesty notice for a page-realm session — names the
   *  configured node-only knobs that did not apply on this host.
   *  Stated inline for the session's whole life, never a gate. */
  hostNotice?: string | null;
  /** Session wire family — forwarded to the timeline's display decode. */
  flavor?: WebSocketFlavor;
  /** Events-tab listen filter — forwarded to the timeline (display
   *  only; the capture stays verbatim). Absent = no filter. */
  listenedEvents?: readonly string[];
  onClear: () => void;
  /** "Save Response" — present only when the settled session can be
   *  captured as an example (connected, non-error). First item of the
   *  ⋯ actions menu. */
  onSaveResponse?: () => void;
}

const WsSessionPane: React.FC<WsSessionPaneProps> = ({
  live,
  snapshot,
  timing,
  hostNotice,
  flavor,
  listenedEvents,
  onClear,
  onSaveResponse,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const [activeTab, setActiveTab] = useState('timeline');

  const noticeStrip =
    hostNotice != null && hostNotice !== '' ? (
      <div
        style={{
          padding: '4px 12px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          flexShrink: 0,
        }}
        data-testid="ws-host-knob-notice"
      >
        <Text type="warning" style={{ fontSize: 11 }}>
          {hostNotice}
        </Text>
      </div>
    ) : null;

  const lifecycle = useMemo((): WsTimelineLifecycle => {
    if (snapshot === null) {
      return {
        ...(live !== null ? { startedAt: live.startedAt } : {}),
        connected: live !== null && live.open !== null,
        ...(live?.connectedAt !== undefined ? { connectedAt: live.connectedAt } : {}),
        ...(live?.open?.protocol !== undefined && live.open.protocol !== '' ? { protocol: live.open.protocol } : {}),
      };
    }
    const endedMessage =
      snapshot.close !== null
        ? `${snapshot.close.code}${snapshot.close.reason !== '' ? ` ${snapshot.close.reason}` : ''}`
        : snapshot.stopped === true
          ? undefined
          : t('workbench.editors.websocket.session.noCloseFrame');
    return {
      ...(timing?.startedAt !== undefined ? { startedAt: timing.startedAt } : {}),
      connected: snapshot.connected,
      ...(timing?.connectedAt !== undefined ? { connectedAt: timing.connectedAt } : {}),
      ...(snapshot.protocol !== '' ? { protocol: snapshot.protocol } : {}),
      endedBy: snapshot.stopped === true ? 'stop' : 'close',
      ...(timing?.endedAt !== undefined ? { endedAt: timing.endedAt } : {}),
      ...(endedMessage !== undefined ? { endedMessage } : {}),
    };
  }, [snapshot, live, timing, t]);

  // Pre-open failures render the classified message under the plain
  // title row — there was never a session to timeline.
  if (snapshot !== null && snapshot.error !== null) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          background: token.colorBgContainer,
        }}
        data-testid="ws-session-error"
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
            {t('workbench.editors.websocket.session.title')}
          </Text>
        </div>
        {noticeStrip}
        <div style={{ padding: '16px 12px' }}>
          <Text type="danger" style={{ fontSize: 12 }} data-testid="ws-session-error-detail">
            {snapshot.error}
          </Text>
        </div>
      </div>
    );
  }

  // Close pill honesty: the clean 1000 reads success-green; any other
  // code renders verbatim on the warning tint; a missing Close frame
  // is named as the absence it is; Stopped is its own state.
  const closeTag = (() => {
    if (snapshot === null) return null;
    if (snapshot.stopped === true) {
      return (
        <Tag color="warning" style={{ marginInlineEnd: 0 }} data-testid="ws-session-close-tag">
          {t('workbench.editors.websocket.session.stoppedTag')}
        </Tag>
      );
    }
    if (snapshot.close === null) {
      return (
        <Tag color="error" style={{ marginInlineEnd: 0 }} data-testid="ws-session-close-tag">
          {t('workbench.editors.websocket.session.noCloseFrame')}
        </Tag>
      );
    }
    return (
      <Tag
        color={snapshot.close.code === 1000 ? 'success' : 'warning'}
        style={{ marginInlineEnd: 0 }}
        data-testid="ws-session-close-tag"
      >
        {t('workbench.editors.websocket.session.closedTag', { code: snapshot.close.code })}
      </Tag>
    );
  })();

  const metaStrip = (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingLeft: 12 }}>
      {snapshot === null ? (
        <Tag
          color={live?.open !== null ? 'processing' : 'default'}
          style={{ marginInlineEnd: 0 }}
          data-testid="ws-session-live-badge"
        >
          {live?.open !== null
            ? t('workbench.editors.websocket.session.connectedBadge')
            : t('workbench.editors.websocket.session.connectingBadge')}
        </Tag>
      ) : (
        <>
          {closeTag}
          {proxyRouteHasBadge(snapshot.proxyRoute) && <ProxyRouteTag route={snapshot.proxyRoute} />}
          <Text type="secondary" style={{ fontSize: 11 }} data-testid="ws-session-duration">
            {t('workbench.editors.websocket.session.duration', { ms: snapshot.durationMs })}
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
                          <span data-testid="ws-save-response">
                            {t('workbench.editors.websocket.session.saveResponse')}
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
              data-testid="ws-session-actions"
            />
          </Dropdown>
        </>
      )}
    </div>
  );

  const items = snapshot?.messages ?? live?.items ?? [];
  const count = snapshot?.messages.length ?? live?.count ?? 0;
  const timestamps = snapshot !== null ? timing?.messageTimestamps : live?.timestamps;
  const protocol = snapshot?.protocol ?? live?.open?.protocol ?? '';
  const extensions = snapshot?.extensions ?? live?.open?.extensions ?? '';

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
      data-testid="ws-session-pane"
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
                    items={items}
                    count={count}
                    {...(timestamps !== undefined ? { timestamps } : {})}
                    lifecycle={lifecycle}
                    droppedMessages={snapshot?.droppedMessages ?? 0}
                    {...(flavor !== undefined ? { flavor } : {})}
                    {...(listenedEvents !== undefined ? { listenedEvents } : {})}
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
                {handshakeRow(t('workbench.editors.websocket.session.handshakeProtocol'), protocol)}
                {handshakeRow(t('workbench.editors.websocket.session.handshakeExtensions'), extensions)}
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

export default WsSessionPane;
