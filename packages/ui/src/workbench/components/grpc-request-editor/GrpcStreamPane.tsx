/**
 * GrpcStreamPane — the invoke result surface for STREAMING methods,
 * the `GrpcResponsePane` sibling with a message timeline where the
 * unary pane has a single decoded message. One pane across both
 * phases: live (STREAMING badge, timeline fed from the
 * `grpcStreamEvent` feed, metadata from the live head) and
 * materialized (status strip from the snapshot — non-zero, missing,
 * and stopped states rendered honestly — timeline fed from the
 * direction-tagged capture with the session's timestamps joined
 * positionally). Error snapshots (the call never produced a response
 * head) render the classified message alone, the unary pane's shape.
 */

import { grpcStatusLabel, type ProtoRegistry } from '@openheaders/core/proto';
import type { ExecutedGrpcSnapshot, GrpcMethodRef } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Alert, Tabs, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import GrpcMessageTimeline, { type GrpcTimelineLifecycle } from './GrpcMessageTimeline';
import { grpcInputTypeOf, grpcOutputTypeOf } from './response-decode';
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
}

const MonoRows: React.FC<{ rows: ReadonlyArray<{ key: string; value: string }>; emptyLabel: string }> = ({
  rows,
  emptyLabel,
}) => {
  const { token } = theme.useToken();
  if (rows.length === 0) {
    return (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {emptyLabel}
      </Text>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto' }}>
      {rows.map((row, i) => (
        <div
          // Wire order is the identity — repeated keys are legal.
          key={`${row.key}:${i}`}
          style={{ display: 'flex', gap: 8, fontFamily: "'SF Mono', monospace", fontSize: 12, lineHeight: '20px' }}
        >
          <span style={{ color: token.colorTextSecondary, whiteSpace: 'nowrap' }}>{row.key}:</span>
          <span style={{ wordBreak: 'break-all' }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
};

const GrpcStreamPane: React.FC<GrpcStreamPaneProps> = ({ live, snapshot, session, registry, method, target }) => {
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

  // Pre-head failures render the classified message alone — the unary
  // pane's shape; there was never a call to timeline.
  if (snapshot !== null && snapshot.error !== null) {
    return (
      <div style={{ padding: '8px 12px' }} data-testid="grpc-response-error">
        <Alert type="error" showIcon message={snapshot.error} />
      </div>
    );
  }

  const statusStrip = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 0' }}>
      {snapshot === null ? (
        <Tag color="processing" data-testid="grpc-streaming-badge">
          {t('workbench.editors.grpc.stream.streamingBadge')}
        </Tag>
      ) : (
        <>
          {snapshot.grpcStatus === null ? (
            <Tag color="default" data-testid="grpc-status-tag">
              {t('workbench.editors.grpc.response.noStatus')}
            </Tag>
          ) : (
            <Tag color={snapshot.grpcStatus === 0 ? 'success' : 'error'} data-testid="grpc-status-tag">
              {grpcStatusLabel(snapshot.grpcStatus)}
            </Tag>
          )}
          {snapshot.stopped === true && (
            <Tag color="warning" data-testid="grpc-stopped-tag">
              {t('workbench.editors.grpc.stream.stoppedBadge')}
            </Tag>
          )}
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('workbench.editors.grpc.response.duration', { ms: snapshot.durationMs })}
          </Text>
          {snapshot.grpcMessage !== undefined && snapshot.grpcMessage !== '' && (
            <Text type={snapshot.grpcStatus === 0 ? 'secondary' : 'danger'} style={{ fontSize: 12 }} ellipsis>
              {snapshot.grpcMessage}
            </Text>
          )}
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
  const headers = snapshot?.headers ?? live?.head?.headers ?? [];

  return (
    <div
      style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, background: token.colorBgContainer }}
      data-testid="grpc-stream-pane"
    >
      {statusStrip}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        size="small"
        style={{ padding: '0 12px' }}
        items={[
          {
            key: 'timeline',
            label: t('workbench.editors.grpc.stream.tab.timeline'),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8 }}>
                {notices.map((notice) => (
                  <Text key={notice} type="warning" style={{ fontSize: 11 }}>
                    {notice}
                  </Text>
                ))}
                <div style={{ height: 280, display: 'flex', flexDirection: 'column' }}>
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
            label: t('workbench.editors.grpc.response.tab.metadata'),
            children: <MonoRows rows={headers} emptyLabel={t('workbench.editors.grpc.response.noMetadata')} />,
          },
          {
            key: 'trailers',
            label: t('workbench.editors.grpc.response.tab.trailers'),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8 }}>
                {snapshot === null ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('workbench.editors.grpc.stream.trailersPending')}
                  </Text>
                ) : (
                  <>
                    {snapshot.grpcStatusSource === 'headers' && (
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {t('workbench.editors.grpc.response.trailersOnly')}
                      </Text>
                    )}
                    <MonoRows
                      rows={snapshot.trailers}
                      emptyLabel={t('workbench.editors.grpc.response.noTrailers')}
                    />
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
