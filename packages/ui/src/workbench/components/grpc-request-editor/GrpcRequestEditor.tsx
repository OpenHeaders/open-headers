/**
 * GrpcRequestEditor — tab body for one GrpcRequest entity.
 *
 * Editor shell: host URL + TLS lock, method selector grouped by
 * service with call-shape glyphs (derived live from the linked
 * Protobuf spec via `deriveGrpcMethods` — ids-only specLink, nothing
 * cached), Message / Metadata / Service definition / Settings tabs,
 * and "Use Example Message" wiring `synthesizeExampleMessage` into the
 * Message tab. Invoke fires the CURRENT compose state (saved or not)
 * through the `executeGrpcRequest` channel — answered in-process on
 * node hosts and forwarded to a connected companion on extension
 * surfaces (the `grpcCompanionInvoke` capability + live connection
 * state gate the button; disconnected keeps an honest "connect the
 * desktop app" tooltip while compose/spec/examples stay usable) —
 * every call shape. In flight it
 * morphs to Cancel (`abortRequestSend` on the shared active-send
 * registry). Unary results render in `GrpcResponsePane`; streaming
 * invokes render `GrpcStreamPane` — live message timeline fed from
 * `useLiveGrpcStream` while in flight, the snapshot's direction-tagged
 * capture once settled — and client/bidi streams grow Send message +
 * End streaming controls on the Message tab, riding the
 * `sendGrpcStreamMessage` / `endGrpcClientStream` channels keyed by
 * the in-flight sendId. All editor-local, below the compose tabs.
 *
 * Dirty derives from form-vs-canonical equality via `useReprime`
 * (never setDirty); saves flow through the RequestsContext's
 * `updateGrpcRequest` (the gRPC write client under the hood).
 */

import {
  LockOutlined,
  ReloadOutlined,
  SendOutlined,
  StopOutlined,
  ThunderboltOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { hostBridge } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import { GRPC_REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import type { ExecutedGrpcSnapshot, GrpcMethodRef, GrpcRequest as GrpcRequestEntity } from '@openheaders/core/types';
import { MAX_REQUEST_TIMEOUT_MS, MIN_REQUEST_TIMEOUT_MS } from '@openheaders/core/schemas';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityScopeProvider, PresenceBadge, useLocalInstanceId } from '@openheaders/ui/shared/awareness';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { useSpecs } from '@openheaders/ui/shared/hooks/readers/useSpecs';
import { App, Button, Input, InputNumber, Select, Switch, Tabs, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import CodeEditor from '../shared/CodeEditor';
import { grpcTag } from '../sidebar/icons';
import EditorHeader from '../shell/EditorHeader';
import KeyValueTable from '../request-editor/KeyValueTable';
import GrpcResponsePane from './GrpcResponsePane';
import GrpcStreamPane from './GrpcStreamPane';
import { type GrpcStreamSession, useLiveGrpcStream } from './useLiveGrpcStream';
import {
  buildGrpcRequestUpdates,
  canonicalGrpcRequestProjection,
  draftFromGrpcRequest,
  type GrpcDraft,
} from './draft';
import {
  deriveGrpcMethods,
  findMethodOption,
  GRPC_STREAMING_GLYPHS,
  synthesizeExampleText,
} from './method-selector';

const { Text } = Typography;

interface GrpcRequestEditorProps {
  grpcRequestUid: string;
  workspaceId: string | null;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

const emptyGrpcDraft = (): GrpcDraft => ({
  url: '',
  tls: true,
  method: undefined,
  message: '',
  metadata: [],
  auth: { type: 'none' },
  specLink: undefined,
  timeoutMs: undefined,
  sslVerification: true,
});

const methodKey = (m: GrpcMethodRef): string => `${m.service}/${m.rpc}`;

const GrpcRequestEditor: React.FC<GrpcRequestEditorProps> = ({
  grpcRequestUid,
  workspaceId,
  onDirtyChange,
  registerSaveRef,
}) => {
  const { token } = theme.useToken();
  const { message: toast } = App.useApp();
  const t = useT();
  const localInstanceId = useLocalInstanceId();
  const { grpcRequests, updateGrpcRequest, executeGrpc } = useRequests();
  const specs = useSpecs(workspaceId);

  const entity = useMemo(
    () => grpcRequests.find((r) => r.uid === grpcRequestUid) ?? null,
    [grpcRequests, grpcRequestUid],
  );

  const [draft, setDraft] = useState<GrpcDraft>(() => (entity ? draftFromGrpcRequest(entity) : emptyGrpcDraft()));
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

  // ── Spec binding + method derivation ────────────────────────────
  const protobufSpecs = useMemo(() => specs.filter((s) => s.format === 'protobuf'), [specs]);
  const linkedSpec = useMemo(
    () => (draft.specLink ? (protobufSpecs.find((s) => s.uid === draft.specLink?.specUid) ?? null) : null),
    [protobufSpecs, draft.specLink],
  );
  // Manual refresh nonce — derivation already tracks the live spec
  // object, so this only forces a recompute for peace of mind.
  const [derivationNonce, setDerivationNonce] = useState(0);
  const derivation = useMemo(() => {
    void derivationNonce;
    return linkedSpec ? deriveGrpcMethods(linkedSpec) : null;
  }, [linkedSpec, derivationNonce]);

  const selectedOption = findMethodOption(derivation, draft.method);
  const exampleText = useMemo(() => synthesizeExampleText(derivation, draft.method), [derivation, draft.method]);

  const methodOptions = useMemo(() => {
    const groups = (derivation?.groups ?? []).map((group) => ({
      label: group.service,
      options: group.options.map((option) => ({
        value: `${option.service}/${option.rpc}`,
        label: `${GRPC_STREAMING_GLYPHS[option.streaming]} ${option.rpc}`,
      })),
    }));
    // A persisted method the spec no longer declares stays visible as
    // an unresolved entry instead of silently blanking the select.
    if (draft.method && !selectedOption) {
      groups.push({
        label: t('workbench.editors.grpc.method.unresolvedGroup'),
        options: [
          {
            value: methodKey(draft.method),
            label: t('workbench.editors.grpc.method.unresolvedOption', { rpc: draft.method.rpc }),
          },
        ],
      });
    }
    return groups;
  }, [derivation, draft.method, selectedOption, t]);

  const handleMethodChange = useCallback((value: string) => {
    const slash = value.lastIndexOf('/');
    if (slash <= 0) return;
    const method: GrpcMethodRef = { service: value.substring(0, slash), rpc: value.substring(slash + 1) };
    setDraft((d) => ({ ...d, method }));
  }, []);

  const handleUseExample = useCallback(() => {
    if (exampleText === null) return;
    setDraft((d) => ({ ...d, message: exampleText }));
    setActiveTab('message');
  }, [exampleText]);

  // ── Invoke (node hosts + companion-forwarding hosts) ─────────────
  const requestRuntimeKind = getCapability('requestRuntime')?.() ?? 'browser';
  // Extension surfaces forward invokes to a connected companion (the
  // desktop app) — the seam is static; whether a companion is actually
  // connected is live state, so the gate reads both.
  const companionSeam = requestRuntimeKind !== 'node' && (getCapability('grpcCompanionInvoke')?.() ?? false);
  const { isConnected } = useRules();
  const [invoking, setInvoking] = useState(false);
  const [response, setResponse] = useState<ExecutedGrpcSnapshot | null>(null);
  // Which pane renders the result — stamped at invoke time from the
  // method's shape, so a method re-pick mid-flight can't flip it.
  const [responseShape, setResponseShape] = useState<'unary' | 'stream'>('unary');
  const [streamSession, setStreamSession] = useState<GrpcStreamSession | null>(null);
  // The in-flight call's target — the timeline's lifecycle rows keep
  // naming what was actually invoked.
  const [invokedTarget, setInvokedTarget] = useState('');
  const activeSendIdRef = useRef<string | null>(null);
  const liveStream = useLiveGrpcStream();

  const handleInvoke = useCallback(async () => {
    if (!entity || invoking) return;
    // The CURRENT compose state invokes — saved or not (the HTTP
    // editor's draft-send law); identity fields ride along verbatim.
    const draftEntity: GrpcRequestEntity = {
      schemaVersion: 5,
      uid: entity.uid,
      path: entity.path,
      name: entity.name,
      description: entity.description,
      ...buildGrpcRequestUpdates(draft),
    };
    const streaming = selectedOption !== null && selectedOption.streaming !== 'unary';
    const sendId = crypto.randomUUID();
    activeSendIdRef.current = sendId;
    setInvoking(true);
    setResponse(null);
    setStreamSession(null);
    setResponseShape(streaming ? 'stream' : 'unary');
    if (streaming && draft.method) {
      setInvokedTarget(`/${draft.method.service}/${draft.method.rpc}`);
      liveStream.beginStream(sendId);
    }
    const snapshot = await executeGrpc({ draft: draftEntity, sendId });
    if (streaming) {
      const session = liveStream.takeSession();
      setStreamSession(session === null ? null : { ...session, endedAt: Date.now() });
      liveStream.endStream();
    }
    activeSendIdRef.current = null;
    setInvoking(false);
    if (snapshot === null) {
      toast.error(t('workbench.editors.grpc.invoke.failed'));
      return;
    }
    setResponse(snapshot);
  }, [entity, invoking, draft, selectedOption, executeGrpc, liveStream, toast, t]);

  // Cancel morphs from Invoke while in flight — the host aborts the
  // exchange and the pending RPC above resolves with what arrived.
  const handleCancelInvoke = useCallback(() => {
    const sendId = activeSendIdRef.current;
    if (!sendId) return;
    hostBridge.call('abortRequestSend', { sendId }).catch(() => {});
  }, []);

  const invokeDisabledReason =
    requestRuntimeKind !== 'node' && !companionSeam
      ? t('workbench.editors.grpc.invoke.browserHost')
      : companionSeam && !isConnected
        ? t('workbench.editors.grpc.invoke.connectCompanion')
        : !selectedOption
          ? t('workbench.editors.grpc.invoke.needsMethod')
          : draft.url.trim() === ''
            ? t('workbench.editors.grpc.invoke.needsUrl')
            : null;

  // ── In-flight upstream controls (client/bidi streams) ────────────
  const clientStreamActive =
    invoking &&
    responseShape === 'stream' &&
    selectedOption !== null &&
    (selectedOption.streaming === 'client-streaming' || selectedOption.streaming === 'bidi-streaming');

  // Send the CURRENT compose text as one upstream message — the
  // executor encodes it against the rpc's request type, and an encode
  // mismatch reports here without touching the open stream.
  const handleSendStreamMessage = useCallback(async () => {
    const sendId = activeSendIdRef.current;
    if (!sendId) return;
    const result = await hostBridge
      .call('sendGrpcStreamMessage', { sendId, messageText: draft.message })
      .catch(() => null);
    if (result === null || !result.success) {
      toast.error(result?.error ?? t('workbench.editors.grpc.stream.sendFailed'));
    }
  }, [draft.message, toast, t]);

  const handleEndStreaming = useCallback(() => {
    const sendId = activeSendIdRef.current;
    if (!sendId) return;
    hostBridge.call('endGrpcClientStream', { sendId }).catch(() => {});
  }, []);

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

  const issueCount = (derivation?.issues.length ?? 0) + (derivation?.parseFailures.length ?? 0);

  const headerTitle = (
    <>
      {grpcTag()}
      <Text strong style={{ fontSize: 13 }}>
        {entity.name}
      </Text>
      <PresenceBadge
        entityType={GRPC_REQUEST_ENTITY_TYPE}
        entityId={entity.uid}
        excludeInstanceId={localInstanceId}
        style={{ marginLeft: 6 }}
      />
    </>
  );

  const specFooter = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 12px',
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        fontSize: 11,
        color: token.colorTextTertiary,
      }}
    >
      <Text type="secondary" style={{ fontSize: 11 }}>
        {linkedSpec
          ? t('workbench.editors.grpc.specFooter.using', { name: linkedSpec.name })
          : t('workbench.editors.grpc.specFooter.none')}
      </Text>
      {linkedSpec && issueCount > 0 && (
        <Text type="warning" style={{ fontSize: 11 }}>
          {t('workbench.editors.grpc.specFooter.issues', { count: issueCount })}
        </Text>
      )}
      {linkedSpec && (
        <Tooltip title={t('workbench.editors.grpc.specFooter.refresh')}>
          <Button
            size="small"
            type="text"
            icon={<ReloadOutlined style={{ fontSize: 11 }} />}
            onClick={() => setDerivationNonce((n) => n + 1)}
          />
        </Tooltip>
      )}
    </div>
  );

  return (
    <EntityScopeProvider shell={shell.scopeProps}>
      <div style={{ display: 'flex', flexDirection: 'column', background: token.colorBgContainer, height: '100%' }}>
        <EditorHeader title={headerTitle} shell={shell.headerProps} />

        {/* Target row: TLS lock + authority + method + Invoke. */}
        <div style={{ display: 'flex', gap: 8, padding: '10px 12px 6px' }}>
          <Tooltip title={draft.tls ? t('workbench.editors.grpc.tls.on') : t('workbench.editors.grpc.tls.off')}>
            <Button
              icon={
                draft.tls ? (
                  <LockOutlined style={{ color: token.colorSuccess }} />
                ) : (
                  <UnlockOutlined style={{ color: token.colorWarning }} />
                )
              }
              onClick={() => setDraft((d) => ({ ...d, tls: !d.tls }))}
              aria-label={draft.tls ? t('workbench.editors.grpc.tls.on') : t('workbench.editors.grpc.tls.off')}
            />
          </Tooltip>
          <Input
            style={{ flex: 1, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
            placeholder={t('workbench.editors.grpc.urlPlaceholder')}
            value={draft.url}
            onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
            data-testid="grpc-url-input"
          />
          <Select
            style={{ width: 280 }}
            placeholder={
              linkedSpec
                ? t('workbench.editors.grpc.method.placeholder')
                : t('workbench.editors.grpc.method.noSpecPlaceholder')
            }
            value={draft.method ? methodKey(draft.method) : undefined}
            options={methodOptions}
            onChange={handleMethodChange}
            disabled={!linkedSpec && !draft.method}
            showSearch
            data-testid="grpc-method-select"
          />
          {invoking ? (
            <Button danger icon={<StopOutlined />} onClick={handleCancelInvoke} data-testid="grpc-invoke-button">
              {t('workbench.editors.grpc.invoke.cancel')}
            </Button>
          ) : (
            <Tooltip title={invokeDisabledReason ?? undefined}>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                disabled={invokeDisabledReason !== null}
                onClick={() => void handleInvoke()}
                data-testid="grpc-invoke-button"
              >
                {t('workbench.editors.grpc.invoke.label')}
              </Button>
            </Tooltip>
          )}
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="small"
          style={{ flex: 1, minHeight: 0, padding: '0 12px' }}
          items={[
            {
              key: 'message',
              label: t('workbench.editors.grpc.tab.message'),
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    {clientStreamActive && (
                      <>
                        <Button
                          size="small"
                          type="primary"
                          icon={<SendOutlined />}
                          onClick={() => void handleSendStreamMessage()}
                          data-testid="grpc-stream-send"
                        >
                          {t('workbench.editors.grpc.stream.sendMessage')}
                        </Button>
                        <Button size="small" onClick={handleEndStreaming} data-testid="grpc-stream-end">
                          {t('workbench.editors.grpc.stream.endStreaming')}
                        </Button>
                      </>
                    )}
                    <Tooltip title={exampleText === null ? t('workbench.editors.grpc.example.needsMethod') : undefined}>
                      <Button
                        size="small"
                        icon={<SendOutlined />}
                        disabled={exampleText === null}
                        onClick={handleUseExample}
                        data-testid="grpc-use-example"
                      >
                        {t('workbench.editors.grpc.example.label')}
                      </Button>
                    </Tooltip>
                  </div>
                  <CodeEditor
                    value={draft.message}
                    onChange={(message) => setDraft((d) => ({ ...d, message }))}
                    language="json"
                    minHeight={260}
                    placeholder={t('workbench.editors.grpc.messagePlaceholder')}
                  />
                </div>
              ),
            },
            {
              key: 'metadata',
              label: t('workbench.editors.grpc.tab.metadata'),
              children: (
                <KeyValueTable
                  rows={draft.metadata}
                  onChange={(metadata) => setDraft((d) => ({ ...d, metadata }))}
                  keyPlaceholder={t('workbench.editors.grpc.metadata.keyPlaceholder')}
                  valuePlaceholder={t('workbench.editors.grpc.metadata.valuePlaceholder')}
                />
              ),
            },
            {
              key: 'auth',
              label: t('workbench.editors.grpc.tab.auth'),
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
                  <div>
                    <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
                      {t('workbench.editors.grpc.auth.typeLabel')}
                    </Text>
                    <Select
                      style={{ width: 220 }}
                      value={draft.auth.type}
                      options={[
                        { value: 'none', label: t('workbench.editors.grpc.auth.typeNone') },
                        { value: 'bearer', label: t('workbench.editors.grpc.auth.typeBearer') },
                      ]}
                      onChange={(type: 'none' | 'bearer') =>
                        setDraft((d) => ({
                          ...d,
                          auth:
                            type === 'bearer'
                              ? { type: 'bearer', token: d.auth.type === 'bearer' ? d.auth.token : '' }
                              : { type: 'none' },
                        }))
                      }
                      data-testid="grpc-auth-type"
                    />
                  </div>
                  {draft.auth.type === 'bearer' && (
                    <div>
                      <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
                        {t('workbench.editors.grpc.auth.tokenLabel')}
                      </Text>
                      <Input
                        style={{ fontFamily: "'SF Mono', monospace", fontSize: 12 }}
                        placeholder={t('workbench.editors.grpc.auth.tokenPlaceholder')}
                        value={draft.auth.token}
                        onChange={(e) => setDraft((d) => ({ ...d, auth: { type: 'bearer', token: e.target.value } }))}
                        data-testid="grpc-auth-token"
                      />
                      <Text type="secondary" style={{ display: 'block', fontSize: 11, marginTop: 6 }}>
                        {t('workbench.editors.grpc.auth.help')}
                      </Text>
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'service',
              label: t('workbench.editors.grpc.tab.serviceDefinition'),
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
                  <div>
                    <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
                      {t('workbench.editors.grpc.spec.selectLabel')}
                    </Text>
                    <Select
                      style={{ width: '100%' }}
                      placeholder={t('workbench.editors.grpc.spec.selectPlaceholder')}
                      value={linkedSpec?.uid}
                      options={protobufSpecs.map((s) => ({ value: s.uid, label: s.name }))}
                      onChange={(specUid: string) => setDraft((d) => ({ ...d, specLink: { specUid } }))}
                      data-testid="grpc-spec-select"
                    />
                  </div>
                  {derivation && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {t('workbench.editors.grpc.spec.summary', {
                        services: derivation.groups.length,
                        methods: derivation.groups.reduce((n, g) => n + g.options.length, 0),
                      })}
                    </Text>
                  )}
                  {derivation?.parseFailures.map((failure) => (
                    <Text key={failure.path} type="warning" style={{ fontSize: 11 }}>
                      {t('workbench.editors.grpc.spec.parseFailure', { path: failure.path, message: failure.message })}
                    </Text>
                  ))}
                  {derivation?.issues.map((issue) => (
                    <Text key={`${issue.kind}:${issue.scope}:${issue.reference}`} type="warning" style={{ fontSize: 11 }}>
                      {t('workbench.editors.grpc.spec.issue', { kind: issue.kind, reference: issue.reference })}
                    </Text>
                  ))}
                </div>
              ),
            },
            {
              key: 'settings',
              label: t('workbench.editors.grpc.tab.settings'),
              children: (
                <div style={{ maxWidth: 560 }}>
                  <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
                    {t('workbench.editors.grpc.settings.timeoutLabel')}
                  </Text>
                  <InputNumber
                    min={MIN_REQUEST_TIMEOUT_MS}
                    max={MAX_REQUEST_TIMEOUT_MS}
                    step={1000}
                    value={draft.timeoutMs}
                    onChange={(value) => setDraft((d) => ({ ...d, timeoutMs: value ?? undefined }))}
                    placeholder={t('workbench.editors.grpc.settings.timeoutPlaceholder')}
                    style={{ width: 220 }}
                  />
                  <Text type="secondary" style={{ display: 'block', fontSize: 11, marginTop: 6 }}>
                    {t('workbench.editors.grpc.settings.timeoutHelp')}
                  </Text>
                  <div style={{ marginTop: 16 }}>
                    <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
                      {t('workbench.editors.grpc.settings.sslVerifyLabel')}
                    </Text>
                    <Switch
                      checked={draft.sslVerification}
                      onChange={(sslVerification) => setDraft((d) => ({ ...d, sslVerification }))}
                      data-testid="grpc-ssl-verify"
                    />
                    <Text type="secondary" style={{ display: 'block', fontSize: 11, marginTop: 6 }}>
                      {t('workbench.editors.grpc.settings.sslVerifyHelp')}
                    </Text>
                  </div>
                </div>
              ),
            },
          ]}
        />

        {(response !== null || liveStream.live !== null) && (
          <div style={{ maxHeight: '45%', overflow: 'auto', flexShrink: 0 }}>
            {responseShape === 'stream' ? (
              <GrpcStreamPane
                live={liveStream.live}
                snapshot={response}
                session={streamSession}
                registry={derivation?.registry ?? null}
                method={draft.method}
                target={invokedTarget}
              />
            ) : (
              response !== null && (
                <GrpcResponsePane snapshot={response} registry={derivation?.registry ?? null} method={draft.method} />
              )
            )}
          </div>
        )}

        {specFooter}
      </div>
    </EntityScopeProvider>
  );
};

export default GrpcRequestEditor;
