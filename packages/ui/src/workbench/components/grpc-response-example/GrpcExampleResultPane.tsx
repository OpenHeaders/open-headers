/**
 * GrpcExampleResultPane — the captured-response surface of a saved
 * gRPC example, rendered through the S8 result panes' conventions:
 * ONE-row header (tabs left, the `0 OK · ms` meta strip right-aligned
 * in the tab bar), the shared filterable Metadata / Trailers grids
 * with the `grpc-status`/`grpc-message` pair folded into the pill, and
 * the display-side decode ladder over the captured frames. Unary
 * captures show the decoded reply message (the GrpcResponsePane
 * shape); streamed captures show the direction-tagged message timeline
 * (the GrpcStreamPane shape, timestamps absent by the session-only
 * law). Read-only — the capture is a record, so there is no Clear.
 */

import type { ProtoRegistry } from '@openheaders/core/proto';
import type { CapturedGrpcResponse, GrpcMethodRef } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Tabs, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import ResponseHeadersView from '../request-editor/response/ResponseHeadersView';
import CodeEditor from '../shared/CodeEditor';
import GrpcMessageTimeline, { type GrpcTimelineLifecycle } from '../grpc-request-editor/GrpcMessageTimeline';
import GrpcMetaStrip from '../grpc-request-editor/GrpcMetaStrip';
import GrpcResponseErrorState from '../grpc-request-editor/GrpcResponseErrorState';
import {
  deriveGrpcFrameView,
  grpcInputTypeOf,
  grpcOutputTypeOf,
  withoutGrpcStatusPair,
} from '../grpc-request-editor/response-decode';
import { headPositionOf, isStreamCapture } from './grpc-example-draft';

const { Text } = Typography;

interface GrpcExampleResultPaneProps {
  response: CapturedGrpcResponse;
  registry: ProtoRegistry | null;
  method: GrpcMethodRef | undefined;
  /** ISO capture moment — the strip's hover provenance. */
  capturedAt: string;
}

const GrpcExampleResultPane: React.FC<GrpcExampleResultPaneProps> = ({ response, registry, method, capturedAt }) => {
  const { token } = theme.useToken();
  const t = useT();
  const stream = isStreamCapture(response);
  const [activeTab, setActiveTab] = useState(stream ? 'timeline' : 'response');

  const inputType = useMemo(() => grpcInputTypeOf(registry, method), [registry, method]);
  const outputType = useMemo(() => grpcOutputTypeOf(registry, method), [registry, method]);
  const metadataRows = useMemo(() => withoutGrpcStatusPair(response.metadata), [response.metadata]);
  const trailerRows = useMemo(() => withoutGrpcStatusPair(response.trailers), [response.trailers]);

  const view = useMemo(() => {
    const frame = response.messages[0];
    if (frame === undefined) return { kind: 'none' as const };
    return deriveGrpcFrameView(frame, registry, outputType);
  }, [response.messages, registry, outputType]);

  const lifecycle = useMemo((): GrpcTimelineLifecycle => {
    return {
      headArrived: true,
      headAtMessage: headPositionOf(response),
      endedBy: response.stopped === true ? 'stop' : 'complete',
      ...(response.grpcMessage !== undefined && response.grpcStatus !== 0 && response.grpcMessage !== ''
        ? { endedMessage: response.grpcMessage }
        : {}),
    };
  }, [method, response]);

  const notices: string[] = [];
  if (!stream && response.messages.length > 1) {
    notices.push(t('workbench.editors.grpc.response.extraFrames', { count: response.messages.length }));
  }
  if (response.incompleteTail === true) notices.push(t('workbench.editors.grpc.response.incompleteTail'));
  if (response.bodyTruncated) {
    notices.push(t('workbench.editors.grpc.response.truncated', { bytes: response.bodyCapBytes ?? 0 }));
  }
  if (!stream && view.kind === 'structural') notices.push(t('workbench.editors.grpc.response.structuralNotice'));

  const metaStrip = (
    <Tooltip title={t('workbench.editors.grpcExample.capturedTooltip', { date: new Date(capturedAt).toLocaleString() })}>
      <span style={{ display: 'inline-flex', alignItems: 'center', paddingLeft: 12 }}>
        <GrpcMetaStrip
          status={response.grpcStatus}
          durationMs={response.durationMs}
          stopped={response.stopped === true}
        />
      </span>
    </Tooltip>
  );

  const messageBody =
    view.kind === 'none' ? (
      response.grpcStatus !== null && response.grpcStatus !== 0 ? (
        <GrpcResponseErrorState status={response.grpcStatus} detail={response.grpcMessage} />
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflow: 'auto', minHeight: 0 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('workbench.editors.grpc.response.rawNotice')}
        </Text>
        <Text code copyable style={{ fontSize: 11, wordBreak: 'break-all' }}>
          {view.base64}
        </Text>
      </div>
    ) : (
      <div style={{ flex: 1, minHeight: 100, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          <CodeEditor value={view.text} language="json" readOnly fill />
        </div>
      </div>
    );

  const firstTab = stream
    ? {
        key: 'timeline',
        label: t('workbench.editors.grpc.stream.tab.timeline'),
        children: (
          <div
            style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0', minHeight: 0 }}
          >
            {notices.map((notice) => (
              <Text key={notice} type="warning" style={{ fontSize: 11 }}>
                {notice}
              </Text>
            ))}
            <div style={{ flex: 1, minHeight: 120, display: 'flex', flexDirection: 'column' }}>
              <GrpcMessageTimeline
                items={response.messages}
                count={response.messages.length}
                lifecycle={lifecycle}
                registry={registry}
                inputType={inputType}
                outputType={outputType}
              />
            </div>
          </div>
        ),
      }
    : {
        key: 'response',
        label: t('workbench.editors.grpc.response.tab.response'),
        children: (
          <div
            style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' }}
          >
            {notices.map((notice) => (
              <Text key={notice} type="warning" style={{ fontSize: 11 }}>
                {notice}
              </Text>
            ))}
            {messageBody}
          </div>
        ),
      };

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
      data-testid="grpc-example-result-pane"
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
          firstTab,
          {
            key: 'metadata',
            label:
              metadataRows.length > 0
                ? t('workbench.editors.grpc.response.tab.metadataCount', { count: metadataRows.length })
                : t('workbench.editors.grpc.response.tab.metadata'),
            children: (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {metadataRows.length === 0 ? (
                  <Text type="secondary" style={{ fontSize: 12, padding: '8px 0' }}>
                    {t('workbench.editors.grpc.response.noMetadata')}
                  </Text>
                ) : (
                  <ResponseHeadersView
                    headers={metadataRows}
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
                {response.statusSource === 'headers' && (
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
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

export default GrpcExampleResultPane;
