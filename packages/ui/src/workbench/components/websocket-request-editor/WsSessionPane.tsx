/**
 * WsSessionPane — the session result surface for a WebSocketRequest,
 * the `GrpcStreamPane` sibling: one pane across both phases — live
 * (CONNECTED badge, timeline fed from the `wsStreamEvent` feed) and
 * materialized (the close record rendered honestly — the clean code,
 * a foreign code verbatim, the no-Close-frame absence, or Stopped —
 * timeline fed from the snapshot's capture with the session's
 * timestamps joined positionally). The header is ONE row in the HTTP
 * ResponsePanel's format: tabs left, meta strip right-aligned in the
 * tab bar. Pre-open ends (the session never opened) render through
 * the SAME pane: a failure's classified message rides the timeline as
 * its error row and the meta strip pills Connect failed; a user abort
 * (Cancel / Stop) renders the neutral aborted row and the neutral
 * Aborted pill — never a bare error wall.
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
import { useTonePillStyle } from '../request-editor/response/response-status';
import ConnectionDetailsTooltip, { type ConnectionDetailsRow } from '../shared/ConnectionDetailsTooltip';
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
        ...(live?.open != null
          ? {
              handshake: {
                protocol: live.open.protocol,
                extensions: live.open.extensions,
                ...(live.open.url !== undefined ? { url: live.open.url } : {}),
                ...(live.open.requestHeaders !== undefined ? { requestHeaders: live.open.requestHeaders } : {}),
              },
            }
          : {}),
      };
    }
    // A pre-open failure settles as the timeline's error row — the
    // classified message verbatim at the new edge; never an
    // opened-session end row. A USER abort (the Cancel click / Stop)
    // renders as the neutral aborted row instead. Terminal instants
    // prefer the observed truth: the end frame's host stamp for the
    // teardown, the Cancel click for the abort; the editor's settle
    // stamp stays the fallback toward hosts that predate the
    // lifecycle stamps.
    const teardownAt = timing?.disconnectedAt ?? timing?.endedAt;
    if (snapshot.outcome.kind !== 'connected') {
      const terminalAt =
        snapshot.outcome.kind === 'aborted' ? (timing?.closeRequestedAt ?? timing?.endedAt) : teardownAt;
      return {
        ...(timing?.startedAt !== undefined ? { startedAt: timing.startedAt } : {}),
        connected: false,
        ...(snapshot.outcome.kind === 'failed'
          ? { errorMessage: snapshot.outcome.error }
          : { aborted: true as const }),
        ...(terminalAt !== undefined ? { endedAt: terminalAt } : {}),
      };
    }
    return {
      ...(timing?.startedAt !== undefined ? { startedAt: timing.startedAt } : {}),
      connected: true,
      ...(timing?.connectedAt !== undefined ? { connectedAt: timing.connectedAt } : {}),
      handshake: {
        protocol: snapshot.protocol,
        extensions: snapshot.extensions,
        ...(snapshot.url !== undefined ? { url: snapshot.url } : {}),
        ...(snapshot.requestHeaders !== undefined ? { requestHeaders: snapshot.requestHeaders } : {}),
      },
      endedBy: snapshot.stopped === true ? 'stop' : 'close',
      ...(teardownAt !== undefined ? { endedAt: teardownAt } : {}),
      // The Close frame verbatim, or the honest null for a severed
      // connection; a Stop carries no close record.
      ...(snapshot.stopped === true ? {} : { close: snapshot.close }),
    };
  }, [snapshot, live, timing, t]);

  // The settled pill — the reference vocabulary: a session that opened
  // reads Disconnected on the error tint whatever ended it (the close
  // code, a Stop, a missing Close frame all ride the hover sheet); a
  // handshake failure reads Connect failed on the same tint; a cancel
  // before the handshake reads Aborted on the neutral wash.
  const endedPill = useTonePillStyle('error');
  const abortedPill = useTonePillStyle('neutral');
  const closeTag = (() => {
    if (snapshot === null) return null;
    if (snapshot.outcome.kind === 'aborted') {
      return (
        <Tag color="default" style={abortedPill} data-testid="ws-session-close-tag">
          {t('workbench.editors.websocket.session.abortedTag')}
        </Tag>
      );
    }
    if (snapshot.outcome.kind === 'failed') {
      return (
        <Tag color="default" style={endedPill} data-testid="ws-session-close-tag">
          {t('workbench.editors.websocket.session.connectFailedTag')}
        </Tag>
      );
    }
    return (
      <Tag color="default" style={endedPill} data-testid="ws-session-close-tag">
        {t('workbench.editors.websocket.session.disconnectedTag')}
      </Tag>
    );
  })();

  // The state pill's hover details — the reference sheet: the Connected
  // instant and the extensions answer (the selected subprotocol when
  // the server picked one); a settled pill leads with its own end
  // transition. Instants without an observation stay absent, never
  // fabricated.
  const detailRows = useMemo((): ConnectionDetailsRow[] => {
    const rows: ConnectionDetailsRow[] = [];
    // Extensions always has a row — an empty answer reads as the
    // Handshake tab's "None negotiated", so the user learns the server
    // declined the offer rather than wondering where the row went; the
    // subprotocol joins only when the server selected one.
    const handshakeRows = (open: { protocol: string; extensions: string }): void => {
      if (open.protocol !== '') rows.push({ label: t('workbench.editors.session.subprotocol'), value: open.protocol });
      rows.push({
        label: t('workbench.editors.session.extensions'),
        value: open.extensions !== '' ? open.extensions : t('workbench.editors.websocket.session.handshakeNone'),
      });
    };
    if (snapshot === null) {
      if (live === null) return rows;
      if (live.open === null) {
        rows.push({ label: t('workbench.editors.websocket.timeline.connecting'), atMs: live.startedAt });
        return rows;
      }
      if (live.connectedAt !== undefined) {
        rows.push({ label: t('workbench.editors.websocket.timeline.connected'), atMs: live.connectedAt });
      }
      handshakeRows(live.open);
      return rows;
    }
    if (timing === null) return rows;
    const teardownAt = timing.disconnectedAt ?? timing.endedAt;
    if (snapshot.outcome.kind === 'aborted') {
      const abortAt = timing.closeRequestedAt ?? timing.endedAt;
      if (abortAt !== undefined) {
        rows.push({ label: t('workbench.editors.websocket.session.abortedTag'), atMs: abortAt });
      }
    } else if (snapshot.outcome.kind === 'failed') {
      if (teardownAt !== undefined) {
        rows.push({ label: t('workbench.editors.websocket.session.connectFailedTag'), atMs: teardownAt });
      }
    } else {
      if (teardownAt !== undefined) {
        rows.push({ label: t('workbench.editors.websocket.session.disconnectedTag'), atMs: teardownAt });
      }
      rows.push({
        label: t('workbench.editors.session.closeCode'),
        value:
          snapshot.stopped === true
            ? t('workbench.editors.websocket.session.stoppedTag')
            : snapshot.close === null
              ? t('workbench.editors.websocket.session.noCloseFrame')
              : snapshot.close.reason !== ''
                ? `${snapshot.close.code} — ${snapshot.close.reason}`
                : String(snapshot.close.code),
      });
      if (timing.connectedAt !== undefined) {
        rows.push({ label: t('workbench.editors.websocket.timeline.connected'), atMs: timing.connectedAt });
      }
    }
    if (snapshot.outcome.kind === 'connected') handshakeRows(snapshot);
    return rows;
  }, [snapshot, live, timing, t]);

  // The live badge wears the HTTP status chip's pill — connected reads
  // as a 2xx, connecting as the neutral wash.
  const livePill = useTonePillStyle(live?.open !== null ? 'success' : 'neutral');

  const metaStrip = (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingLeft: 12 }}>
      {snapshot === null ? (
        <>
          <ConnectionDetailsTooltip rows={detailRows}>
            <Tag color="default" style={livePill} data-testid="ws-session-live-badge">
              {live?.open !== null
                ? t('workbench.editors.websocket.session.connectedBadge')
                : t('workbench.editors.websocket.session.connectingBadge')}
            </Tag>
          </ConnectionDetailsTooltip>
          {proxyRouteHasBadge(live?.open?.proxyRoute) && <ProxyRouteTag route={live?.open?.proxyRoute} />}
        </>
      ) : (
        <>
          {closeTag !== null && <ConnectionDetailsTooltip rows={detailRows}>{closeTag}</ConnectionDetailsTooltip>}
          {proxyRouteHasBadge(snapshot.proxyRoute) && <ProxyRouteTag route={snapshot.proxyRoute} />}
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
