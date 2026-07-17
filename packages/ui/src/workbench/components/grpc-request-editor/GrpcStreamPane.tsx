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
 * never produced a response head) render the classified message under
 * the plain Response title row, the unary pane's shape.
 */

import { ClearOutlined, EllipsisOutlined } from '@ant-design/icons';
import { grpcStatusLabel, type ProtoRegistry } from '@openheaders/core/proto';
import type { ExecutedGrpcSnapshot, GrpcMethodRef } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Dropdown, Tabs, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import ResponseHeadersView from '../request-editor/response/ResponseHeadersView';
import GrpcMessageTimeline, { type GrpcTimelineLifecycle } from './GrpcMessageTimeline';
import GrpcMetaStrip from './GrpcMetaStrip';
import GrpcResponseErrorState from './GrpcResponseErrorState';
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
  /** Call target — `/service/rpc` for the lifecycle rows. */
  target: string;
  onClear: () => void;
}

const GrpcStreamPane: React.FC<GrpcStreamPaneProps> = ({
  live,
  snapshot,
  session,
  registry,
  method,
  target,
  onClear,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const [activeTab, setActiveTab] = useState('timeline');

  const inputType = useMemo(() => grpcInputTypeOf(registry, method), [registry, method]);
  const outputType = useMemo(() => grpcOutputTypeOf(registry, method), [registry, method]);

  const lifecycle = useMemo((): GrpcTimelineLifecycle => {
    if (snapshot === null) {
      return {
        target,
        ...(live !== null ? { startedAt: live.startedAt } : {}),
        headArrived: live !== null && live.head !== null,
        ...(live?.connectedAt !== undefined ? { connectedAt: live.connectedAt } : {}),
      };
    }
    return {
      target,
      ...(session?.startedAt !== undefined ? { startedAt: session.startedAt } : {}),
      headArrived: snapshot.error === null,
      ...(session?.connectedAt !== undefined ? { connectedAt: session.connectedAt } : {}),
      endedBy: snapshot.stopped === true ? 'stop' : 'complete',
      ...(session?.endedAt !== undefined ? { endedAt: session.endedAt } : {}),
      ...(snapshot.grpcStatus !== null
        ? { statusLabel: grpcStatusLabel(snapshot.grpcStatus) }
        : { statusLabel: t('workbench.editors.grpc.response.noStatus') }),
      ...(snapshot.grpcMessage !== undefined && snapshot.grpcStatus !== 0 && snapshot.grpcMessage !== ''
        ? { endedMessage: snapshot.grpcMessage }
        : {}),
    };
  }, [snapshot, live, session, target, t]);

  // Pre-head failures render the classified message under the plain
  // Response title row — the unary pane's shape; there was never a
  // call to timeline.
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
        data-testid="grpc-response-error"
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
            {t('workbench.editors.grpc.response.title')}
          </Text>
        </div>
        <GrpcResponseErrorState status={null} detail={snapshot.error} />
      </div>
    );
  }

  // Right-aligned meta strip in the tab bar — the HTTP ResponsePanel's
  // one-row header format: STREAMING while live; the shared strip
  // (status pill popover · duration) plus the ⋯ actions menu once
  // settled.
  const metaStrip = (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingLeft: 12 }}>
      {snapshot === null ? (
        <Tag color="processing" style={{ marginInlineEnd: 0 }} data-testid="grpc-streaming-badge">
          {t('workbench.editors.grpc.stream.streamingBadge')}
        </Tag>
      ) : (
        <>
          <GrpcMetaStrip
            status={snapshot.grpcStatus}
            durationMs={snapshot.durationMs}
            stopped={snapshot.stopped === true}
          />
          <Dropdown
            trigger={['click']}
            overlayStyle={{ minWidth: 180 }}
            menu={{
              items: [
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
                {/* The timeline tracks the pane's height — the sash is
                  the resize affordance, not a fixed inner height. */}
                <div style={{ flex: 1, minHeight: 120, display: 'flex', flexDirection: 'column' }}>
                  <GrpcMessageTimeline
                    items={items}
                    count={count}
                    {...(timestamps !== undefined ? { timestamps } : {})}
                    lifecycle={lifecycle}
                    registry={registry}
                    inputType={inputType}
                    outputType={outputType}
                  />
                </div>
              </div>
            ),
          },
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
                  <ResponseHeadersView headers={headers} />
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
                      <ResponseHeadersView headers={trailerRows} />
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
