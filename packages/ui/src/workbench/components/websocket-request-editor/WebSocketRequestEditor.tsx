/**
 * WebSocketRequestEditor — tab body for one WebSocketRequest entity.
 *
 * Editor shell: scheme lock + ws/wss URL in the header title slot,
 * Docs / Message / Headers / Params / AsyncAPI / Settings tabs. The
 * Message tab is the compose surface for the raw flavor (text/JSON
 * display toggle; the payload travels verbatim either way). Headers
 * carry the node-only honesty line. The AsyncAPI tab binds the
 * ids-only specLink and summarizes the census live from the spec's
 * current files — nothing cached.
 *
 * Connect opens the live session through the `executeWebSocketRequest`
 * channel — answered in-process on node hosts (`requestRuntime`) and
 * IN the page realm on surfaces carrying the `wsPageSession`
 * capability (the extension workbench, over the platform socket); a
 * browser surface with neither keeps the honest disabled copy. On the
 * page-session path the editor also publishes the renderer-scope
 * resolution factory the page host injects into the executor, and
 * names the configured node-only knobs (headers, SSL-verify-off) in
 * the session pane's honesty notice. In flight it MORPHS to
 * Disconnect (the clean close 1000 via the `closeWsSession` rider),
 * and the Message tab grows a Send control riding `sendWsMessage` —
 * enabled only while the session is open. Compose and result stack
 * in a vertical Allotment split (the gRPC editor's discipline): the
 * result pane is always attached — empty-state hint before the first
 * connect, `WsSessionPane` with the live timeline while open, the
 * settled snapshot's capture after.
 *
 * Dirty derives from form-vs-canonical equality via `useReprime`
 * (never setDirty); saves flow through the RequestsContext's
 * `updateWebSocketRequest` (the WebSocket write client under the
 * hood).
 */

import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DisconnectOutlined,
  LinkOutlined,
  LockOutlined,
  SendOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import {
  type AsyncApiCensus,
  type AsyncApiMessage,
  AsyncApiParseError,
  parseAsyncApi,
  synthesizeExamplePayload,
} from '@openheaders/core/asyncapi';
import { hostBridge } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import { MAX_REQUEST_TIMEOUT_MS, MIN_REQUEST_TIMEOUT_MS } from '@openheaders/core/schemas';
import { WEBSOCKET_REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import type { ExecutedWsSnapshot, WebSocketRequest as WebSocketRequestEntity } from '@openheaders/core/types';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityScopeProvider } from '@openheaders/ui/shared/awareness';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useSpecs } from '@openheaders/ui/shared/hooks/readers/useSpecs';
import { isMac } from '@openheaders/ui/shared/platform';
import { Allotment } from 'allotment';
import {
  App,
  Button,
  ConfigProvider,
  Input,
  InputNumber,
  Segmented,
  Select,
  Switch,
  Tabs,
  Tag,
  Tooltip,
  Tree,
  type TreeDataNode,
  Typography,
  theme,
} from 'antd';
import { useVariableResolverInputs } from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import { getWsResponseExampleSyncMirrorForWorkspace } from '@openheaders/ui/context/mirrors/ws-response-example-sync-mirror';
import {
  applyWsResponseExampleCreate,
  nextWsExampleName,
} from '@openheaders/ui/shared/sync/ws-response-example-write-client';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  capturedWsResponseFromSnapshot,
  capturedWsRequestFromDraft,
} from '../ws-response-example/ws-example-draft';
import CodeEditor from '../shared/CodeEditor';
import CodeEditorActions, { type CodeEditorActionsTarget } from '../shared/CodeEditorActions';
import DocsTab from '../request-editor/DocsTab';
import KeyValueTable from '../request-editor/KeyValueTable';
import EditorHeader from '../shell/EditorHeader';
import {
  buildWebSocketRequestUpdates,
  canonicalWebSocketRequestProjection,
  draftFromWebSocketRequest,
  headersToRows,
  paramsToRows,
  type WebSocketDraft,
} from './draft';
import { useLiveWsSession, type WsSessionTiming } from './useLiveWsSession';
import { makeWsPageResolutionFactory, publishWsPageResolutionFactory } from './ws-page-session';
import { subscribeWsPrefill } from './ws-prefill-bus';
import WsSessionPane from './WsSessionPane';

const { Text } = Typography;

const CONNECT_SHORTCUT = isMac ? '⌘↵' : 'Ctrl+Enter';
const SEND_MESSAGE_SHORTCUT = isMac ? '⇧⌘↵' : 'Ctrl+Shift+Enter';

interface WebSocketRequestEditorProps {
  websocketRequestUid: string;
  workspaceId: string | null;
  /** "Save Response" landed — open the minted example's viewer tab. */
  onOpenWsResponseExample?: (uid: string, name: string, websocketRequestUid: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

const emptyWebSocketDraft = (): WebSocketDraft => ({
  description: '',
  url: '',
  subprotocols: [],
  headers: [],
  params: [],
  message: '',
  eventName: '',
  namespace: '',
  ackEnabled: false,
  messageFormat: 'text',
  specLink: undefined,
  timeoutMs: undefined,
  sslVerification: true,
});

/** One Settings-tab row — the gRPC editor's SettingRow vocabulary. */
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

/** Flip the URL between ws:// and wss:// without touching the rest —
 *  the editor's scheme lock is string surgery on the draft URL only
 *  (templates and schemeless authorities stay as typed until locked). */
const toggleScheme = (url: string): string => {
  if (url.startsWith('wss://')) return `ws://${url.slice('wss://'.length)}`;
  if (url.startsWith('ws://')) return `wss://${url.slice('ws://'.length)}`;
  // No recognized scheme yet — locking prepends the secure one.
  return `wss://${url}`;
};

const WebSocketRequestEditor: React.FC<WebSocketRequestEditorProps> = ({
  websocketRequestUid,
  workspaceId,
  onOpenWsResponseExample,
  onDirtyChange,
  registerSaveRef,
}) => {
  const { token } = theme.useToken();
  const { message: toast } = App.useApp();
  const t = useT();
  const { websocketRequests, updateWebSocketRequest, executeWebSocket } = useRequests();
  const specs = useSpecs(workspaceId);

  const entity = useMemo(
    () => websocketRequests.find((r) => r.uid === websocketRequestUid) ?? null,
    [websocketRequests, websocketRequestUid],
  );

  const [draft, setDraft] = useState<WebSocketDraft>(() =>
    entity ? draftFromWebSocketRequest(entity) : emptyWebSocketDraft(),
  );
  const [activeTab, setActiveTab] = useState('message');

  const formFingerprint = useMemo(() => stableStringify(buildWebSocketRequestUpdates(draft)), [draft]);

  const reprime = useReprime({
    liveEntity: entity,
    scope: { entityType: WEBSOCKET_REQUEST_ENTITY_TYPE, entityId: entity?.uid ?? null },
    enabled: entity !== null,
    formFingerprint,
    signature: (e: WebSocketRequestEntity) => stableStringify(canonicalWebSocketRequestProjection(e)),
    populate: (e: WebSocketRequestEntity) => setDraft(draftFromWebSocketRequest(e)),
  });
  const isDirty = reprime.isDirty;

  // ── AsyncAPI spec binding ────────────────────────────────────────
  const asyncapiSpecs = useMemo(() => specs.filter((s) => s.format === 'asyncapi'), [specs]);
  const linkedSpec = useMemo(
    () => (draft.specLink ? (asyncapiSpecs.find((s) => s.uid === draft.specLink?.specUid) ?? null) : null),
    [asyncapiSpecs, draft.specLink],
  );

  // Census derived live from the linked spec's root file — issues
  // reported, parse failure surfaced, nothing cached (ids-only link).
  const census = useMemo((): { census: AsyncApiCensus | null; parseError: string | null } => {
    if (!linkedSpec) return { census: null, parseError: null };
    const root = linkedSpec.files.find((f) => f.uid === linkedSpec.rootFileUid);
    if (!root) return { census: null, parseError: null };
    try {
      return { census: parseAsyncApi(root.content), parseError: null };
    } catch (err) {
      return { census: null, parseError: err instanceof AsyncApiParseError ? err.message : String(err) };
    }
  }, [linkedSpec]);

  // ── Compose aids off the specLink census (Phase F) ───────────────
  // Channel messages first (channel-local keys — the vendor outline
  // shape), then reusable component messages not shadowed by a channel
  // entry. Each option pre-computes its synthesis over the ratified
  // subset so unsupported payloads (no schema, combinators) render
  // disabled instead of failing on pick.
  const exampleMessages = useMemo(() => {
    const c = census.census;
    if (!c) return [];
    const seen = new Set<string>();
    const out: {
      key: string;
      label: string;
      message: AsyncApiMessage;
      synth: { value: unknown } | null;
    }[] = [];
    const add = (scope: string, message: AsyncApiMessage) => {
      const key = `${scope}:${message.name}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ key, label: message.name, message, synth: synthesizeExamplePayload(message.payload, c.componentSchemas) });
    };
    for (const channel of c.channels) for (const message of channel.messages) add(channel.name, message);
    for (const message of c.componentMessages) add('components', message);
    return out;
  }, [census]);

  // Apply one censused message to the compose surface: the synthesized
  // payload lands in the message editor (pretty JSON); the socketio
  // flavor maps it to the single-element arguments array and prefills
  // the event name with the message key; the raw flavor flips the
  // display mode to JSON.
  const applyExampleMessage = useCallback(
    (key: string) => {
      const option = exampleMessages.find((m) => m.key === key);
      if (!option || option.synth === null) return;
      const socketio = entity?.flavor === 'socketio';
      const text = JSON.stringify(socketio ? [option.synth.value] : option.synth.value, null, 2);
      setDraft((d) => ({
        ...d,
        message: text,
        ...(socketio ? { eventName: option.message.name } : { messageFormat: 'json' as const }),
      }));
      setActiveTab('message');
    },
    [exampleMessages, entity],
  );

  // ── Channel browser (AsyncAPI tab) ───────────────────────────────
  // The census rendered for pick-and-prefill: channels nest their
  // messages (channel-local keys), operations carry direction glyphs,
  // components list the reusable messages. Message rows are the only
  // selectable nodes — selecting one applies its example to the
  // compose surface (the Message-tab picker's twin gesture).
  const browserTree = useMemo((): TreeDataNode[] => {
    const c = census.census;
    if (!c) return [];
    const nodes: TreeDataNode[] = [];
    if (c.servers.length > 0) {
      nodes.push({
        key: 'g:servers',
        selectable: false,
        title: t('workbench.editors.websocket.spec.browser.servers'),
        children: c.servers.map((s) => ({
          key: `srv:${s.name}`,
          selectable: false,
          title: [s.name, s.protocol, s.host].filter((part) => part !== null && part !== undefined).join(' · '),
        })),
      });
    }
    if (c.channels.length > 0) {
      nodes.push({
        key: 'g:channels',
        selectable: false,
        title: t('workbench.editors.websocket.spec.browser.channels'),
        children: c.channels.map((channel) => ({
          key: `ch:${channel.name}`,
          selectable: false,
          title: channel.address !== null && channel.address !== channel.name
            ? `${channel.name} · ${channel.address}`
            : channel.name,
          children: channel.messages.map((message) => ({
            key: `msg:${channel.name}:${message.name}`,
            title: message.name,
          })),
        })),
      });
    }
    if (c.operations.length > 0) {
      nodes.push({
        key: 'g:operations',
        selectable: false,
        title: t('workbench.editors.websocket.spec.browser.operations'),
        children: c.operations.map((op) => ({
          key: `op:${op.name}`,
          selectable: false,
          icon: op.action === 'send' ? <ArrowUpOutlined /> : <ArrowDownOutlined />,
          title: op.channelName !== null ? `${op.name} · ${op.channelName}` : op.name,
        })),
      });
    }
    if (c.componentMessages.length > 0) {
      nodes.push({
        key: 'g:components',
        selectable: false,
        title: t('workbench.editors.websocket.spec.browser.components'),
        children: c.componentMessages.map((message) => ({
          key: `msg:components:${message.name}`,
          title: message.name,
        })),
      });
    }
    return nodes;
  }, [census, t]);

  const handleBrowserSelect = useCallback(
    (keys: React.Key[]) => {
      const key = keys[0];
      if (typeof key !== 'string' || !key.startsWith('msg:')) return;
      applyExampleMessage(key.slice('msg:'.length));
    },
    [applyExampleMessage],
  );

  // "Open in Request" prefill — a saved example's captured request
  // block lands as unsaved draft edits (the gRPC prefill flow; flavor
  // is identity and stays the entity's own).
  useEffect(() => {
    if (!entity) return;
    return subscribeWsPrefill(entity.uid, (captured) => {
      setDraft((d) => ({
        ...d,
        url: captured.url,
        subprotocols: [...captured.subprotocols],
        headers: headersToRows(captured.headers),
        params: paramsToRows(captured.params),
        message: captured.message,
        eventName: captured.eventName ?? '',
        namespace: captured.namespace ?? '',
        ackEnabled: captured.ackEnabled ?? false,
        sslVerification: captured.sslVerification,
        timeoutMs: captured.timeoutMs,
      }));
    });
  }, [entity]);

  const messageActionsRef = useRef<CodeEditorActionsTarget | null>(null);

  // ── Session (node hosts + page-realm capability surfaces) ────────
  const requestRuntimeKind = getCapability('requestRuntime')?.() ?? 'browser';
  const pageSession = requestRuntimeKind !== 'node' && (getCapability('wsPageSession')?.() ?? false);
  const [inFlight, setInFlight] = useState(false);
  const [snapshot, setSnapshot] = useState<ExecutedWsSnapshot | null>(null);
  const [timing, setTiming] = useState<WsSessionTiming | null>(null);
  const [hostNotice, setHostNotice] = useState<string | null>(null);
  const activeSendIdRef = useRef<string | null>(null);
  const liveSession = useLiveWsSession();

  // Page-session resolution publisher — the host executing in this
  // page realm injects the CURRENT factory into the executor at
  // Connect, so republish on every renderer-scope change while a
  // WebSocket editor is mounted (nothing can Connect without one).
  const resolverInputs = useVariableResolverInputs();
  useEffect(() => {
    if (!pageSession) return;
    publishWsPageResolutionFactory(makeWsPageResolutionFactory(resolverInputs));
  }, [pageSession, resolverInputs]);

  const handleConnect = useCallback(async () => {
    if (!entity || inFlight) return;
    // The CURRENT compose state connects — saved or not (the HTTP
    // editor's draft-send law); identity fields ride along verbatim.
    const draftEntity: WebSocketRequestEntity = {
      schemaVersion: 5,
      uid: entity.uid,
      path: entity.path,
      name: entity.name,
      flavor: entity.flavor,
      ...buildWebSocketRequestUpdates(draft),
    };
    // Per-knob honesty on the page-session path: the platform socket
    // cannot carry custom handshake headers or skip TLS verification —
    // a CONFIGURED knob is named for the session's whole life instead
    // of silently dropping (the connect deadline DOES apply here).
    const inapplicableKnobs: string[] = [];
    if (pageSession) {
      if (draft.headers.some((h) => h.enabled !== false && h.key.trim() !== '')) {
        inapplicableKnobs.push(t('workbench.editors.websocket.session.knobHeaders'));
      }
      if (!draft.sslVerification) {
        inapplicableKnobs.push(t('workbench.editors.websocket.session.knobSslVerify'));
      }
    }
    setHostNotice(
      inapplicableKnobs.length > 0
        ? t('workbench.editors.websocket.session.hostNotice', { knobs: inapplicableKnobs.join(', ') })
        : null,
    );
    const sendId = crypto.randomUUID();
    activeSendIdRef.current = sendId;
    setInFlight(true);
    setSnapshot(null);
    setTiming(null);
    liveSession.beginSession(sendId);
    const settled = await executeWebSocket({ draft: draftEntity, sendId });
    const session = liveSession.takeSession();
    setTiming(session === null ? null : { ...session, endedAt: Date.now() });
    liveSession.endSession();
    activeSendIdRef.current = null;
    setInFlight(false);
    if (settled === null) {
      toast.error(t('workbench.editors.websocket.session.connectFailed'));
      return;
    }
    setSnapshot(settled);
  }, [entity, inFlight, draft, pageSession, executeWebSocket, liveSession, toast, t]);

  // Disconnect morphs from Connect while the session is open — the
  // clean close 1000; the pending RPC above resolves with the
  // whole-session snapshot once the close handshake settles.
  const handleDisconnect = useCallback(() => {
    const sendId = activeSendIdRef.current;
    if (!sendId) return;
    hostBridge.call('closeWsSession', { sendId }).catch(() => {});
  }, []);

  // Send the CURRENT compose state as one message — the executor
  // resolves {{refs}} through the resolver it built at Connect, and a
  // resolve (or, on the socketio flavor, a frame-compose) failure
  // reports here without touching the open session. For socketio the
  // compose text is the JSON arguments array and the rider addendum
  // carries the event name + ack opt-in.
  const socketioFlavor = entity?.flavor === 'socketio';
  const handleSendMessage = useCallback(async () => {
    const sendId = activeSendIdRef.current;
    if (!sendId) return;
    const result = await hostBridge
      .call('sendWsMessage', {
        sendId,
        messageText: draft.message,
        ...(socketioFlavor ? { socketio: { eventName: draft.eventName, expectAck: draft.ackEnabled } } : {}),
      })
      .catch(() => null);
    if (result === null || !result.success) {
      toast.error(result?.error ?? t('workbench.editors.websocket.session.sendFailed'));
    }
  }, [draft.message, draft.eventName, draft.ackEnabled, socketioFlavor, toast, t]);

  const handleClearSession = useCallback(() => {
    setSnapshot(null);
    setTiming(null);
    setHostNotice(null);
  }, []);

  // Save Response — freeze the settled session as an example under
  // this request. Captures the AUTHORED compose state (draft rows as
  // edited, variable refs unresolved) plus the settled snapshot's
  // facts; only a session that opened can be captured (the gRPC
  // example's law).
  const handleSaveResponse = useCallback(async () => {
    if (!entity || !workspaceId || !snapshot || snapshot.error !== null || !snapshot.connected) return;
    const mirror = getWsResponseExampleSyncMirrorForWorkspace(workspaceId);
    await mirror.hydrated;
    const name = nextWsExampleName(mirror, entity.uid, entity.name);
    const result = await applyWsResponseExampleCreate(
      {
        websocketRequestPath: entity.path,
        example: {
          websocketRequestUid: entity.uid,
          name,
          capturedAt: new Date().toISOString(),
          request: capturedWsRequestFromDraft(draft, entity.flavor),
          response: capturedWsResponseFromSnapshot(snapshot),
        },
      },
      { workspaceId, surfaceId: 'workbench' },
    );
    if (result.ok) {
      toast.success(t('workbench.editors.websocket.toast.savedExample', { name }));
      onOpenWsResponseExample?.(result.wsResponseExample.uid, name, entity.uid);
    } else {
      toast.error(
        'message' in result && result.message
          ? t('workbench.editors.websocket.toast.saveExampleFailedDetail', { message: result.message })
          : t('workbench.editors.websocket.toast.saveExampleFailed'),
      );
    }
  }, [entity, workspaceId, snapshot, draft, toast, onOpenWsResponseExample, t]);

  const canSaveResponse =
    workspaceId !== null && snapshot !== null && snapshot.error === null && snapshot.connected;

  const connectDisabledReason =
    requestRuntimeKind !== 'node' && !pageSession
      ? t('workbench.editors.websocket.connect.browserHost')
      : draft.url.trim() === ''
        ? t('workbench.editors.websocket.connect.needsUrl')
        : null;

  const sessionOpen = inFlight && liveSession.live?.open !== null && liveSession.live !== null;

  // ⌘/Ctrl+Enter connects from anywhere in the editor — the same gate
  // as the Connect button, and the same MORPH: while the session is
  // in flight the chord disconnects. ⌘/Ctrl+Shift+Enter sends the
  // compose text — a dead key outside an open session. Capture phase
  // so the chords win inside the Monaco message editor too.
  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'Enter') return;
      if (e.shiftKey) {
        if (!sessionOpen) return;
        e.preventDefault();
        e.stopPropagation();
        void handleSendMessage();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (inFlight) {
        handleDisconnect();
        return;
      }
      if (connectDisabledReason !== null) return;
      void handleConnect();
    },
    [sessionOpen, inFlight, connectDisabledReason, handleSendMessage, handleDisconnect, handleConnect],
  );

  // ── Save ─────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!entity || !isDirty) return;
    const result = await updateWebSocketRequest(entity.uid, buildWebSocketRequestUpdates(draft));
    if (result.ok) return;
    if (result.reason === 'not-found') {
      toast.error(t('workbench.editors.websocket.toast.deletedOtherTab'));
    } else {
      toast.error(
        result.message
          ? t('workbench.editors.websocket.toast.updateFailedDetail', { message: result.message })
          : t('workbench.editors.websocket.toast.updateFailed'),
      );
    }
  }, [entity, isDirty, draft, updateWebSocketRequest, toast, t]);

  const handleSaveSync = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  const shell = useEditorShell({
    entityType: WEBSOCKET_REQUEST_ENTITY_TYPE,
    entityId: entity?.uid ?? null,
    isDirty,
    onSave: handleSaveSync,
    onDirtyChange,
    registerSaveRef,
  });

  if (!entity) {
    return (
      <div style={{ padding: 24, background: token.colorBgContainer }}>
        <Text type="secondary">{t('workbench.editors.websocket.notFound')}</Text>
      </div>
    );
  }

  const secure = !draft.url.startsWith('ws://');

  // "Use example message" — the compose aid off the specLink census.
  // A command picker, not a value: picking synthesizes the payload
  // into the editor and resets to the placeholder. Options without a
  // synthesizable payload (no schema, combinators) stay visible but
  // disabled — the census is shown honestly, never filtered silently.
  const exampleSelect =
    exampleMessages.length > 0 ? (
      <Select
        size="small"
        style={{ minWidth: 190 }}
        placeholder={t('workbench.editors.websocket.spec.useExample')}
        value={null}
        options={exampleMessages.map((m) => ({ value: m.key, label: m.label, disabled: m.synth === null }))}
        onChange={(key: string) => applyExampleMessage(key)}
        data-testid="ws-use-example-message"
      />
    ) : null;

  // Header consolidates the full target row (the gRPC editor's
  // discipline): scheme lock + URL in the title slot, Connect in the
  // actions slot next to the standardized Save. Connect is a visible,
  // DISABLED affordance until the session plane lands — the
  // CTA-scaffold posture with honest copy, never a hidden button.
  const headerTitle = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
      <Tag style={{ marginInlineEnd: 0, flexShrink: 0, fontSize: 10 }}>
        {entity.flavor === 'socketio'
          ? t('workbench.editors.websocket.flavor.socketio')
          : t('workbench.editors.websocket.flavor.raw')}
      </Tag>
      <Tooltip
        title={secure ? t('workbench.editors.websocket.scheme.wss') : t('workbench.editors.websocket.scheme.ws')}
      >
        <Button
          icon={
            secure ? (
              <LockOutlined style={{ color: token.colorSuccess }} />
            ) : (
              <UnlockOutlined style={{ color: token.colorWarning }} />
            )
          }
          onClick={() => setDraft((d) => ({ ...d, url: toggleScheme(d.url) }))}
          aria-label={secure ? t('workbench.editors.websocket.scheme.wss') : t('workbench.editors.websocket.scheme.ws')}
          data-testid="websocket-scheme-lock"
        />
      </Tooltip>
      <Input
        style={{ flex: 1, minWidth: 0, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
        placeholder={t('workbench.editors.websocket.urlPlaceholder')}
        value={draft.url}
        onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
        data-testid="websocket-url-input"
      />
    </div>
  );

  // Connect morphs into Disconnect while the session is in flight —
  // the Invoke→Stop treatment: solid on the darkened error token.
  const headerActions = inFlight ? (
    <Tooltip
      placement="bottom"
      title={
        <ShortcutHintTitle label={CONNECT_SHORTCUT}>
          {t('workbench.editors.websocket.connect.disconnect')}
        </ShortcutHintTitle>
      }
    >
      <ConfigProvider theme={{ token: { colorError: token.colorErrorActive } }}>
        <Button
          size="small"
          type="primary"
          danger
          icon={<DisconnectOutlined />}
          onClick={handleDisconnect}
          style={{ fontSize: 11 }}
          data-testid="websocket-connect-button"
        >
          {t('workbench.editors.websocket.connect.disconnect')}
        </Button>
      </ConfigProvider>
    </Tooltip>
  ) : (
    <Tooltip
      placement="bottom"
      title={
        connectDisabledReason ?? (
          <ShortcutHintTitle label={CONNECT_SHORTCUT}>
            {t('workbench.editors.websocket.connect.label')}
          </ShortcutHintTitle>
        )
      }
    >
      <span style={{ display: 'inline-flex' }}>
        <Button
          size="small"
          type="primary"
          icon={<LinkOutlined />}
          disabled={connectDisabledReason !== null}
          onClick={() => void handleConnect()}
          style={{ fontSize: 11 }}
          data-testid="websocket-connect-button"
        >
          {t('workbench.editors.websocket.connect.label')}
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
          ? t('workbench.editors.websocket.specFooter.using', { name: linkedSpec.name })
          : t('workbench.editors.websocket.specFooter.none')}
      </Text>
      {census.census !== null && census.census.issues.length > 0 && (
        <Text type="warning" style={{ fontSize: 11 }}>
          {t('workbench.editors.websocket.spec.issues', { count: census.census.issues.length })}
        </Text>
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
        <EditorHeader title={headerTitle} actions={headerActions} shell={shell.headerProps} />

        {/* Compose / session split — the gRPC editor's stacked
          Allotment discipline: the sash bounds the message editor,
          and the session pane is always attached (empty-state hint
          before the first connect). */}
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
                { key: 'docs', label: t('workbench.editors.websocket.tab.docs') },
                { key: 'message', label: t('workbench.editors.websocket.tab.message') },
                { key: 'headers', label: t('workbench.editors.websocket.tab.headers') },
                { key: 'params', label: t('workbench.editors.websocket.tab.params') },
                { key: 'spec', label: t('workbench.editors.websocket.tab.spec') },
                { key: 'settings', label: t('workbench.editors.websocket.tab.settings') },
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
                <DocsTab value={draft.description} onChange={(description) => setDraft((d) => ({ ...d, description }))} />
              )}
              {activeTab === 'message' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
                  {/* Toolbar row ABOVE the editor (the ScriptsTab
                    discipline). Raw flavor: compose display mode on the
                    left. Socket.IO flavor: the event name + ack opt-in
                    compose the EVENT frame — the editor below holds the
                    JSON arguments array, so the format toggle has no
                    fork here. Find / Replace / Beautify cluster on the
                    right (a JSON affordance). */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    {socketioFlavor ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        <Input
                          size="small"
                          style={{ maxWidth: 260, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
                          placeholder={t('workbench.editors.websocket.event.namePlaceholder')}
                          value={draft.eventName}
                          onChange={(e) => setDraft((d) => ({ ...d, eventName: e.target.value }))}
                          data-testid="websocket-event-name"
                        />
                        <Tooltip title={t('workbench.editors.websocket.event.ackHelp')}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Switch
                              size="small"
                              checked={draft.ackEnabled}
                              onChange={(ackEnabled) => setDraft((d) => ({ ...d, ackEnabled }))}
                              data-testid="websocket-expect-ack"
                            />
                            <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                              {t('workbench.editors.websocket.event.ackLabel')}
                            </Text>
                          </span>
                        </Tooltip>
                        {exampleSelect}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Segmented
                          size="small"
                          value={draft.messageFormat}
                          onChange={(messageFormat) =>
                            setDraft((d) => ({ ...d, messageFormat: messageFormat as 'text' | 'json' }))
                          }
                          options={[
                            { value: 'text', label: t('workbench.editors.websocket.message.formatText') },
                            { value: 'json', label: t('workbench.editors.websocket.message.formatJson') },
                          ]}
                          data-testid="websocket-message-format"
                        />
                        {exampleSelect}
                      </div>
                    )}
                    {(socketioFlavor || draft.messageFormat === 'json') && (
                      <CodeEditorActions
                        target={messageActionsRef}
                        language="json"
                        labels
                        findText={t('workbench.editors.scriptEditor.find')}
                        replaceText={t('workbench.editors.scriptEditor.replace')}
                        formatText={t('workbench.editors.scriptEditor.beautify')}
                      />
                    )}
                  </div>
                  {/* Absolute inset host — a fill editor must not size
                    its own flex parent (the BodyTab discipline). */}
                  <div style={{ flex: 1, minHeight: 100, position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
                      <CodeEditor
                        value={draft.message}
                        onChange={(message) => setDraft((d) => ({ ...d, message }))}
                        language={socketioFlavor || draft.messageFormat === 'json' ? 'json' : 'text'}
                        fill
                        actions="external"
                        actionsRef={messageActionsRef}
                        placeholder={
                          socketioFlavor
                            ? t('workbench.editors.websocket.event.argsPlaceholder')
                            : t('workbench.editors.websocket.messagePlaceholder')
                        }
                      />
                    </div>
                    {/* Send control, bottom-right of the compose
                      surface (the gRPC stream-controls anatomy): a
                      visible affordance that ENABLES only while the
                      session is open — the compose text is what Send
                      writes, so the control lives on it. */}
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
                          sessionOpen ? (
                            <ShortcutHintTitle label={SEND_MESSAGE_SHORTCUT}>
                              {t('workbench.editors.websocket.session.sendMessage')}
                            </ShortcutHintTitle>
                          ) : (
                            t('workbench.editors.websocket.session.sendIdle')
                          )
                        }
                      >
                        <Button
                          size="small"
                          type="primary"
                          icon={<SendOutlined />}
                          disabled={!sessionOpen}
                          onClick={() => void handleSendMessage()}
                          data-testid="websocket-send-message"
                        >
                          {t('workbench.editors.websocket.session.sendMessage')}
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'headers' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Node-only honesty line — the limit stated up front;
                    a page-realm Connect with configured rows also names
                    it in the session pane's notice (never a silent
                    drop, never a gate). */}
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {t('workbench.editors.websocket.headers.nodeOnly')}
                  </Text>
                  <KeyValueTable
                    rows={draft.headers}
                    onChange={(headers) => setDraft((d) => ({ ...d, headers }))}
                    keyPlaceholder={t('workbench.editors.websocket.headers.keyPlaceholder')}
                    valuePlaceholder={t('workbench.editors.websocket.headers.valuePlaceholder')}
                  />
                </div>
              )}
              {activeTab === 'params' && (
                <KeyValueTable
                  rows={draft.params}
                  onChange={(params) => setDraft((d) => ({ ...d, params }))}
                  keyPlaceholder={t('workbench.editors.websocket.params.keyPlaceholder')}
                  valuePlaceholder={t('workbench.editors.websocket.params.valuePlaceholder')}
                />
              )}
              {activeTab === 'spec' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
                  <div>
                    <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
                      {t('workbench.editors.websocket.spec.selectLabel')}
                    </Text>
                    <Select
                      style={{ width: '100%' }}
                      placeholder={t('workbench.editors.websocket.spec.selectPlaceholder')}
                      value={linkedSpec?.uid}
                      options={asyncapiSpecs.map((s) => ({ value: s.uid, label: s.name }))}
                      onChange={(specUid: string) => setDraft((d) => ({ ...d, specLink: { specUid } }))}
                      data-testid="websocket-spec-select"
                    />
                  </div>
                  {census.census && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {t('workbench.editors.websocket.spec.summary', {
                        servers: census.census.servers.length,
                        channels: census.census.channels.length,
                        operations: census.census.operations.length,
                      })}
                    </Text>
                  )}
                  {browserTree.length > 0 && (
                    <div data-testid="ws-asyncapi-browser">
                      {/* Pick a message row to land its synthesized
                        example on the compose surface. */}
                      <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
                        {t('workbench.editors.websocket.spec.browser.hint')}
                      </Text>
                      <Tree
                        treeData={browserTree}
                        showIcon
                        defaultExpandAll
                        selectedKeys={[]}
                        onSelect={handleBrowserSelect}
                        blockNode
                      />
                    </div>
                  )}
                  {census.parseError !== null && (
                    <Text type="warning" style={{ fontSize: 11 }}>
                      {t('workbench.editors.websocket.spec.parseFailure', { message: census.parseError })}
                    </Text>
                  )}
                  {census.census?.issues.map((issue) => (
                    <Text key={`${issue.kind}:${issue.reference}`} type="warning" style={{ fontSize: 11 }}>
                      {`${issue.kind}: ${issue.reference}`}
                    </Text>
                  ))}
                </div>
              )}
              {activeTab === 'settings' && (
                <div style={{ maxWidth: 720 }}>
                  {socketioFlavor && (
                    <SettingRow
                      label={t('workbench.editors.websocket.settings.namespaceLabel')}
                      description={t('workbench.editors.websocket.settings.namespaceHelp')}
                      control={
                        <Input
                          style={{ width: 260, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
                          placeholder={t('workbench.editors.websocket.settings.namespacePlaceholder')}
                          value={draft.namespace}
                          onChange={(e) => setDraft((d) => ({ ...d, namespace: e.target.value }))}
                          data-testid="websocket-namespace"
                        />
                      }
                    />
                  )}
                  <SettingRow
                    label={t('workbench.editors.websocket.settings.sslVerifyLabel')}
                    description={t('workbench.editors.websocket.settings.sslVerifyHelp')}
                    control={
                      <Switch
                        checked={draft.sslVerification}
                        onChange={(sslVerification) => setDraft((d) => ({ ...d, sslVerification }))}
                        data-testid="websocket-ssl-verify"
                      />
                    }
                  />
                  <SettingRow
                    label={t('workbench.editors.websocket.settings.subprotocolsLabel')}
                    description={t('workbench.editors.websocket.settings.subprotocolsHelp')}
                    control={
                      <Select
                        mode="tags"
                        style={{ minWidth: 260 }}
                        value={draft.subprotocols}
                        onChange={(subprotocols: string[]) => setDraft((d) => ({ ...d, subprotocols }))}
                        placeholder={t('workbench.editors.websocket.settings.subprotocolsPlaceholder')}
                        open={false}
                        suffixIcon={null}
                        tokenSeparators={[',', ' ']}
                        data-testid="websocket-subprotocols"
                      />
                    }
                  />
                  <SettingRow
                    label={t('workbench.editors.websocket.settings.timeoutLabel')}
                    description={t('workbench.editors.websocket.settings.timeoutHelp')}
                    control={
                      <InputNumber
                        min={MIN_REQUEST_TIMEOUT_MS}
                        max={MAX_REQUEST_TIMEOUT_MS}
                        step={1000}
                        value={draft.timeoutMs}
                        onChange={(value) => setDraft((d) => ({ ...d, timeoutMs: value ?? undefined }))}
                        placeholder={t('workbench.editors.websocket.settings.timeoutPlaceholder')}
                        style={{ width: 160 }}
                        data-testid="websocket-timeout"
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
              {liveSession.live !== null || snapshot !== null ? (
                <WsSessionPane
                  live={liveSession.live}
                  snapshot={snapshot}
                  timing={timing}
                  hostNotice={hostNotice}
                  flavor={entity.flavor}
                  onClear={handleClearSession}
                  {...(canSaveResponse ? { onSaveResponse: () => void handleSaveResponse() } : {})}
                />
              ) : (
                // Always-attached session pane (the gRPC editor's
                // posture): a stable target with the plain title row
                // and a connect hint before the first session.
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
                      {t('workbench.editors.websocket.session.title')}
                    </Text>
                  </div>
                  <div style={{ padding: '16px 12px' }} data-testid="ws-session-empty">
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('workbench.editors.websocket.session.emptyHint')}
                    </Text>
                  </div>
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

export default WebSocketRequestEditor;
