/**
 * WsResponseExampleView — editor tab for a saved WebSocket response
 * example, the `GrpcResponseExampleView` sibling for the
 * WebSocketRequest family. The captured request half stays editable
 * (an example doubles as an authored record): flavor chip + scheme
 * lock + URL in the header (the flavor is the capture's fact — a
 * static chip, never a toggle), Message / Headers / Params compose
 * tabs below with the socketio event fields on the Message tab's
 * toolbar. The captured session half renders read-only through
 * `WsExampleResultPane` in the compose/result Allotment split.
 *
 * "Open in Request" hands the current captured request shape to the
 * parent WebSocket editor as unsaved draft edits via the prefill bus —
 * the gRPC example's flow applied to the third family.
 *
 * Editor mechanics follow the house recipe: draft state, structural
 * dirty via `useReprime` (uid-free fingerprints), Save through the
 * WebSocket response-example write client (the captured block patches
 * as one LWW value), shell wiring via `useEditorShell`.
 */

import { ExportOutlined, LoadingOutlined } from '@ant-design/icons';
import { WS_RESPONSE_EXAMPLE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { WsResponseExample } from '@openheaders/core/types';
import { Allotment } from 'allotment';
import { App, Button, Input, Switch, Tabs, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityScopeProvider } from '@openheaders/ui/shared/awareness';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useWsResponseExample } from '@openheaders/ui/shared/hooks/readers/useWsResponseExamples';
import { applyWsResponseExampleUpdate } from '@openheaders/ui/shared/sync/ws-response-example-write-client';
import EditorHeader from '../shell/EditorHeader';
import CodeEditor from '../shared/CodeEditor';
import KeyValueTable from '../request-editor/KeyValueTable';
import { MESSAGE_FORMAT_LANGUAGE } from '../websocket-request-editor/compose';
import { publishWsPrefill } from '../websocket-request-editor/ws-prefill-bus';
import {
  BinaryEncodingSelect,
  MessageFormatSelect,
  rawMessagePlaceholder,
} from '../websocket-request-editor/ws-format-parts';
import WsExampleResultPane from './WsExampleResultPane';
import {
  capturedWsRequestFromDraft,
  type WsExampleDraft,
  wsExampleDraftFingerprint,
  wsExampleSignature,
  wsExampleToDraft,
} from './ws-example-draft';

const { Text } = Typography;

interface WsResponseExampleViewProps {
  exampleUid: string;
  workspaceId: string | null;
  /** "Open in Request" — open the parent WebSocket request's edit tab;
   *  the captured shape rides the prefill bus into its draft. */
  onOpenWebSocketRequest: (uid: string, name: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

const WsResponseExampleView: React.FC<WsResponseExampleViewProps> = ({
  exampleUid,
  workspaceId,
  onOpenWebSocketRequest,
  onDirtyChange,
  registerSaveRef,
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const t = useT();
  const { example, hydrated } = useWsResponseExample(workspaceId, exampleUid);
  const { websocketRequests } = useRequests();

  const parentRequest = useMemo(
    () => (example ? (websocketRequests.find((r) => r.uid === example.websocketRequestUid) ?? null) : null),
    [websocketRequests, example],
  );

  const [draft, setDraft] = useState<WsExampleDraft | null>(null);
  const [activeTab, setActiveTab] = useState('message');

  const reprime = useReprime<WsResponseExample>({
    liveEntity: example,
    scope: { entityType: WS_RESPONSE_EXAMPLE_ENTITY_TYPE, entityId: exampleUid },
    enabled: hydrated,
    formFingerprint: draft ? wsExampleDraftFingerprint(draft) : '',
    signature: wsExampleSignature,
    populate: (e) => setDraft(wsExampleToDraft(e)),
  });
  const isDirty = reprime.isDirty;

  const flavor = example?.request.flavor ?? 'raw';
  const socketioFlavor = flavor === 'socketio';

  const handleSave = useCallback(async () => {
    if (!draft || !example || !workspaceId || !isDirty) return;
    const result = await applyWsResponseExampleUpdate(
      exampleUid,
      { request: capturedWsRequestFromDraft(draft, example.request.flavor) },
      { workspaceId, surfaceId: 'workbench' },
    );
    if (!result.ok) {
      if (result.reason === 'not-found') message.error(t('workbench.editors.wsExample.toast.deletedOtherTab'));
      else if ('message' in result && result.message)
        message.error(t('workbench.editors.wsExample.toast.saveFailedDetail', { message: result.message }));
      else message.error(t('workbench.editors.wsExample.toast.saveFailed'));
    }
  }, [draft, example, workspaceId, isDirty, exampleUid, message, t]);

  const handleSaveSync = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  const shell = useEditorShell({
    entityType: WS_RESPONSE_EXAMPLE_ENTITY_TYPE,
    entityId: example?.uid ?? null,
    isDirty,
    onSave: handleSaveSync,
    onDirtyChange,
    registerSaveRef,
  });

  const handleOpenInRequest = useCallback(() => {
    if (!draft || !example || !parentRequest) return;
    publishWsPrefill(parentRequest.uid, capturedWsRequestFromDraft(draft, example.request.flavor));
    onOpenWebSocketRequest(parentRequest.uid, parentRequest.name);
  }, [draft, example, parentRequest, onOpenWebSocketRequest]);

  if (!hydrated || (example && !draft)) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">
          <LoadingOutlined style={{ marginRight: 6 }} />
          {t('workbench.editors.wsExample.loading')}
        </Text>
      </div>
    );
  }

  if (!example || !draft) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">{t('workbench.editors.wsExample.notFound')}</Text>
      </div>
    );
  }

  const headerTitle = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
      <Input
        style={{ flex: 1, minWidth: 0, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
        placeholder={t('workbench.editors.request.url.placeholder')}
        value={draft.url}
        onChange={(e) => setDraft((d) => (d ? { ...d, url: e.target.value } : d))}
        data-testid="ws-example-url-input"
      />
    </div>
  );

  const openDisabled = parentRequest === null;
  const headerActions = (
    <Tooltip
      title={
        openDisabled
          ? t('workbench.editors.websocket.notFound')
          : t('workbench.editors.wsExample.openInRequestTooltip')
      }
      placement="bottom"
    >
      <span style={{ display: 'inline-flex', cursor: openDisabled ? 'not-allowed' : undefined }}>
        <Button
          size="small"
          type="primary"
          icon={<ExportOutlined />}
          disabled={openDisabled}
          onClick={handleOpenInRequest}
          data-testid="ws-example-open-in-request"
        >
          {t('workbench.editors.wsExample.openInRequest')}
        </Button>
      </span>
    </Tooltip>
  );

  return (
    <EntityScopeProvider shell={shell.scopeProps}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: token.colorBgContainer,
          height: '100%',
        }}
      >
        <EditorHeader title={headerTitle} actions={headerActions} shell={shell.headerProps} />
        <div style={{ flex: 1, minHeight: 0 }}>
          <Allotment vertical proportionalLayout separator>
            <Allotment.Pane minSize={180} preferredSize="45%">
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
                <div style={{ padding: '0 12px' }}>
                  <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    size="small"
                    tabBarStyle={{ marginBottom: 0 }}
                    items={[
                      { key: 'message', label: t('workbench.editors.websocket.tab.message') },
                      { key: 'headers', label: t('workbench.editors.websocket.tab.headers') },
                      { key: 'params', label: t('workbench.editors.websocket.tab.params') },
                    ]}
                  />
                </div>
                <div
                  style={{
                    flex: 1,
                    overflow: 'auto',
                    overscrollBehavior: 'none',
                    padding: '0 12px',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ padding: '10px 0', flex: '1 0 auto', display: 'flex', flexDirection: 'column' }}>
                    {activeTab === 'message' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
                        {socketioFlavor && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Input
                              size="small"
                              style={{ maxWidth: 260, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
                              placeholder={t('workbench.editors.websocket.event.namePlaceholder')}
                              value={draft.eventName}
                              onChange={(e) => setDraft((d) => (d ? { ...d, eventName: e.target.value } : d))}
                              data-testid="ws-example-event-name"
                            />
                            <Tooltip title={t('workbench.editors.websocket.event.ackHelp')}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <Switch
                                  size="small"
                                  checked={draft.ackEnabled}
                                  onChange={(ackEnabled) => setDraft((d) => (d ? { ...d, ackEnabled } : d))}
                                />
                                <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                                  {t('workbench.editors.websocket.event.ackLabel')}
                                </Text>
                              </span>
                            </Tooltip>
                          </div>
                        )}
                        <div style={{ flex: 1, minHeight: 100, position: 'relative' }}>
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
                            <CodeEditor
                              value={draft.message}
                              onChange={(msg) => setDraft((d) => (d ? { ...d, message: msg } : d))}
                              language={socketioFlavor ? 'json' : MESSAGE_FORMAT_LANGUAGE[draft.messageFormat]}
                              fill
                              placeholder={
                                socketioFlavor
                                  ? t('workbench.editors.websocket.event.argsPlaceholder')
                                  : rawMessagePlaceholder(t, draft.messageFormat, draft.binaryEncoding)
                              }
                            />
                          </div>
                        </div>
                        {/* Compose bar BELOW the editor — the request editor's
                          format anatomy on the captured record. */}
                        {!socketioFlavor && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <MessageFormatSelect
                              value={draft.messageFormat}
                              onChange={(messageFormat) => setDraft((d) => (d ? { ...d, messageFormat } : d))}
                              testId="ws-example-message-format"
                            />
                            {draft.messageFormat === 'binary' && (
                              <BinaryEncodingSelect
                                value={draft.binaryEncoding}
                                onChange={(binaryEncoding) => setDraft((d) => (d ? { ...d, binaryEncoding } : d))}
                                testId="ws-example-binary-encoding"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {activeTab === 'headers' && (
                      <KeyValueTable
                        rows={draft.headers}
                        onChange={(headers) => setDraft((d) => (d ? { ...d, headers } : d))}
                        keyPlaceholder={t('workbench.editors.websocket.headers.keyPlaceholder')}
                        valuePlaceholder={t('workbench.editors.websocket.headers.valuePlaceholder')}
                      />
                    )}
                    {activeTab === 'params' && (
                      <KeyValueTable
                        rows={draft.params}
                        onChange={(params) => setDraft((d) => (d ? { ...d, params } : d))}
                      />
                    )}
                  </div>
                </div>
              </div>
            </Allotment.Pane>
            <Allotment.Pane minSize={140}>
              <WsExampleResultPane
                response={example.response}
                flavor={example.request.flavor}
                capturedAt={example.capturedAt}
              />
            </Allotment.Pane>
          </Allotment>
        </div>
      </div>
    </EntityScopeProvider>
  );
};

export default WsResponseExampleView;
