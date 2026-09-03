/**
 * GrpcStreamPane — the invoke result surface for STREAMING methods,
 * the `GrpcResponsePane` sibling with a message timeline where the
 * unary pane has a single decoded message. One pane across both
 * phases: live (STREAMING badge, timeline fed from the
 * `grpcStreamEvent` feed, metadata from the live head) and
 * materialized (snapshot status — non-zero, missing, and stopped
 * states rendered honestly — timeline fed from the direction-tagged
 * capture with the session's timestamps joined positionally). The
 * header is ONE row in the HTTP ResponsePanel's format: tabs left,
 * meta strip right-aligned in the tab bar. Error snapshots (the call
 * never produced a response head) render through the SAME pane — the
 * classified message rides the timeline as its error-flavored ended
 * row and the meta strip pills Call failed — never a bare error wall
 * (the WS/MQTT session panes' law).
 */

import { ClearOutlined, CloseOutlined, EllipsisOutlined } from '@ant-design/icons';
import type { ProtoRegistry } from '@openheaders/core/proto';
import type { ExecutedGrpcSnapshot, GrpcMethodRef } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Dropdown, Tabs, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import ProxyRouteTag, { proxyRouteHasBadge } from '../request-editor/response/ProxyRouteTag';
import { useTonePillStyle } from '../request-editor/response/response-status';
import ResponseHeadersView from '../request-editor/response/ResponseHeadersView';
import TrustCertificateOffer from '../request-editor/response/TrustCertificateOffer';
import { ExampleChip } from '../shared/ExampleChip';
import GrpcMessageTimeline, { type GrpcTimelineLifecycle } from './GrpcMessageTimeline';
import GrpcMetaStrip from './GrpcMetaStrip';
import GrpcScriptsTag from './GrpcScriptsTag';
import GrpcScriptsView from './GrpcScriptsView';
import { digestFromMarks, digestFromRecord, scriptMarkItems } from './grpc-scripts';
import { grpcInputTypeOf, grpcOutputTypeOf, withoutGrpcStatusPair } from './response-decode';
import type { GrpcStreamSession, LiveGrpcStream } from './useLiveGrpcStream';

const { Text } = Typography;

interface GrpcStreamPaneProps {
  /** Non-null while the invoke is in flight. */
  live: LiveGrpcStream | null;
  /** Non-null once the invoke settled. */
  snapshot: ExecutedGrpcSnapshot | null;
  /** Session-only timing captured at materialization. */
  session: GrpcStreamSession | null;
  registry: ProtoRegistry | null;
  method: GrpcMethodRef | undefined;
  onClear: () => void;
  /**
   * "Save Response" — snapshot the SETTLED stream capture as an example
   * under the gRPC request, first item of the ⋯ actions menu. Rendered
   * only once the snapshot is in (never mid-flight); undefined hides
   * the item.
   */
  onSaveResponse?: () => void;
  /** Invoke again after a trust gesture — the editor's Invoke. */
  onReinvoke?: () => void;
}

const GrpcStreamPane: React.FC<GrpcStreamPaneProps> = ({
  live,
  snapshot,
  session,
  registry,
  method,
  onClear,
  onSaveResponse,
  onReinvoke,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const [activeTab, setActiveTab] = useState('timeline');
  // A verification failure's remedy — shown only once the error row's
  // Trust certificate button asks for it; a new call closes it.
  const trustHint = snapshot?.hint ?? null;
  const [trustOfferOpen, setTrustOfferOpen] = useState(false);
  useEffect(() => {
    if (trustHint === null) setTrustOfferOpen(false);
  }, [trustHint]);

  const inputType = useMemo(() => grpcInputTypeOf(registry, method), [registry, method]);
  const outputType = useMemo(() => grpcOutputTypeOf(registry, method), [registry, method]);

  // The call's scripts — the marks (live: the feed's; settled: the
  // snapshot's, joined with the session timing the editor retained)
  // feed the timeline rows and the Scripts tab; the tag digests the
  // marks live and the snapshot's record once settled (the record's
  // tallies outlive the mark cap). A call with no hook shows neither.
  const scriptMarks = useMemo(
    () =>
      snapshot !== null
        ? scriptMarkItems(snapshot.scriptMarks ?? [], session?.scriptMarkTimestamps)
        : live !== null
          ? scriptMarkItems(live.scriptMarks, live.scriptMarkTimestamps)
          : [],
    [snapshot, session, live],
  );
  const scriptsDigest = useMemo(
    () => (snapshot?.scripts !== undefined ? digestFromRecord(snapshot.scripts) : digestFromMarks(scriptMarks)),
    [snapshot, scriptMarks],
  );
  const scriptsInPlay = scriptsDigest.runs > 0;
  // The Scripts tab joins only once a hook ran — no teaser tab on a
  // scriptless call; a selection it can no longer honor falls back.
  const shownTab = activeTab === 'scripts' && !scriptsInPlay ? 'timeline' : activeTab;

  const lifecycle = useMemo((): GrpcTimelineLifecycle => {
    if (snapshot === null) {
      return {
        ...(live !== null ? { startedAt: live.startedAt } : {}),
        headArrived: live !== null && live.head !== null,
        ...(live?.connectedAt !== undefined ? { connectedAt: live.connectedAt } : {}),
        ...(live?.headAtMessage !== undefined ? { headAtMessage: live.headAtMessage } : {}),
        ...(live?.sentMetadata !== undefined ? { requestMetadata: live.sentMetadata } : {}),
      };
    }
    // Terminal instants prefer the observed truth — the end frame's
    // host stamp; the editor's settle stamp stays the fallback toward
    // hosts that predate the lifecycle stamps.
    const settledAt = session?.settledAt ?? session?.endedAt;
    // A pre-head failure (the call never produced a response head)
    // settles as the timeline's error-flavored ended row — the
    // classified message verbatim at the new edge; never a bare error
    // wall (the WS/MQTT session panes' law).
    // The sent row expands to the metadata the call actually carried —
    // recorded by the executor at dispatch, so it exists on failures
    // too. Recorded-empty passes through: the row expands to the
    // honest "No metadata sent." line.
    const requestMetadata = snapshot.requestMetadata;
    if (snapshot.error !== null) {
      return {
        ...(session?.startedAt !== undefined ? { startedAt: session.startedAt } : {}),
        ...(requestMetadata !== undefined ? { requestMetadata } : {}),
        headArrived: false,
        endedBy: 'error',
        ...(settledAt !== undefined ? { endedAt: settledAt } : {}),
        endedMessage: snapshot.error,
      };
    }
    return {
      ...(session?.startedAt !== undefined ? { startedAt: session.startedAt } : {}),
      ...(requestMetadata !== undefined ? { requestMetadata } : {}),
      headArrived: true,
      ...(session?.connectedAt !== undefined ? { connectedAt: session.connectedAt } : {}),
      ...(snapshot.headAtMessage !== undefined ? { headAtMessage: snapshot.headAtMessage } : {}),
      // A connection lost after the head ends the timeline on its own
      // row, the reason behind the chevron (the failed row's anatomy).
      endedBy: snapshot.stopped === true ? 'stop' : snapshot.connectionError !== undefined ? 'lost' : 'complete',
      ...(settledAt !== undefined ? { endedAt: settledAt } : {}),
      ...(snapshot.connectionError !== undefined
        ? { endedMessage: snapshot.connectionError }
        : snapshot.grpcMessage !== undefined && snapshot.grpcStatus !== 0 && snapshot.grpcMessage !== ''
          ? { endedMessage: snapshot.grpcMessage }
          : {}),
    };
  }, [snapshot, live, session]);

  // Right-aligned meta strip in the tab bar — the HTTP ResponsePanel's
  // one-row header format: STREAMING while live; the shared strip
  // (status pill popover · duration) plus the ⋯ actions menu once
  // settled.
  // The live badge wears the session pill (the WebSocket Connected
  // treatment) on the info hue — bold text on a real wash, not the
  // faint processing tag.
  const streamingPill = useTonePillStyle('info');
  const metaStrip = (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingLeft: 12 }}>
      {snapshot === null ? (
        <>
          <Tag color="default" style={streamingPill} data-testid="grpc-streaming-badge">
            {t('workbench.editors.grpc.stream.streamingBadge')}
          </Tag>
          {proxyRouteHasBadge(live?.head?.proxyRoute) && <ProxyRouteTag route={live?.head?.proxyRoute} />}
          <GrpcScriptsTag digest={scriptsDigest} />
        </>
      ) : (
        <>
          <GrpcMetaStrip
            status={snapshot.grpcStatus}
            stopped={snapshot.stopped === true}
            {...(snapshot.error !== null ? { error: snapshot.error } : {})}
            {...(snapshot.localStatus !== undefined ? { localStatus: snapshot.localStatus } : {})}
            {...(snapshot.connectionError !== undefined ? { connectionError: snapshot.connectionError } : {})}
            {...(snapshot.proxyRoute !== undefined ? { proxyRoute: snapshot.proxyRoute } : {})}
            {...(snapshot.auth !== undefined ? { auth: snapshot.auth } : {})}
          />
          <GrpcScriptsTag digest={scriptsDigest} />
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
                          <span data-testid="grpc-save-response">
                            {t('workbench.editors.grpc.response.saveResponse')}
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
              data-testid="grpc-response-actions"
            />
          </Dropdown>
        </>
      )}
    </div>
  );

  const notices: string[] = [];
  if (snapshot?.incompleteTail === true) notices.push(t('workbench.editors.grpc.response.incompleteTail'));
  if (snapshot?.bodyTruncated === true) {
    notices.push(t('workbench.editors.grpc.response.truncated', { bytes: snapshot.bodyCapBytes ?? 0 }));
  }

  const items = snapshot?.messages ?? live?.items ?? [];
  const count = snapshot?.messages.length ?? live?.count ?? 0;
  const timestamps = snapshot !== null ? session?.messageTimestamps : live?.timestamps;
  // The grids show fields beyond the status pair — the pair itself is
  // the pill + error chip (the Postman convention).
  const headers = withoutGrpcStatusPair(snapshot?.headers ?? live?.head?.headers ?? []);
  const trailerRows = withoutGrpcStatusPair(snapshot?.trailers ?? []);

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
      data-testid="grpc-stream-pane"
    >
      <Tabs
        activeKey={shownTab}
        onChange={setActiveTab}
        size="small"
        className="rules-response-tabs"
        style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', minHeight: 0 }}
        tabBarStyle={{ marginBottom: 0 }}
        tabBarExtraContent={{ right: metaStrip }}
        items={[
          {
            key: 'timeline',
            label: t('workbench.editors.grpc.stream.tab.timeline'),
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
                {notices.map((notice) => (
                  <Text key={notice} type="warning" style={{ fontSize: 11 }}>
                    {notice}
                  </Text>
                ))}
                {trustHint !== null && trustOfferOpen && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 4 }}>
                    <TrustCertificateOffer
                      hint={trustHint}
                      {...(onReinvoke !== undefined ? { onResend: onReinvoke } : {})}
                    />
                    <Button
                      size="small"
                      type="text"
                      icon={<CloseOutlined style={{ fontSize: 11 }} />}
                      onClick={() => setTrustOfferOpen(false)}
                      aria-label={t('shared.action.close')}
                      data-testid="grpc-stream-trust-offer-close"
                    />
                  </div>
                )}
                {/* The timeline tracks the pane's height — the sash is
                  the resize affordance, not a fixed inner height. */}
                <div style={{ flex: 1, minHeight: 120, display: 'flex', flexDirection: 'column' }}>
                  <GrpcMessageTimeline
                    items={items}
                    count={count}
                    {...(timestamps !== undefined ? { timestamps } : {})}
                    lifecycle={lifecycle}
                    scriptMarks={scriptMarks}
                    registry={registry}
                    inputType={inputType}
                    outputType={outputType}
                    responseMetadataCount={headers.length}
                    onShowMetadata={() => setActiveTab('metadata')}
                    {...(trustHint !== null ? { onTrustCertificate: () => setTrustOfferOpen((open) => !open) } : {})}
                    trustOfferOpen={trustOfferOpen}
                  />
                </div>
              </div>
            ),
          },
          ...(scriptsInPlay
            ? [
                {
                  key: 'scripts',
                  label: (
                    <span data-testid="grpc-stream-view-scripts">
                      {t('workbench.editors.grpc.response.tab.scripts')}
                    </span>
                  ),
                  children: (
                    <div
                      style={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '0 0 8px',
                        minHeight: 0,
                      }}
                    >
                      <GrpcScriptsView marks={scriptMarks} marksCapped={scriptsDigest.marksCapped} />
                    </div>
                  ),
                },
              ]
            : []),
          {
            key: 'metadata',
            label:
              headers.length > 0
                ? t('workbench.editors.grpc.response.tab.metadataCount', { count: headers.length })
                : t('workbench.editors.grpc.response.tab.metadata'),
            children: (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {headers.length === 0 ? (
                  <Text type="secondary" style={{ fontSize: 12, padding: '8px 0' }}>
                    {t('workbench.editors.grpc.response.noMetadata')}
                  </Text>
                ) : (
                  <ResponseHeadersView
                    headers={headers}
                    filterPlaceholder={t('workbench.editors.grpc.response.filterMetadata')}
                  />
                )}
              </div>
            ),
          },
          {
            key: 'trailers',
            label:
              trailerRows.length > 0
                ? t('workbench.editors.grpc.response.tab.trailersCount', { count: trailerRows.length })
                : t('workbench.editors.grpc.response.tab.trailers'),
            children: (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, gap: 6 }}>
                {snapshot === null ? (
                  <Text type="secondary" style={{ fontSize: 12, padding: '8px 0' }}>
                    {t('workbench.editors.grpc.stream.trailersPending')}
                  </Text>
                ) : (
                  <>
                    {snapshot.grpcStatusSource === 'headers' && (
                      <Text type="secondary" style={{ fontSize: 11, paddingTop: 8 }}>
                        {t('workbench.editors.grpc.response.trailersOnly')}
                      </Text>
                    )}
                    {trailerRows.length === 0 ? (
                      <Text type="secondary" style={{ fontSize: 12, padding: '8px 0' }}>
                        {t('workbench.editors.grpc.response.noTrailers')}
                      </Text>
                    ) : (
                      <ResponseHeadersView
                        headers={trailerRows}
                        filterPlaceholder={t('workbench.editors.grpc.response.filterTrailers')}
                      />
                    )}
                  </>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

export default GrpcStreamPane;
