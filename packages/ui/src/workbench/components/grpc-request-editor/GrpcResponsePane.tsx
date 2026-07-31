/**
 * GrpcResponsePane — the invoke result surface under the gRPC editor's
 * compose tabs, in the HTTP ResponsePanel's format: the header is ONE
 * row — Response / Metadata / Trailers tabs on the left, the
 * `0 OK · 128 ms` meta strip right-aligned in the tab bar (non-zero
 * and missing statuses rendered honestly). The Response tab is a
 * display-side decode over the captured frames (see
 * `response-decode.ts`); Metadata and Trailers render the reply's
 * fields in the shared filterable name/value grid
 * (`ResponseHeadersView`), counts on the tab labels. A non-OK status with no reply message renders the friendly
 * `GrpcResponseErrorState` in the Response tab; error snapshots (the
 * call never produced a response head) render the same state's local
 * flavor under the plain Response title row.
 */

import { ClearOutlined, EllipsisOutlined } from '@ant-design/icons';
import type { ProtoRegistry } from '@openheaders/core/proto';
import type { ExecutedGrpcSnapshot, GrpcMethodRef } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Dropdown, Tabs, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import ResponseHeadersView from '../request-editor/response/ResponseHeadersView';
import { ExampleChip } from '../shared/ExampleChip';
import CodeEditor from '../shared/CodeEditor';
import GrpcMetaStrip from './GrpcMetaStrip';
import GrpcResponseErrorState from './GrpcResponseErrorState';
import { deriveGrpcMessageView, grpcOutputTypeOf, withoutGrpcStatusPair } from './response-decode';

const { Text } = Typography;

interface GrpcResponsePaneProps {
  snapshot: ExecutedGrpcSnapshot;
  registry: ProtoRegistry | null;
  method: GrpcMethodRef | undefined;
  onClear: () => void;
  /**
   * "Save Response" — snapshot the settled exchange as an example under
   * the gRPC request (the HTTP ResponsePanel's placement: first item of
   * the ⋯ actions menu). Undefined hides the item.
   */
  onSaveResponse?: () => void;
}

const GrpcResponsePane: React.FC<GrpcResponsePaneProps> = ({ snapshot, registry, method, onClear, onSaveResponse }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [activeTab, setActiveTab] = useState('response');

  const view = useMemo(
    () => deriveGrpcMessageView(snapshot, registry, grpcOutputTypeOf(registry, method)),
    [snapshot, registry, method],
  );
  // The grids show fields beyond the status pair — the pair itself is
  // the pill + error chip (the Postman convention).
  const metadataRows = useMemo(() => withoutGrpcStatusPair(snapshot.headers), [snapshot.headers]);
  const trailerRows = useMemo(() => withoutGrpcStatusPair(snapshot.trailers), [snapshot.trailers]);

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
  // one-row header format: status pill (hover popover with the code's
  // meaning) · duration, then the ⋯ actions menu.
  const metaStrip = (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingLeft: 12 }}>
      <GrpcMetaStrip
        status={snapshot.grpcStatus}
        durationMs={snapshot.durationMs}
        {...(snapshot.proxyRoute !== undefined ? { proxyRoute: snapshot.proxyRoute } : {})}
      />
      <Dropdown
        trigger={['click']}
        overlayStyle={{ minWidth: 180 }}
        menu={{
          items: [
            // Save Response leads — the one action that mints a durable
            // artifact (the HTTP ResponsePanel's menu order).
            ...(onSaveResponse
              ? [
                  {
                    key: 'save-response',
                    icon: <ExampleChip />,
                    label: (
                      <span data-testid="grpc-save-response">{t('workbench.editors.grpc.response.saveResponse')}</span>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflow: 'auto', minHeight: 0 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('workbench.editors.grpc.response.rawNotice')}
        </Text>
        <Text code copyable style={{ fontSize: 11, wordBreak: 'break-all' }}>
          {view.base64}
        </Text>
      </div>
    ) : (
      // Fill viewer bounded by the sash (the compose editor's inset
      // discipline) — no fixed height, no manual grip.
      <div style={{ flex: 1, minHeight: 100, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          <CodeEditor value={view.text} language="json" readOnly fill />
        </div>
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
              // No scroll container here — the fill viewer must not
              // feed its Monaco-written height back into a scrolling
              // parent (the ratchet). Non-fill branches scroll inside
              // their own wrappers.
              <div
                style={{
                  height: '100%',
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '8px 0',
                }}
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
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

export default GrpcResponsePane;
