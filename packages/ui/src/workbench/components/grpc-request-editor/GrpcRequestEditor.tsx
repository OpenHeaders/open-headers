/**
 * GrpcRequestEditor — tab body for one GrpcRequest entity; the
 * ORCHESTRATOR over the editor's modules, one concern per file:
 *
 *   - `useGrpcSpecBinding` — protobuf specs, the ids-only specLink
 *     resolved live, method derivation + the manual refresh nonce.
 *   - `useGrpcInvokePlane` — Invoke/Stop on the `executeGrpcRequest`
 *     channel (node hosts + companion-forwarding surfaces), the live
 *     stream session, client/bidi upstream controls, Save Response.
 *   - `GrpcTargetRow` — TLS lock + authority + the method selector
 *     (also the spec entry point in every state).
 *   - `GrpcMessageTab` / `GrpcAuthTab` / `GrpcServiceDefinitionTab` /
 *     `GrpcSettingsTab` — the compose tabs (Docs and Metadata ride the
 *     shared DocsTab/KeyValueTable directly).
 *
 * This file keeps what genuinely spans them: the draft + derived-dirty
 * reprime + prefill hand-off, the .proto import picker both spec entry
 * points share, the ⌘/Ctrl+Enter chord plane, the editor shell/save,
 * the header (target row + Invoke/Stop morph + ⋯ posture toggle), the
 * compose/result Allotment split with the always-attached result pane.
 *
 * Compose and result stack in a vertical Allotment split (the HTTP
 * editor's discipline) — the sash bounds the fill message editor, and
 * the result pane is always attached (empty-state hint with the plain
 * Response title row before the first invoke). Unary results render in
 * `GrpcResponsePane`; streaming invokes render `GrpcStreamPane` — live
 * message timeline while in flight, the snapshot's direction-tagged
 * capture once settled.
 *
 * Dirty derives from form-vs-canonical equality via `useReprime`
 * (never setDirty); saves flow through the RequestsContext's
 * `updateGrpcRequest` (the gRPC write client under the hood).
 */

import { CaretRightOutlined, CheckOutlined } from '@ant-design/icons';
import { GRPC_REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { isMac } from '@openheaders/ui/shared/platform';
import { EntityScopeProvider } from '@openheaders/ui/shared/awareness';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { applySpecCreate } from '@openheaders/ui/shared/sync/spec-write-client';
import { Allotment } from 'allotment';
import { App, Button, ConfigProvider, type MenuProps, Tabs, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { subscribeGrpcPrefill } from './grpc-prefill-bus';
import { useSetting } from '../../settings/hooks';
import EditorHeader from '../shell/EditorHeader';
import { createImportedProtoSpecSeed } from '../specs/spec-scaffold';
import DocsTab from '../request-editor/DocsTab';
import KeyValueTable from '../request-editor/KeyValueTable';
import { findRequestAncestry, resolveInheritedAuthFor } from '../request-container/ancestry';
import GrpcAuthTab from './GrpcAuthTab';
import GrpcMessageTab from './GrpcMessageTab';
import GrpcResponseEmptyState from './GrpcResponseEmptyState';
import GrpcResponsePane from './GrpcResponsePane';
import GrpcServiceDefinitionTab from './GrpcServiceDefinitionTab';
import GrpcSettingsTab from './GrpcSettingsTab';
import GrpcStreamPane from './GrpcStreamPane';
import SessionLock from '../shared/SessionLock';
import SpecTabLabel from '../shared/SpecTabLabel';
import GrpcTargetRow from './GrpcTargetRow';
import { useGrpcInvokePlane } from './useGrpcInvokePlane';
import { useGrpcSpecBinding } from './useGrpcSpecBinding';
import {
  buildGrpcRequestUpdates,
  canonicalGrpcRequestProjection,
  draftFromGrpcRequest,
  type GrpcDraft,
  metadataToRows,
} from './draft';
import { findMethodOption, synthesizeExampleText } from './method-selector';

const { Text } = Typography;

interface GrpcRequestEditorProps {
  grpcRequestUid: string;
  workspaceId: string | null;
  /** Open a saved gRPC response example's viewer tab (after "Save Response"). */
  onOpenGrpcResponseExample?: (uid: string, name: string, grpcRequestUid: string) => void;
  /** Opens a container's Authorization section — the Auth tab's
   *  "Edit in …" opener under Inherit. */
  onOpenContainerAuth?: (kind: 'collection' | 'folder', uid: string, name: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

const emptyGrpcDraft = (): GrpcDraft => ({
  description: '',
  url: '',
  tls: true,
  method: undefined,
  message: '',
  metadata: [],
  auth: { type: 'none' },
  specLink: undefined,
  resolveToAddress: undefined,
  proxyMode: undefined,
  proxyUrl: undefined,
  proxyCredentialRef: undefined,
  authority: undefined,
  unixSocketPath: undefined,
  timeoutMs: undefined,
  keepaliveIntervalMs: undefined,
  keepaliveTimeoutMs: undefined,
  sslVerification: true,
  clientCertificateRef: undefined,
  tlsMinVersion: undefined,
  maxResponseBytes: undefined,
  tlsMaxVersion: undefined,
  tlsCipherSuites: undefined,
  sniServerName: undefined,
});

const INVOKE_SHORTCUT = isMac ? '⌘↵' : 'Ctrl+Enter';

const GrpcRequestEditor: React.FC<GrpcRequestEditorProps> = ({
  grpcRequestUid,
  workspaceId,
  onOpenGrpcResponseExample,
  onOpenContainerAuth,
  onDirtyChange,
  registerSaveRef,
}) => {
  const { token } = theme.useToken();
  const { message: toast } = App.useApp();
  const t = useT();
  const { collections, collectionTrees, folders, grpcRequests, updateGrpcRequest } = useRequests();

  const entity = useMemo(
    () => grpcRequests.find((r) => r.uid === grpcRequestUid) ?? null,
    [grpcRequests, grpcRequestUid],
  );

  const [draft, setDraft] = useState<GrpcDraft>(() => (entity ? draftFromGrpcRequest(entity) : emptyGrpcDraft()));

  // What Inherit resolves to, and from which level — read off the
  // trees (the containment projection), never a stored path. The
  // ancestry itself feeds the Auth tab's Inherited group.
  const ancestry = useMemo(
    () => (entity ? findRequestAncestry(collectionTrees, collections, folders, entity.uid) : undefined),
    [entity, collectionTrees, collections, folders],
  );
  const inheritedAuth = useMemo(
    () =>
      ancestry === undefined
        ? undefined
        : resolveInheritedAuthFor(ancestry, draft.auth.type === 'inherit' ? draft.auth : {}, draft.url),
    [ancestry, draft.auth, draft.url],
  );
  const [activeTab, setActiveTab] = useState('message');

  const formFingerprint = useMemo(() => stableStringify(buildGrpcRequestUpdates(draft)), [draft]);

  const reprime = useReprime({
    liveEntity: entity,
    scope: { entityType: GRPC_REQUEST_ENTITY_TYPE, entityId: entity?.uid ?? null },
    enabled: entity !== null,
    formFingerprint,
    signature: (e) => stableStringify(canonicalGrpcRequestProjection(e)),
    populate: (e) => setDraft(draftFromGrpcRequest(e)),
  });
  const isDirty = reprime.isDirty;

  // "Open in Request" hand-off from a saved example's viewer — the
  // captured request block lands as unsaved draft edits (auth and
  // specLink stay whatever the entity carries; the capture never held
  // them).
  useEffect(
    () =>
      subscribeGrpcPrefill(grpcRequestUid, (captured) => {
        setDraft((d) => ({
          ...d,
          url: captured.url,
          tls: captured.tls,
          sslVerification: captured.sslVerification,
          method: captured.method,
          metadata: metadataToRows(captured.metadata),
          message: captured.message,
          timeoutMs: captured.timeoutMs,
        }));
      }),
    [grpcRequestUid],
  );

  // ── Spec binding + method derivation ────────────────────────────
  const spec = useGrpcSpecBinding(draft.specLink, workspaceId);
  const selectedOption = findMethodOption(spec.derivation, draft.method);
  const exampleText = useMemo(
    () => synthesizeExampleText(spec.derivation, draft.method),
    [spec.derivation, draft.method],
  );

  // The .proto import picker BOTH spec entry points share (the method
  // selector and the Service definition tab).
  const protoFileInputRef = useRef<HTMLInputElement>(null);
  const handleImportProto = useCallback(() => protoFileInputRef.current?.click(), []);
  const handleProtoFilePicked = useCallback(
    async (file: File) => {
      if (!workspaceId) return;
      const text = await file.text().catch((err: Error) => err);
      if (text instanceof Error) {
        toast.error(t('workbench.editors.grpc.spec.importReadFailed', { message: text.message }));
        return;
      }
      const name = file.name.replace(/\.proto$/i, '') || file.name;
      const result = await applySpecCreate(
        { spec: createImportedProtoSpecSeed(name, file.name, text) },
        { workspaceId, surfaceId: 'workbench' },
      );
      if (!result.ok) {
        toast.error(t('workbench.editors.grpc.spec.importFailed'));
        return;
      }
      setDraft((d) => ({ ...d, specLink: { specUid: result.spec.uid } }));
    },
    [workspaceId, toast, t],
  );

  const handleUseExample = useCallback(() => {
    if (exampleText === null) return;
    setDraft((d) => ({ ...d, message: exampleText }));
    setActiveTab('message');
  }, [exampleText]);

  // ── Invoke plane ─────────────────────────────────────────────────
  // Opt-in posture: a message that isn't valid JSON invokes anyway as
  // an EMPTY message and the server answers. Default off — the
  // executor rejects before the wire with the exact parse error.
  const [sendInvalidMessage, setSendInvalidMessage] = useSetting('requests.grpcSendInvalidMessage');
  const invoke = useGrpcInvokePlane({
    entity,
    draft,
    workspaceId,
    selectedOption,
    sendInvalidMessage,
    onOpenGrpcResponseExample,
  });

  // ⌘/Ctrl+Enter invokes from anywhere in the editor — same gate as
  // the Invoke button, and the same MORPH: while a call is in flight
  // the chord cancels it instead. The Shift variants ride the open
  // stream only: ⌘/Ctrl+Shift+Enter sends the compose text upstream,
  // ⌘/Ctrl+Shift+E half-closes — dead keys outside a live client/bidi
  // stream. Capture phase so the chords win even when focus sits
  // inside the Monaco message editor, which would otherwise claim
  // ⌘+Enter for insert-line-below.
  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.shiftKey && (e.key === 'Enter' || e.key.toLowerCase() === 'e')) {
        if (!invoke.clientStreamActive) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Enter') {
          void invoke.handleSendStreamMessage();
        } else {
          invoke.handleEndStreaming();
        }
        return;
      }
      if (e.key !== 'Enter' || e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (invoke.invoking) {
        invoke.handleCancelInvoke();
        return;
      }
      if (invoke.invokeDisabledReason !== null) return;
      void invoke.handleInvoke();
    },
    [invoke],
  );

  // ── Save ─────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!entity || !isDirty) return;
    const result = await updateGrpcRequest(entity.uid, buildGrpcRequestUpdates(draft));
    if (result.ok) return;
    if (result.reason === 'not-found') {
      toast.error(t('workbench.editors.grpc.toast.deletedOtherTab'));
    } else {
      toast.error(
        result.message
          ? t('workbench.editors.grpc.toast.updateFailedDetail', { message: result.message })
          : t('workbench.editors.grpc.toast.updateFailed'),
      );
    }
  }, [entity, isDirty, draft, updateGrpcRequest, toast, t]);

  const handleSaveSync = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  const shell = useEditorShell({
    entityType: GRPC_REQUEST_ENTITY_TYPE,
    entityId: entity?.uid ?? null,
    isDirty,
    onSave: handleSaveSync,
    onDirtyChange,
    registerSaveRef,
  });

  if (!entity) {
    return (
      <div style={{ padding: 24, background: token.colorBgContainer }}>
        <Text type="secondary">{t('workbench.editors.grpc.notFound')}</Text>
      </div>
    );
  }

  // Header consolidates the full target row (the HTTP editor's
  // discipline): TLS lock + authority + method selector in the title
  // slot (the input grows), Invoke in the actions slot next to the
  // standardized Save. No separate target row below — the tab pill
  // already carries the request's identity.
  // The target row and the Invoke-time tabs freeze while an invoke is
  // running — their values were snapshotted at Invoke.
  const headerTitle = (
    <SessionLock locked={invoke.invoking}>
      <GrpcTargetRow
        draft={draft}
        setDraft={setDraft}
        spec={spec}
        workspaceId={workspaceId}
        onImportProto={handleImportProto}
      />
    </SessionLock>
  );

  // Editor-specific ⋯ items — the send-invalid-message posture toggles
  // right where Invoke lives (it's the same app-wide setting the
  // Settings tab row and Settings → Requests write).
  const overflowItems: MenuProps['items'] = [
    {
      key: 'grpc-send-invalid-message',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', flex: 1 }}>
          <span style={{ flex: 1 }}>{t('workbench.settings.def.requests.grpcSendInvalidMessage.label')}</span>
          {sendInvalidMessage && (
            <CheckOutlined style={{ fontSize: 10, color: token.colorPrimary, marginLeft: 12 }} />
          )}
        </span>
      ),
      onClick: () => setSendInvalidMessage(!sendInvalidMessage),
    },
  ];

  const headerActions = invoke.invoking ? (
    <Tooltip
      placement="bottom"
      title={<ShortcutHintTitle label={INVOKE_SHORTCUT}>{t('workbench.editors.grpc.invoke.stop')}</ShortcutHintTitle>}
    >
      {/* Invoke morphs into Cancel — the HTTP Send/Stop treatment
        verbatim: solid on the darkened error token with the square
        stop glyph. */}
      <ConfigProvider theme={{ token: { colorError: token.colorErrorActive } }}>
        <Button
          size="small"
          type="primary"
          danger
          icon={
            <span
              aria-hidden="true"
              style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: 'currentcolor' }}
            />
          }
          onClick={invoke.handleCancelInvoke}
          style={{ fontSize: 11 }}
          data-testid="grpc-invoke-button"
        >
          {t('workbench.editors.grpc.invoke.stop')}
        </Button>
      </ConfigProvider>
    </Tooltip>
  ) : (
    <Tooltip
      placement="bottom"
      title={
        invoke.invokeDisabledReason ?? (
          <ShortcutHintTitle label={INVOKE_SHORTCUT}>{t('workbench.editors.grpc.invoke.label')}</ShortcutHintTitle>
        )
      }
    >
      <span style={{ display: 'inline-flex' }}>
        <Button
          size="small"
          type="primary"
          icon={<CaretRightOutlined />}
          disabled={invoke.invokeDisabledReason !== null}
          onClick={() => void invoke.handleInvoke()}
          style={{ fontSize: 11 }}
          data-testid="grpc-invoke-button"
        >
          {t('workbench.editors.grpc.invoke.label')}
        </Button>
      </span>
    </Tooltip>
  );

  return (
    <EntityScopeProvider shell={shell.scopeProps}>
      {/* tabIndex -1: clicks on non-focusable space inside the editor
        keep focus within so the ⌘/Ctrl+Enter chord always reaches the
        capture handler. */}
      <div
        tabIndex={-1}
        onKeyDownCapture={handleEditorKeyDown}
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: token.colorBgContainer,
          height: '100%',
          outline: 'none',
        }}
      >
        <EditorHeader
          title={headerTitle}
          actions={headerActions}
          overflowItems={overflowItems}
          shell={shell.headerProps}
        />
        <input
          ref={protoFileInputRef}
          type="file"
          accept=".proto"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (file) void handleProtoFilePicked(file);
          }}
          data-testid="grpc-import-proto-input"
        />

        {/* Compose / response split — the HTTP editor's stacked
          Allotment discipline: the sash bounds the message editor so it
          can never overflow the response region. The response pane is
          always attached (empty-state hint before the first invoke).
          The tab bar renders OUTSIDE the scroll container (bar-only
          items; content switches below) so it never participates in
          scrolling. */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <Allotment vertical proportionalLayout separator>
            <Allotment.Pane minSize={220} preferredSize="55%">
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
                <div style={{ padding: '0 12px' }}>
                  <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    size="small"
                    tabBarStyle={{ marginBottom: 0 }}
                    items={[
                      { key: 'docs', label: t('workbench.editors.grpc.tab.docs') },
                      { key: 'message', label: t('workbench.editors.grpc.tab.message') },
                      { key: 'metadata', label: t('workbench.editors.grpc.tab.metadata') },
                      { key: 'auth', label: t('workbench.editors.grpc.tab.auth') },
                      { key: 'settings', label: t('workbench.editors.grpc.tab.settings') },
                      { key: 'spec', label: <SpecTabLabel /> },
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
                    {activeTab === 'docs' && (
                      <DocsTab
                        value={draft.description}
                        onChange={(description) => setDraft((d) => ({ ...d, description }))}
                      />
                    )}
                    {activeTab === 'message' && (
                      <GrpcMessageTab
                        message={draft.message}
                        onMessageChange={(message) => setDraft((d) => ({ ...d, message }))}
                        exampleText={exampleText}
                        onUseExample={handleUseExample}
                        clientStreamShape={invoke.clientStreamShape}
                        clientStreamActive={invoke.clientStreamActive}
                        onSendStreamMessage={() => void invoke.handleSendStreamMessage()}
                        onEndStreaming={invoke.handleEndStreaming}
                      />
                    )}
                    <SessionLock locked={invoke.invoking}>
                    {activeTab === 'metadata' && (
                      <KeyValueTable
                        rows={draft.metadata}
                        onChange={(metadata) => setDraft((d) => ({ ...d, metadata }))}
                        keyPlaceholder={t('workbench.editors.grpc.metadata.keyPlaceholder')}
                        valuePlaceholder={t('workbench.editors.grpc.metadata.valuePlaceholder')}
                      />
                    )}
                    {activeTab === 'auth' && (
                      <GrpcAuthTab
                        auth={draft.auth}
                        inheritedFrom={inheritedAuth}
                        ancestry={ancestry}
                        url={draft.url}
                        onOpenContainerAuth={onOpenContainerAuth}
                        onChange={(auth) => setDraft((d) => ({ ...d, auth }))}
                      />
                    )}
                    {activeTab === 'spec' && (
                      <GrpcServiceDefinitionTab
                        spec={spec}
                        workspaceId={workspaceId}
                        onLinkSpec={(specUid) => setDraft((d) => ({ ...d, specLink: { specUid } }))}
                        onImportProto={handleImportProto}
                      />
                    )}
                    {activeTab === 'settings' && (
                      <GrpcSettingsTab
                        draft={draft}
                        setDraft={setDraft}
                        sendInvalidMessage={sendInvalidMessage}
                        onSendInvalidMessageChange={setSendInvalidMessage}
                      />
                    )}
                    </SessionLock>
                  </div>
                </div>
              </div>
            </Allotment.Pane>
            <Allotment.Pane minSize={120}>
              {invoke.responseShape === 'stream' && (invoke.response !== null || invoke.live !== null) ? (
                <GrpcStreamPane
                  live={invoke.live}
                  snapshot={invoke.response}
                  session={invoke.streamSession}
                  registry={spec.derivation?.registry ?? null}
                  method={draft.method}
                  onClear={invoke.handleClearResponse}
                  onSaveResponse={invoke.canSaveResponse ? () => void invoke.handleSaveResponse() : undefined}
                  onReinvoke={() => void invoke.handleInvoke()}
                />
              ) : invoke.response !== null ? (
                <GrpcResponsePane
                  snapshot={invoke.response}
                  registry={spec.derivation?.registry ?? null}
                  method={draft.method}
                  onClear={invoke.handleClearResponse}
                  onSaveResponse={invoke.canSaveResponse ? () => void invoke.handleSaveResponse() : undefined}
                  onReinvoke={() => void invoke.handleInvoke()}
                />
              ) : (
                // Always-attached result pane (the HTTP ResponsePanel
                // posture): a stable target with the plain title row and
                // an invoke hint before the first result.
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    background: token.colorBgContainer,
                  }}
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
                  <GrpcResponseEmptyState invoking={invoke.invoking} />
                </div>
              )}
            </Allotment.Pane>
          </Allotment>
        </div>

      </div>
    </EntityScopeProvider>
  );
};

export default GrpcRequestEditor;
