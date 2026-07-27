/**
 * GrpcRequestEditor — tab body for one GrpcRequest entity.
 *
 * Editor shell: host URL + TLS lock, method selector grouped by
 * service with call-shape glyphs (derived live from the linked
 * Protobuf spec via `deriveGrpcMethods` — ids-only specLink, nothing
 * cached; the same selector is also the spec entry point in EVERY
 * state, offering workspace protobuf specs to link inline and an
 * import-a-.proto action that mints a spec and links it — linked, the
 * other specs read as a switch; the Service definition tab's spec
 * select carries the same import action),
 * Message / Metadata / Service definition / Settings tabs,
 * and "Use Example Message" wiring `synthesizeExampleMessage` into the
 * Message tab. Invoke fires the CURRENT compose state (saved or not)
 * through the `executeGrpcRequest` channel — answered in-process on
 * node hosts and forwarded to a connected companion on extension
 * surfaces (the `grpcCompanionInvoke` capability + live connection
 * state gate the button; disconnected keeps an honest "connect the
 * desktop app" tooltip while compose/spec/examples stay usable) —
 * every call shape. In flight it
 * morphs to Stop (`abortRequestSend` on the shared active-send
 * registry). Compose and result stack in a vertical Allotment split
 * (the HTTP editor's discipline) — the sash bounds the fill message
 * editor, and the result pane is always attached (empty-state hint
 * with the plain Response title row before the first invoke).
 * Unary results render in `GrpcResponsePane`; streaming
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
  CaretRightOutlined,
  CheckOutlined,
  LockOutlined,
  ReloadOutlined,
  SendOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { hostBridge } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import { GRPC_REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import type { ProtoStreamingShape } from '@openheaders/core/proto';
import type { ExecutedGrpcSnapshot, GrpcMethodRef, GrpcRequest as GrpcRequestEntity } from '@openheaders/core/types';
import { MAX_REQUEST_TIMEOUT_MS, MIN_REQUEST_TIMEOUT_MS } from '@openheaders/core/schemas';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { isMac } from '@openheaders/ui/shared/platform';
import { EntityScopeProvider } from '@openheaders/ui/shared/awareness';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { useSpecs } from '@openheaders/ui/shared/hooks/readers/useSpecs';
import { applySpecCreate } from '@openheaders/ui/shared/sync/spec-write-client';
import { Allotment } from 'allotment';
import {
  App,
  Button,
  ConfigProvider,
  Input,
  InputNumber,
  type MenuProps,
  Select,
  type SelectProps,
  Switch,
  Tabs,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyGrpcResponseExampleCreate,
  nextGrpcExampleName,
} from '@openheaders/ui/shared/sync/grpc-response-example-write-client';
import { getGrpcResponseExampleSyncMirrorForWorkspace } from '@openheaders/ui/context/mirrors/grpc-response-example-sync-mirror';
import {
  capturedGrpcRequestFromDraft,
  capturedGrpcResponseFromSnapshot,
} from '../grpc-response-example/grpc-example-draft';
import { subscribeGrpcPrefill } from './grpc-prefill-bus';
import { useSetting } from '../../settings/hooks';
import CodeEditor from '../shared/CodeEditor';
import CodeEditorActions, { type CodeEditorActionsTarget } from '../shared/CodeEditorActions';
import EditorHeader from '../shell/EditorHeader';
import { createImportedProtoSpecSeed } from '../specs/spec-scaffold';
import DocsTab from '../request-editor/DocsTab';
import KeyValueTable from '../request-editor/KeyValueTable';
import { ExampleChip } from '../shared/ExampleChip';
import GrpcResponseEmptyState from './GrpcResponseEmptyState';
import GrpcResponsePane from './GrpcResponsePane';
import GrpcStreamPane from './GrpcStreamPane';
import { type GrpcStreamSession, useLiveGrpcStream } from './useLiveGrpcStream';
import {
  buildGrpcRequestUpdates,
  canonicalGrpcRequestProjection,
  draftFromGrpcRequest,
  type GrpcDraft,
  metadataToRows,
} from './draft';
import {
  deriveGrpcMethods,
  findMethodOption,
  GRPC_IMPORT_PROTO_VALUE,
  GRPC_SPEC_LINK_VALUE_PREFIX,
  GRPC_STREAMING_ARROWS,
  parseGrpcSelectValue,
  synthesizeExampleText,
} from './method-selector';

const { Text } = Typography;

interface GrpcRequestEditorProps {
  grpcRequestUid: string;
  workspaceId: string | null;
  /** Open a saved gRPC response example's viewer tab (after "Save Response"). */
  onOpenGrpcResponseExample?: (uid: string, name: string, grpcRequestUid: string) => void;
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
  timeoutMs: undefined,
  sslVerification: true,
});

const methodKey = (m: GrpcMethodRef): string => `${m.service}/${m.rpc}`;

const INVOKE_SHORTCUT = isMac ? '⌘↵' : 'Ctrl+Enter';
const SEND_MESSAGE_SHORTCUT = isMac ? '⇧⌘↵' : 'Ctrl+Shift+Enter';
const END_STREAMING_SHORTCUT = isMac ? '⇧⌘E' : 'Ctrl+Shift+E';

/** One Settings-tab row: label + description on the left, the control
 *  right-aligned — the HTTP editor tabs' vocabulary at the density of
 *  a per-request settings sheet. */
const SettingRow: React.FC<{ label: string; description: string; control: React.ReactNode }> = ({
  label,
  description,
  control,
}) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, padding: '10px 0' }}>
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Text strong style={{ fontSize: 12 }}>
        {label}
      </Text>
      <Text type="secondary" style={{ fontSize: 11 }}>
        {description}
      </Text>
    </div>
    <div style={{ flexShrink: 0 }}>{control}</div>
  </div>
);

const GrpcRequestEditor: React.FC<GrpcRequestEditorProps> = ({
  grpcRequestUid,
  workspaceId,
  onOpenGrpcResponseExample,
  onDirtyChange,
  registerSaveRef,
}) => {
  const { token } = theme.useToken();
  const { message: toast } = App.useApp();
  const t = useT();
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

  const selectOptions = useMemo(() => {
    // Call-shape accent per streaming direction; the double-struck
    // arrow in GRPC_STREAMING_ARROWS keeps the shape readable without
    // the color.
    const streamingColors: Record<ProtoStreamingShape, string> = {
      unary: token.colorInfo,
      'server-streaming': token.colorWarning,
      'client-streaming': token.colorSuccess,
      'bidi-streaming': token.colorError,
    };
    const glyph = (streaming: ProtoStreamingShape) => (
      <span style={{ color: streamingColors[streaming], marginRight: 6 }}>{GRPC_STREAMING_ARROWS[streaming]}</span>
    );
    const groups: NonNullable<SelectProps['options']> = [];
    if (linkedSpec) {
      for (const group of derivation?.groups ?? []) {
        groups.push({
          label: group.service,
          options: group.options.map((option) => ({
            value: `${option.service}/${option.rpc}`,
            label: (
              <span>
                {glyph(option.streaming)}
                {option.rpc}
              </span>
            ),
            // The closed field names the call Postman-style: short
            // service name / rpc, glyph first.
            selectedLabel: (
              <span>
                {glyph(option.streaming)}
                {option.service.split('.').pop()} / {option.rpc}
              </span>
            ),
            title: option.rpc,
          })),
        });
      }
    }
    // The selector is the spec entry point in every state: link a
    // workspace protobuf spec inline (linked, the OTHER specs read as
    // a switch), or import a .proto file as one.
    const linkableSpecs = protobufSpecs.filter((s) => s.uid !== linkedSpec?.uid);
    if (linkableSpecs.length > 0) {
      groups.push({
        label: t('workbench.editors.grpc.method.linkGroup'),
        options: linkableSpecs.map((s) => ({
          value: `${GRPC_SPEC_LINK_VALUE_PREFIX}${s.uid}`,
          label: s.name,
          selectedLabel: s.name,
          title: s.name,
        })),
      });
    }
    if (workspaceId) {
      const importLabel = t('workbench.editors.grpc.method.importProto');
      groups.push({
        value: GRPC_IMPORT_PROTO_VALUE,
        label: importLabel,
        selectedLabel: importLabel,
        title: importLabel,
      });
    }
    // A persisted method the spec no longer declares stays visible as
    // an unresolved entry instead of silently blanking the select.
    if (draft.method && !selectedOption) {
      const unresolvedLabel = t('workbench.editors.grpc.method.unresolvedOption', { rpc: draft.method.rpc });
      groups.push({
        label: t('workbench.editors.grpc.method.unresolvedGroup'),
        options: [
          {
            value: methodKey(draft.method),
            label: unresolvedLabel,
            selectedLabel: unresolvedLabel,
            title: draft.method.rpc,
          },
        ],
      });
    }
    return groups;
  }, [linkedSpec, derivation, protobufSpecs, workspaceId, draft.method, selectedOption, t, token]);

  const protoFileInputRef = useRef<HTMLInputElement>(null);
  // Imperative surface of the mounted message editor — drives the
  // labelled Find / Replace / Beautify cluster in the toolbar row
  // above it (the ScriptsTab discipline).
  const messageActionsRef = useRef<CodeEditorActionsTarget | null>(null);

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

  const handleSelectChange = useCallback((value: string) => {
    const action = parseGrpcSelectValue(value);
    if (action === null) return;
    if (action.kind === 'method') {
      const method: GrpcMethodRef = action.method;
      setDraft((d) => ({ ...d, method }));
    } else if (action.kind === 'link-spec') {
      setDraft((d) => ({ ...d, specLink: { specUid: action.specUid } }));
    } else {
      protoFileInputRef.current?.click();
    }
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
  const activeSendIdRef = useRef<string | null>(null);
  const liveStream = useLiveGrpcStream();

  // Opt-in Postman posture: a message that isn't valid JSON invokes
  // anyway as an EMPTY message and the server answers. Default off —
  // the executor rejects before the wire with the exact parse error.
  const [sendInvalidMessage, setSendInvalidMessage] = useSetting('requests.grpcSendInvalidMessage');

  const handleInvoke = useCallback(async () => {
    if (!entity || invoking) return;
    // The CURRENT compose state invokes — saved or not (the HTTP
    // editor's draft-send law); identity fields ride along verbatim.
    const updates = buildGrpcRequestUpdates(draft);
    if (sendInvalidMessage && updates.message.trim() !== '') {
      try {
        JSON.parse(updates.message);
      } catch {
        updates.message = '';
      }
    }
    const draftEntity: GrpcRequestEntity = {
      schemaVersion: 5,
      uid: entity.uid,
      path: entity.path,
      name: entity.name,
      ...updates,
    };
    const streaming = selectedOption !== null && selectedOption.streaming !== 'unary';
    const sendId = crypto.randomUUID();
    activeSendIdRef.current = sendId;
    setInvoking(true);
    setResponse(null);
    setStreamSession(null);
    setResponseShape(streaming ? 'stream' : 'unary');
    if (streaming && draft.method) {
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
  }, [entity, invoking, draft, sendInvalidMessage, selectedOption, executeGrpc, liveStream, toast, t]);

  // Cancel morphs from Invoke while in flight — the host aborts the
  // exchange and the pending RPC above resolves with what arrived.
  const handleCancelInvoke = useCallback(() => {
    const sendId = activeSendIdRef.current;
    if (!sendId) return;
    hostBridge.call('abortRequestSend', { sendId }).catch(() => {});
  }, []);

  // "Clear response" (the result pane's ⋯ menu) — back to the
  // empty-state pane; the compose side is untouched.
  const handleClearResponse = useCallback(() => {
    setResponse(null);
    setStreamSession(null);
  }, []);

  // Save Response — freeze the settled exchange as an example under
  // this request. Captures the AUTHORED compose state (draft rows as
  // edited, variable refs unresolved) plus the executed snapshot's
  // facts; auth is deliberately excluded (see the GrpcResponseExample
  // schema). gRPC requests are context-create-only (always persisted),
  // so there is no needs-save gate — the button shows whenever a
  // non-error result is on screen.
  const handleSaveResponse = useCallback(async () => {
    if (!entity || !workspaceId || !response || response.error !== null) return;
    const mirror = getGrpcResponseExampleSyncMirrorForWorkspace(workspaceId);
    await mirror.hydrated;
    const name = nextGrpcExampleName(mirror, entity.uid, entity.name);
    const result = await applyGrpcResponseExampleCreate(
      {
        grpcRequestPath: entity.path,
        example: {
          grpcRequestUid: entity.uid,
          name,
          capturedAt: new Date().toISOString(),
          request: capturedGrpcRequestFromDraft(draft),
          response: capturedGrpcResponseFromSnapshot(response),
        },
      },
      { workspaceId, surfaceId: 'workbench' },
    );
    if (result.ok) {
      toast.success(t('workbench.editors.grpc.toast.savedExample', { name }));
      onOpenGrpcResponseExample?.(result.grpcResponseExample.uid, name, entity.uid);
    } else {
      toast.error(
        'message' in result && result.message
          ? t('workbench.editors.grpc.toast.saveExampleFailedDetail', { message: result.message })
          : t('workbench.editors.grpc.toast.saveExampleFailed'),
      );
    }
  }, [entity, workspaceId, response, draft, toast, onOpenGrpcResponseExample, t]);

  const canSaveResponse = workspaceId !== null && response !== null && response.error === null;

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
  // The controls SHOW for every client/bidi method (the CTA-scaffold
  // posture: a visible, disabled affordance teaches the flow) and
  // ENABLE only while a stream is open.
  const clientStreamShape =
    selectedOption !== null &&
    (selectedOption.streaming === 'client-streaming' || selectedOption.streaming === 'bidi-streaming');
  const clientStreamActive = invoking && responseShape === 'stream' && clientStreamShape;

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
        if (!clientStreamActive) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Enter') {
          void handleSendStreamMessage();
        } else {
          handleEndStreaming();
        }
        return;
      }
      if (e.key !== 'Enter' || e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (invoking) {
        handleCancelInvoke();
        return;
      }
      if (invokeDisabledReason !== null) return;
      void handleInvoke();
    },
    [
      invoking,
      invokeDisabledReason,
      clientStreamActive,
      handleSendStreamMessage,
      handleEndStreaming,
      handleCancelInvoke,
      handleInvoke,
    ],
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

  const issueCount = (derivation?.issues.length ?? 0) + (derivation?.parseFailures.length ?? 0);

  // Header consolidates the full target row (the HTTP editor's
  // discipline): TLS lock + authority + method selector in the title
  // slot (the input grows), Invoke in the actions slot next to the
  // standardized Save. No separate target row below — the tab pill
  // already carries the request's identity.
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
          onClick={() => setDraft((d) => ({ ...d, tls: !d.tls }))}
          aria-label={draft.tls ? t('workbench.editors.grpc.tls.on') : t('workbench.editors.grpc.tls.off')}
        />
      </Tooltip>
      <Input
        style={{ flex: 1, minWidth: 0, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
        placeholder={t('workbench.editors.grpc.urlPlaceholder')}
        value={draft.url}
        onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
        data-testid="grpc-url-input"
      />
      <Select
        style={{ width: 280, flexShrink: 0 }}
        placeholder={t('workbench.editors.grpc.method.placeholder')}
        // null, not undefined — an undefined value flips the antd
        // Select to uncontrolled, so a clicked link/import action
        // option would linger as the displayed label.
        value={draft.method ? methodKey(draft.method) : null}
        options={selectOptions}
        onChange={handleSelectChange}
        showSearch
        optionFilterProp="title"
        optionLabelProp="selectedLabel"
        popupRender={(menu) => (
          <>
            {menu}
            {linkedSpec && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 4,
                  padding: '4px 12px 0',
                  borderTop: `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {t('workbench.editors.grpc.specFooter.using', { name: linkedSpec.name })}
                </Text>
                <Tooltip title={t('workbench.editors.grpc.specFooter.refresh')}>
                  <Button
                    size="small"
                    type="text"
                    icon={<ReloadOutlined style={{ fontSize: 11 }} />}
                    onClick={() => setDerivationNonce((n) => n + 1)}
                  />
                </Tooltip>
              </div>
            )}
          </>
        )}
        data-testid="grpc-method-select"
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
    </div>
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

  const headerActions = invoking ? (
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
          onClick={handleCancelInvoke}
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
        invokeDisabledReason ?? (
          <ShortcutHintTitle label={INVOKE_SHORTCUT}>{t('workbench.editors.grpc.invoke.label')}</ShortcutHintTitle>
        )
      }
    >
      <span style={{ display: 'inline-flex' }}>
        <Button
          size="small"
          type="primary"
          icon={<CaretRightOutlined />}
          disabled={invokeDisabledReason !== null}
          onClick={() => void handleInvoke()}
          style={{ fontSize: 11 }}
          data-testid="grpc-invoke-button"
        >
          {t('workbench.editors.grpc.invoke.label')}
        </Button>
      </span>
    </Tooltip>
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
                      { key: 'service', label: t('workbench.editors.grpc.tab.serviceDefinition') },
                      { key: 'settings', label: t('workbench.editors.grpc.tab.settings') },
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
                        {/* Toolbar row ABOVE the editor (the ScriptsTab
                          discipline): the labelled Find / Replace /
                          Beautify cluster — out of the buffer so it never
                          covers long first lines. */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                          <CodeEditorActions
                            target={messageActionsRef}
                            language="json"
                            labels
                            findText={t('workbench.editors.scriptEditor.find')}
                            replaceText={t('workbench.editors.scriptEditor.replace')}
                            formatText={t('workbench.editors.scriptEditor.beautify')}
                          />
                        </div>
                        {/* Absolute inset host — a fill editor must not size
                          its own flex parent (the BodyTab discipline). */}
                        <div style={{ flex: 1, minHeight: 100, position: 'relative' }}>
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
                            <CodeEditor
                              value={draft.message}
                              onChange={(message) => setDraft((d) => ({ ...d, message }))}
                              language="json"
                              fill
                              actions="external"
                              actionsRef={messageActionsRef}
                              placeholder={t('workbench.editors.grpc.messagePlaceholder')}
                            />
                          </div>
                          {/* Floating action pill INSIDE the editor surface,
                            bottom-left — the ScriptsTab's Packages/Snippets
                            bar mirrored to the opposite corner. */}
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 22,
                              left: 26,
                              zIndex: 12,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                              padding: '2px 4px',
                              background: token.colorBgElevated,
                              border: `1px solid ${token.colorBorderSecondary}`,
                              borderRadius: 8,
                              boxShadow: token.boxShadowTertiary,
                            }}
                          >
                            <Tooltip
                              title={exampleText === null ? t('workbench.editors.grpc.example.needsMethod') : undefined}
                            >
                              <Button
                                size="small"
                                type="text"
                                icon={<ExampleChip />}
                                disabled={exampleText === null}
                                onClick={handleUseExample}
                                data-testid="grpc-use-example"
                              >
                                {t('workbench.editors.grpc.example.label')}
                              </Button>
                            </Tooltip>
                          </div>
                          {/* Stream controls, bottom-RIGHT of the same
                            surface: Send message + End streaming for every
                            client/bidi method, enabled only while the
                            stream is open — the compose text is what Send
                            writes upstream, so the controls live on it.
                            Bare buttons, no pill chrome — they carry their
                            own fills. */}
                          {clientStreamShape && (
                            <div
                              style={{
                                position: 'absolute',
                                bottom: 22,
                                right: 26,
                                zIndex: 12,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <Tooltip
                                title={
                                  clientStreamActive ? (
                                    <ShortcutHintTitle label={END_STREAMING_SHORTCUT}>
                                      {t('workbench.editors.grpc.stream.endStreaming')}
                                    </ShortcutHintTitle>
                                  ) : (
                                    t('workbench.editors.grpc.stream.controlsIdle')
                                  )
                                }
                              >
                                <Button
                                  size="small"
                                  disabled={!clientStreamActive}
                                  onClick={handleEndStreaming}
                                  data-testid="grpc-stream-end"
                                >
                                  {t('workbench.editors.grpc.stream.endStreaming')}
                                </Button>
                              </Tooltip>
                              <Tooltip
                                title={
                                  clientStreamActive ? (
                                    <ShortcutHintTitle label={SEND_MESSAGE_SHORTCUT}>
                                      {t('workbench.editors.grpc.stream.sendMessage')}
                                    </ShortcutHintTitle>
                                  ) : (
                                    t('workbench.editors.grpc.stream.controlsIdle')
                                  )
                                }
                              >
                                <Button
                                  size="small"
                                  type="primary"
                                  icon={<SendOutlined />}
                                  disabled={!clientStreamActive}
                                  onClick={() => void handleSendStreamMessage()}
                                  data-testid="grpc-stream-send"
                                >
                                  {t('workbench.editors.grpc.stream.sendMessage')}
                                </Button>
                              </Tooltip>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {activeTab === 'metadata' && (
                      <KeyValueTable
                        rows={draft.metadata}
                        onChange={(metadata) => setDraft((d) => ({ ...d, metadata }))}
                        keyPlaceholder={t('workbench.editors.grpc.metadata.keyPlaceholder')}
                        valuePlaceholder={t('workbench.editors.grpc.metadata.valuePlaceholder')}
                      />
                    )}
                    {activeTab === 'auth' && (
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
                              onChange={(e) =>
                                setDraft((d) => ({ ...d, auth: { type: 'bearer', token: e.target.value } }))
                              }
                              data-testid="grpc-auth-token"
                            />
                            <Text type="secondary" style={{ display: 'block', fontSize: 11, marginTop: 6 }}>
                              {t('workbench.editors.grpc.auth.help')}
                            </Text>
                          </div>
                        )}
                      </div>
                    )}
                    {activeTab === 'service' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
                        <div>
                          <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
                            {t('workbench.editors.grpc.spec.selectLabel')}
                          </Text>
                          <Select
                            style={{ width: '100%' }}
                            placeholder={t('workbench.editors.grpc.spec.selectPlaceholder')}
                            // null, not undefined — an undefined value flips
                            // the antd Select to uncontrolled, so a clicked
                            // import action would linger as the label.
                            value={linkedSpec?.uid ?? null}
                            options={[
                              ...protobufSpecs.map((s) => ({ value: s.uid, label: s.name })),
                              ...(workspaceId
                                ? [
                                    {
                                      value: GRPC_IMPORT_PROTO_VALUE,
                                      label: t('workbench.editors.grpc.method.importProto'),
                                    },
                                  ]
                                : []),
                            ]}
                            onChange={(specUid: string) => {
                              if (specUid === GRPC_IMPORT_PROTO_VALUE) {
                                protoFileInputRef.current?.click();
                                return;
                              }
                              setDraft((d) => ({ ...d, specLink: { specUid } }));
                            }}
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
                            {t('workbench.editors.grpc.spec.parseFailure', {
                              path: failure.path,
                              message: failure.message,
                            })}
                          </Text>
                        ))}
                        {derivation?.issues.map((issue) => (
                          <Text
                            key={`${issue.kind}:${issue.scope}:${issue.reference}`}
                            type="warning"
                            style={{ fontSize: 11 }}
                          >
                            {t('workbench.editors.grpc.spec.issue', { kind: issue.kind, reference: issue.reference })}
                          </Text>
                        ))}
                      </div>
                    )}
                    {activeTab === 'settings' && (
                      <div style={{ maxWidth: 720 }}>
                        <SettingRow
                          label={t('workbench.editors.grpc.settings.sslVerifyLabel')}
                          description={t('workbench.editors.grpc.settings.sslVerifyHelp')}
                          control={
                            <Switch
                              checked={draft.sslVerification}
                              onChange={(sslVerification) => setDraft((d) => ({ ...d, sslVerification }))}
                              data-testid="grpc-ssl-verify"
                            />
                          }
                        />
                        <SettingRow
                          label={t('workbench.editors.grpc.settings.timeoutLabel')}
                          description={t('workbench.editors.grpc.settings.timeoutHelp')}
                          control={
                            <InputNumber
                              min={MIN_REQUEST_TIMEOUT_MS}
                              max={MAX_REQUEST_TIMEOUT_MS}
                              step={1000}
                              value={draft.timeoutMs}
                              onChange={(value) => setDraft((d) => ({ ...d, timeoutMs: value ?? undefined }))}
                              placeholder={t('workbench.editors.grpc.settings.timeoutPlaceholder')}
                              style={{ width: 160 }}
                            />
                          }
                        />
                        {/* App-wide invoke posture — the SAME setting as
                          Settings → Requests and the header ⋯ toggle, not a
                          per-request field. */}
                        <SettingRow
                          label={t('workbench.settings.def.requests.grpcSendInvalidMessage.label')}
                          description={t('workbench.settings.def.requests.grpcSendInvalidMessage.description')}
                          control={
                            <Switch
                              checked={sendInvalidMessage}
                              onChange={setSendInvalidMessage}
                              data-testid="grpc-send-invalid-message"
                            />
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Allotment.Pane>
            <Allotment.Pane minSize={120}>
              {responseShape === 'stream' && (response !== null || liveStream.live !== null) ? (
                <GrpcStreamPane
                  live={liveStream.live}
                  snapshot={response}
                  session={streamSession}
                  registry={derivation?.registry ?? null}
                  method={draft.method}
                  onClear={handleClearResponse}
                  onSaveResponse={canSaveResponse ? () => void handleSaveResponse() : undefined}
                />
              ) : response !== null ? (
                <GrpcResponsePane
                  snapshot={response}
                  registry={derivation?.registry ?? null}
                  method={draft.method}
                  onClear={handleClearResponse}
                  onSaveResponse={canSaveResponse ? () => void handleSaveResponse() : undefined}
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
                  <GrpcResponseEmptyState invoking={invoking} />
                </div>
              )}
            </Allotment.Pane>
          </Allotment>
        </div>

        {specFooter}
      </div>
    </EntityScopeProvider>
  );
};

export default GrpcRequestEditor;
