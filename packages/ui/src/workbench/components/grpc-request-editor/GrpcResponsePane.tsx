/**
 * GrpcResponsePane — the invoke result surface under the gRPC editor's
 * compose tabs: the `0 OK · 128 ms` status strip (non-zero and missing
 * statuses rendered honestly), then Response / Metadata / Trailers.
 * The Response tab is a display-side decode over the captured frames
 * (see `response-decode.ts`); Metadata and Trailers list the reply's
 * fields verbatim. Error snapshots (the call never produced a
 * response head) render the classified message alone.
 */

import { grpcStatusLabel, type ProtoRegistry } from '@openheaders/core/proto';
import type { ExecutedGrpcSnapshot, GrpcMethodRef } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Alert, Tabs, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import CodeEditor from '../shared/CodeEditor';
import { deriveGrpcMessageView, grpcOutputTypeOf } from './response-decode';

const { Text } = Typography;

interface GrpcResponsePaneProps {
  snapshot: ExecutedGrpcSnapshot;
  registry: ProtoRegistry | null;
  method: GrpcMethodRef | undefined;
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

const GrpcResponsePane: React.FC<GrpcResponsePaneProps> = ({ snapshot, registry, method }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [activeTab, setActiveTab] = useState('response');

  const view = useMemo(
    () => deriveGrpcMessageView(snapshot, registry, grpcOutputTypeOf(registry, method)),
    [snapshot, registry, method],
  );

  if (snapshot.error !== null) {
    return (
      <div style={{ padding: '8px 12px' }} data-testid="grpc-response-error">
        <Alert type="error" showIcon message={snapshot.error} />
      </div>
    );
  }

  const statusStrip = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 0' }}>
      {snapshot.grpcStatus === null ? (
        <Tag color="default" data-testid="grpc-status-tag">
          {t('workbench.editors.grpc.response.noStatus')}
        </Tag>
      ) : (
        <Tag color={snapshot.grpcStatus === 0 ? 'success' : 'error'} data-testid="grpc-status-tag">
          {grpcStatusLabel(snapshot.grpcStatus)}
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
    </div>
  );

  const notices: string[] = [];
  if (snapshot.messages.length > 1) {
    notices.push(t('workbench.editors.grpc.response.extraFrames', { count: snapshot.messages.length }));
  }
  if (snapshot.incompleteTail === true) notices.push(t('workbench.editors.grpc.response.incompleteTail'));
  if (snapshot.bodyTruncated) {
    notices.push(t('workbench.editors.grpc.response.truncated', { bytes: snapshot.bodyCapBytes ?? 0 }));
  }
  if (view.kind === 'structural') notices.push(t('workbench.editors.grpc.response.structuralNotice'));

  const messageBody =
    view.kind === 'none' ? (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {t('workbench.editors.grpc.response.noMessage')}
      </Text>
    ) : view.kind === 'compressed' ? (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {t('workbench.editors.grpc.response.compressed')}
      </Text>
    ) : view.kind === 'raw' ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('workbench.editors.grpc.response.rawNotice')}
        </Text>
        <Text code copyable style={{ fontSize: 11, wordBreak: 'break-all' }}>
          {view.base64}
        </Text>
      </div>
    ) : (
      <CodeEditor value={view.text} language="json" readOnly minHeight={180} />
    );

  return (
    <div
      style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, background: token.colorBgContainer }}
      data-testid="grpc-response-pane"
    >
      {statusStrip}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        size="small"
        style={{ padding: '0 12px' }}
        items={[
          {
            key: 'response',
            label: t('workbench.editors.grpc.response.tab.response'),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8 }}>
                {notices.map((notice) => (
                  <Text key={notice} type="warning" style={{ fontSize: 11 }}>
                    {notice}
                  </Text>
                ))}
                {messageBody}
              </div>
            ),
          },
          {
            key: 'metadata',
            label: t('workbench.editors.grpc.response.tab.metadata'),
            children: (
              <MonoRows rows={snapshot.headers} emptyLabel={t('workbench.editors.grpc.response.noMetadata')} />
            ),
          },
          {
            key: 'trailers',
            label: t('workbench.editors.grpc.response.tab.trailers'),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8 }}>
                {snapshot.grpcStatusSource === 'headers' && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {t('workbench.editors.grpc.response.trailersOnly')}
                  </Text>
                )}
                <MonoRows rows={snapshot.trailers} emptyLabel={t('workbench.editors.grpc.response.noTrailers')} />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

export default GrpcResponsePane;
