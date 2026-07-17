/**
 * GrpcResponsePane — the invoke result surface under the gRPC editor's
 * compose tabs, in the HTTP ResponsePanel's format: the header is ONE
 * row — Response / Metadata / Trailers tabs on the left, the
 * `0 OK · 128 ms` meta strip right-aligned in the tab bar (non-zero
 * and missing statuses rendered honestly). The Response tab is a
 * display-side decode over the captured frames (see
 * `response-decode.ts`); Metadata and Trailers list the reply's fields
 * verbatim. A non-OK status with no reply message renders the friendly
 * `GrpcResponseErrorState` in the Response tab; error snapshots (the
 * call never produced a response head) render the same state's local
 * flavor under the plain Response title row.
 */

import { grpcStatusLabel, type ProtoRegistry } from '@openheaders/core/proto';
import type { ExecutedGrpcSnapshot, GrpcMethodRef } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Tabs, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import CodeEditor from '../shared/CodeEditor';
import GrpcResponseErrorState from './GrpcResponseErrorState';
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
  // one-row header format.
  const metaStrip = (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingLeft: 12 }}>
      {snapshot.grpcMessage !== undefined && snapshot.grpcMessage !== '' && (
        <Text
          type={snapshot.grpcStatus === 0 ? 'secondary' : 'danger'}
          style={{ fontSize: 12, maxWidth: 320 }}
          ellipsis
        >
          {snapshot.grpcMessage}
        </Text>
      )}
      {snapshot.grpcStatus === null ? (
        <Tag color="default" style={{ marginInlineEnd: 0 }} data-testid="grpc-status-tag">
          {t('workbench.editors.grpc.response.noStatus')}
        </Tag>
      ) : (
        <Tag
          color={snapshot.grpcStatus === 0 ? 'success' : 'error'}
          style={{ marginInlineEnd: 0 }}
          data-testid="grpc-status-tag"
        >
          {grpcStatusLabel(snapshot.grpcStatus)}
        </Tag>
      )}
      <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
        {t('workbench.editors.grpc.response.duration', { ms: snapshot.durationMs })}
      </Text>
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
      snapshot.grpcStatus !== null && snapshot.grpcStatus !== 0 ? (
        // A non-OK status with no reply message — the friendly error
        // state carries the status + server message instead of a bare
        // "no response message" line.
        <GrpcResponseErrorState status={snapshot.grpcStatus} detail={snapshot.grpcMessage} />
      ) : (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('workbench.editors.grpc.response.noMessage')}
        </Text>
      )
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
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
        background: token.colorBgContainer,
      }}
      data-testid="grpc-response-pane"
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
            key: 'response',
            label: t('workbench.editors.grpc.response.tab.response'),
            children: (
              <div
                style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' }}
              >
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
              <div style={{ height: '100%', overflow: 'auto', padding: '8px 0' }}>
                <MonoRows rows={snapshot.headers} emptyLabel={t('workbench.editors.grpc.response.noMetadata')} />
              </div>
            ),
          },
          {
            key: 'trailers',
            label: t('workbench.editors.grpc.response.tab.trailers'),
            children: (
              <div
                style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' }}
              >
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
