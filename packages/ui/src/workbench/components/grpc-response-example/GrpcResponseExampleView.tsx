/**
 * GrpcResponseExampleView — editor tab for a saved gRPC response
 * example, the `ResponseExampleView` sibling for the GrpcRequest
 * family. The captured request half stays editable (an example doubles
 * as an authored record): TLS lock + authority in the header (the S8
 * one-row discipline; the invoked method renders as a static label —
 * method identity is the capture's fact), Message / Metadata compose
 * tabs below. The captured response half renders read-only through
 * `GrpcExampleResultPane` in the compose/result Allotment split.
 *
 * "Open in Request" hands the current captured request shape to the
 * parent gRPC editor as unsaved draft edits via the prefill bus — the
 * HTTP example's "Try" fork adapted to a family with no scratch mode.
 *
 * Editor mechanics follow the house recipe: draft state, structural
 * dirty via `useReprime` (uid-free fingerprints), Save through the
 * gRPC response-example write client (the captured block patches as
 * one LWW value), shell wiring via `useEditorShell`. The decode
 * registry derives live from the PARENT request's linked spec — the
 * capture carries no spec binding, and decode is a display-side view.
 */

import { ExportOutlined, LoadingOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';
import { GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { GrpcResponseExample } from '@openheaders/core/types';
import { Allotment } from 'allotment';
import { App, Button, Input, Tabs, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityScopeProvider } from '@openheaders/ui/shared/awareness';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useSpecs } from '@openheaders/ui/shared/hooks/readers/useSpecs';
import { useGrpcResponseExample } from '@openheaders/ui/shared/hooks/readers/useGrpcResponseExamples';
import { applyGrpcResponseExampleUpdate } from '@openheaders/ui/shared/sync/grpc-response-example-write-client';
import EditorHeader from '../shell/EditorHeader';
import CodeEditor from '../shared/CodeEditor';
import KeyValueTable from '../request-editor/KeyValueTable';
import { deriveGrpcMethods } from '../grpc-request-editor/method-selector';
import { publishGrpcPrefill } from '../grpc-request-editor/grpc-prefill-bus';
import GrpcExampleResultPane from './GrpcExampleResultPane';
import {
  capturedGrpcRequestFromDraft,
  type GrpcExampleDraft,
  grpcExampleDraftFingerprint,
  grpcExampleSignature,
  grpcExampleToDraft,
} from './grpc-example-draft';

const { Text } = Typography;

interface GrpcResponseExampleViewProps {
  exampleUid: string;
  workspaceId: string | null;
  /** "Open in Request" — open the parent gRPC request's edit tab; the
   *  captured shape rides the prefill bus into its draft. */
  onOpenGrpcRequest: (uid: string, name: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

const GrpcResponseExampleView: React.FC<GrpcResponseExampleViewProps> = ({
  exampleUid,
  workspaceId,
  onOpenGrpcRequest,
  onDirtyChange,
  registerSaveRef,
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const t = useT();
  const { example, hydrated } = useGrpcResponseExample(workspaceId, exampleUid);
  const { grpcRequests } = useRequests();
  const specs = useSpecs(workspaceId);

  const parentRequest = useMemo(
    () => (example ? (grpcRequests.find((r) => r.uid === example.grpcRequestUid) ?? null) : null),
    [grpcRequests, example],
  );

  // Display-side decode registry — the parent's linked spec, live.
  const registry = useMemo(() => {
    const specUid = parentRequest?.specLink?.specUid;
    if (!specUid) return null;
    const spec = specs.find((s) => s.uid === specUid && s.format === 'protobuf');
    return spec ? deriveGrpcMethods(spec).registry : null;
  }, [parentRequest, specs]);

  const [draft, setDraft] = useState<GrpcExampleDraft | null>(null);
  const [activeTab, setActiveTab] = useState('message');

  const reprime = useReprime<GrpcResponseExample>({
    liveEntity: example,
    scope: { entityType: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE, entityId: exampleUid },
    enabled: hydrated,
    formFingerprint: draft ? grpcExampleDraftFingerprint(draft) : '',
    signature: grpcExampleSignature,
    populate: (e) => setDraft(grpcExampleToDraft(e)),
  });
  const isDirty = reprime.isDirty;

  const handleSave = useCallback(async () => {
    if (!draft || !example || !workspaceId || !isDirty) return;
    const result = await applyGrpcResponseExampleUpdate(
      exampleUid,
      { request: capturedGrpcRequestFromDraft(draft) },
      { workspaceId, surfaceId: 'workbench' },
    );
    if (!result.ok) {
      if (result.reason === 'not-found') message.error(t('workbench.editors.grpcExample.toast.deletedOtherTab'));
      else if ('message' in result && result.message)
        message.error(t('workbench.editors.grpcExample.toast.saveFailedDetail', { message: result.message }));
      else message.error(t('workbench.editors.grpcExample.toast.saveFailed'));
    }
  }, [draft, example, workspaceId, isDirty, exampleUid, message, t]);

  const handleSaveSync = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  const shell = useEditorShell({
    entityType: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
    entityId: example?.uid ?? null,
    isDirty,
    onSave: handleSaveSync,
    onDirtyChange,
    registerSaveRef,
  });

  const handleOpenInRequest = useCallback(() => {
    if (!draft || !example || !parentRequest) return;
    publishGrpcPrefill(parentRequest.uid, capturedGrpcRequestFromDraft(draft));
    onOpenGrpcRequest(parentRequest.uid, parentRequest.name);
  }, [draft, example, parentRequest, onOpenGrpcRequest]);

  if (!hydrated || (example && !draft)) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">
          <LoadingOutlined style={{ marginRight: 6 }} />
          {t('workbench.editors.grpcExample.loading')}
        </Text>
      </div>
    );
  }

  if (!example || !draft) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">{t('workbench.editors.grpcExample.notFound')}</Text>
      </div>
    );
  }

  const headerTitle = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
      <Tooltip title={draft.tls ? t('workbench.editors.grpc.tls.on') : t('workbench.editors.grpc.tls.off')}>
        <Button
          icon={
            draft.tls ? (
              <LockOutlined style={{ color: token.colorSuccess }} />
            ) : (
              <UnlockOutlined style={{ color: token.colorWarning }} />
            )
          }
          onClick={() => setDraft((d) => (d ? { ...d, tls: !d.tls } : d))}
          aria-label={draft.tls ? t('workbench.editors.grpc.tls.on') : t('workbench.editors.grpc.tls.off')}
        />
      </Tooltip>
      <Input
        style={{ flex: 1, minWidth: 0, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
        placeholder={t('workbench.editors.grpc.urlPlaceholder')}
        value={draft.url}
        onChange={(e) => setDraft((d) => (d ? { ...d, url: e.target.value } : d))}
        data-testid="grpc-example-url-input"
      />
      {/* The invoked rpc is the capture's fact — a static label, not a
        selector (re-picking a method belongs to the parent editor). */}
      <Text
        type={draft.method ? undefined : 'secondary'}
        style={{ flexShrink: 0, fontFamily: "'SF Mono', monospace", fontSize: 11 }}
        data-testid="grpc-example-method"
      >
        {draft.method
          ? `${draft.method.service.split('.').pop()} / ${draft.method.rpc}`
          : t('workbench.editors.grpcExample.noMethod')}
      </Text>
    </div>
  );

  const openDisabled = parentRequest === null;
  const headerActions = (
    <Tooltip
      title={
        openDisabled ? t('workbench.editors.grpc.notFound') : t('workbench.editors.grpcExample.openInRequestTooltip')
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
          data-testid="grpc-example-open-in-request"
        >
          {t('workbench.editors.grpcExample.openInRequest')}
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
                      { key: 'message', label: t('workbench.editors.grpc.tab.message') },
                      { key: 'metadata', label: t('workbench.editors.grpc.tab.metadata') },
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
                      <div style={{ flex: 1, minHeight: 100, position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
                          <CodeEditor
                            value={draft.message}
                            onChange={(msg) => setDraft((d) => (d ? { ...d, message: msg } : d))}
                            language="json"
                            fill
                            placeholder={t('workbench.editors.grpc.messagePlaceholder')}
                          />
                        </div>
                      </div>
                    )}
                    {activeTab === 'metadata' && (
                      <KeyValueTable
                        rows={draft.metadata}
                        onChange={(metadata) => setDraft((d) => (d ? { ...d, metadata } : d))}
                        keyPlaceholder={t('workbench.editors.grpc.metadata.keyPlaceholder')}
                        valuePlaceholder={t('workbench.editors.grpc.metadata.valuePlaceholder')}
                      />
                    )}
                  </div>
                </div>
              </div>
            </Allotment.Pane>
            <Allotment.Pane minSize={140}>
              <GrpcExampleResultPane
                response={example.response}
                registry={registry}
                method={draft.method}
                capturedAt={example.capturedAt}
              />
            </Allotment.Pane>
          </Allotment>
        </div>
      </div>
    </EntityScopeProvider>
  );
};

export default GrpcResponseExampleView;
