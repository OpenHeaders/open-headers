/**
 * WebSocketRequestEditor — tab body for one WebSocketRequest entity;
 * the ORCHESTRATOR over the editor's modules, one concern per file:
 *
 *   - `useWsSessionPlane` — Connect/Disconnect on the
 *     `executeWebSocketRequest` channel (node hosts + `wsPageSession`
 *     page-realm surfaces, honesty notice included), the live session
 *     feed, the Send rider, Save Response.
 *   - `useWsComposeAids` — the AsyncAPI specLink census and its
 *     compose aids (example picker, channel browser).
 *   - `useSocketIoArgs` — the Socket.IO per-argument compose state
 *     over the stored arguments-array text.
 *   - `WsTargetRow` — the URL header title with the URL⇄params sync.
 *   - `WsMessageTab` (+ `WsArgRail`) / `WsEventsTab` /
 *     `WebSocketAuthTab` / `WsSpecTab` / `WebSocketSettingsTab` — the
 *     compose tabs (Docs, Headers and Params ride shared components
 *     inline).
 *   - `compose.ts` — chord labels, scheme surgery, the display-mode →
 *     language map.
 *
 * This file keeps what genuinely spans them: the draft + derived-dirty
 * reprime + prefill hand-off, the ⌘/Ctrl+Enter chord plane, the editor
 * shell/save, the header (target row + Connect/Disconnect morph), the
 * compose/session Allotment split with the always-attached session
 * pane.
 *
 * Dirty derives from form-vs-canonical equality via `useReprime`
 * (never setDirty); saves flow through the RequestsContext's
 * `updateWebSocketRequest` (the WebSocket write client under the
 * hood).
 */

import { CaretRightOutlined } from '@ant-design/icons';
import { WEBSOCKET_REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import type { WebSocketRequest as WebSocketRequestEntity } from '@openheaders/core/types';
import { binaryEncodingError, generateUid } from '@openheaders/core/utils';
import { ShortcutHintTitle, ShortcutKbd } from '@openheaders/ui/components/ShortcutKbd';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityScopeProvider } from '@openheaders/ui/shared/awareness';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { Allotment } from 'allotment';
import { App, Button, ConfigProvider, Tabs, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import DocsTab from '../request-editor/DocsTab';
import KeyValueTable from '../request-editor/KeyValueTable';
import SessionLock from '../shared/SessionLock';
import SpecTabLabel from '../shared/SpecTabLabel';
import EditorHeader from '../shell/EditorHeader';
import { CONNECT_SHORTCUT } from './compose';
import {
  buildWebSocketRequestUpdates,
  canonicalWebSocketRequestProjection,
  draftFromWebSocketRequest,
  headersToRows,
  nextSavedMessageName,
  paramsToRows,
  savedMessageFromFrame,
  splitSocketIoUrl,
  type WebSocketDraft,
} from './draft';
import { useSocketIoArgs } from './useSocketIoArgs';
import { useWsSavedSelection } from './useWsSavedSelection';
import { useWsComposeAids } from './useWsComposeAids';
import { useWsSessionPlane } from './useWsSessionPlane';
import WebSocketAuthTab from './WebSocketAuthTab';
import WebSocketSettingsTab from './WebSocketSettingsTab';
import { subscribeWsPrefill } from './ws-prefill-bus';
import WsEventsTab from './WsEventsTab';
import WsHeadersTab from './WsHeadersTab';
import WsParamsTab from './WsParamsTab';
import WsMessageTab from './WsMessageTab';
import WsSessionPane from './WsSessionPane';
import WsSpecTab from './WsSpecTab';
import WsTargetRow from './WsTargetRow';

const { Text } = Typography;

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
  auth: { type: 'none' },
  events: [],
  savedMessages: [],
  message: '',
  eventName: '',
  namespace: '',
  handshakePath: '',
  ackEnabled: false,
  messageFormat: 'text',
  binaryEncoding: 'base64',
  specLink: undefined,
  resolveToAddress: undefined,
  proxyMode: undefined,
  proxyUrl: undefined,
  proxyCredentialRef: undefined,
  unixSocketPath: undefined,
  timeoutMs: undefined,
  sslVerification: true,
  clientCertificateRef: undefined,
  tlsMinVersion: undefined,
  tlsMaxVersion: undefined,
  tlsCipherSuites: undefined,
  sniServerName: undefined,
});

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
  const { websocketRequests, updateWebSocketRequest } = useRequests();

  const entity = useMemo(
    () => websocketRequests.find((r) => r.uid === websocketRequestUid) ?? null,
    [websocketRequests, websocketRequestUid],
  );

  const [draft, rawSetDraft] = useState<WebSocketDraft>(() =>
    entity ? draftFromWebSocketRequest(entity) : emptyWebSocketDraft(),
  );

  // Saved-messages selection plane: the compose is the selected row's
  // editor. Every USER edit below rides the bound setter (compose
  // edits write through to the selected row); sync repopulates stay
  // RAW — reprime must never fabricate edits.
  const savedSelection = useWsSavedSelection(draft, rawSetDraft);
  const setDraft = savedSelection.setBoundDraft;
  const [activeTab, setActiveTab] = useState('message');
  // Saved-messages rail collapse — COLLAPSED by default (the compose
  // editor gets the full width; the strip is the affordance in); a
  // Save from the timeline opens it so the new row is the feedback.
  const [railCollapsed, setRailCollapsed] = useState(true);

  const formFingerprint = useMemo(() => stableStringify(buildWebSocketRequestUpdates(draft)), [draft]);

  const reprime = useReprime({
    liveEntity: entity,
    scope: { entityType: WEBSOCKET_REQUEST_ENTITY_TYPE, entityId: entity?.uid ?? null },
    enabled: entity !== null,
    formFingerprint,
    signature: (e: WebSocketRequestEntity) => stableStringify(canonicalWebSocketRequestProjection(e)),
    populate: (e: WebSocketRequestEntity) => rawSetDraft(draftFromWebSocketRequest(e)),
  });
  const isDirty = reprime.isDirty;

  const socketioFlavor = entity?.flavor === 'socketio';

  // "Open in Request" prefill — a saved example's captured request
  // block lands as unsaved draft edits (the gRPC prefill flow; flavor
  // is identity and stays the entity's own).
  useEffect(() => {
    if (!entity) return;
    return subscribeWsPrefill(entity.uid, (captured) => {
      const target = splitSocketIoUrl(captured.url, captured.flavor, captured.namespace ?? '');
      setDraft((d) => ({
        ...d,
        url: target.url,
        subprotocols: [...captured.subprotocols],
        headers: headersToRows(captured.headers),
        params: paramsToRows(captured.params),
        message: captured.message,
        messageFormat: captured.messageFormat ?? 'text',
        binaryEncoding: captured.binaryEncoding ?? 'base64',
        eventName: captured.eventName ?? '',
        namespace: target.namespace,
        handshakePath: captured.handshakePath ?? '',
        ackEnabled: captured.ackEnabled ?? false,
        sslVerification: captured.sslVerification,
        timeoutMs: captured.timeoutMs,
      }));
    });
  }, [entity]);

  // ── Session plane, compose aids, Socket.IO args ──────────────────
  const session = useWsSessionPlane({ entity, draft, workspaceId, onOpenWsResponseExample });
  const onExampleApplied = useCallback(() => setActiveTab('message'), []);
  const aids = useWsComposeAids({
    specLink: draft.specLink,
    workspaceId,
    socketioFlavor,
    setDraft,
    onApplied: onExampleApplied,
  });
  const args = useSocketIoArgs(socketioFlavor, draft.message, setDraft);
  // A binary compose gates Send (button and chord) on its byte spelling
  // decoding — the MQTT publish law; text modes always pass.
  const encodingError =
    !socketioFlavor && draft.messageFormat === 'binary'
      ? binaryEncodingError(draft.message, draft.binaryEncoding)
      : null;

  // Events-tab display filter: with at least one NAMED row, the
  // timeline shows only the listened incoming events (rows compare by
  // literal name — templates stay as typed). No named rows = no
  // filter; the capture itself is never touched.
  const listenedEvents = useMemo((): readonly string[] | null => {
    if (!socketioFlavor) return null;
    const named = draft.events.filter((r) => r.name.trim() !== '');
    if (named.length === 0) return null;
    return named.filter((r) => r.listen !== false).map((r) => r.name.trim());
  }, [socketioFlavor, draft.events]);

  // ⌘/Ctrl+Enter connects from anywhere in the editor — the same gate
  // as the Connect button, and the same MORPH: while the session is
  // in flight the chord disconnects. ⌘/Ctrl+Shift+Enter sends the
  // compose text — a dead key outside an open session. Capture phase
  // so the chords win inside the Monaco message editor too.
  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'Enter') return;
      if (e.shiftKey) {
        if (!session.sessionOpen || encodingError !== null) return;
        e.preventDefault();
        e.stopPropagation();
        void session.handleSendMessage();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (session.inFlight) {
        session.handleDisconnect();
        return;
      }
      if (session.connectDisabledReason !== null) return;
      void session.handleConnect();
    },
    [session, encodingError],
  );

  // "Save message" from a timeline row — the frame's payload becomes a
  // new saved row (a template, direction-free): a text frame as its
  // decoded text (JSON when it parses), a binary frame as base64. The
  // row is NOT selected: selecting loads a row into the compose, and
  // the user's draft must survive a save. The rail opens as feedback.
  const saveTimelineMessage = useCallback(
    (item: { dataBase64: string; binary: boolean }) => {
      const uid = generateUid();
      rawSetDraft((d) => {
        const name = nextSavedMessageName(d.savedMessages, t('workbench.editors.websocket.saved.defaultName'));
        const row = savedMessageFromFrame(item, uid, name);
        return { ...d, savedMessages: [...d.savedMessages, row] };
      });
      setRailCollapsed(false);
      setActiveTab('message');
    },
    [t],
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

  // Header consolidates the full target row (the gRPC editor's
  // discipline): scheme lock + URL in the title slot, Connect in the
  // actions slot next to the standardized Save. Where a session
  // cannot run, Connect stays a visible DISABLED affordance with the
  // honest gate copy — never a hidden button.
  // The target row and the Connect-time tabs freeze while the session
  // is in flight — their values were snapshotted at Connect.
  const headerTitle = (
    <SessionLock locked={session.inFlight}>
      <WsTargetRow draft={draft} setDraft={setDraft} socketioFlavor={socketioFlavor} />
    </SessionLock>
  );

  // Connect morphs while the session is in flight — the Invoke→Stop
  // treatment verbatim: solid on the darkened error token with the
  // square stop glyph, the caret on the idle button. The label stays
  // HONEST across the phases: Cancel while the attempt is still
  // connecting, Disconnect only once the session is actually open
  // (both close the same send).
  const inFlightLabel = session.sessionOpen
    ? t('workbench.editors.websocket.connect.disconnect')
    : t('workbench.editors.websocket.connect.cancel');
  const headerActions = session.inFlight ? (
    <Tooltip
      placement="bottom"
      title={<ShortcutHintTitle label={CONNECT_SHORTCUT}>{inFlightLabel}</ShortcutHintTitle>}
    >
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
          onClick={session.handleDisconnect}
          style={{ fontSize: 11 }}
          data-testid="websocket-connect-button"
        >
          {inFlightLabel}
        </Button>
      </ConfigProvider>
    </Tooltip>
  ) : (
    <Tooltip
      placement="bottom"
      title={
        session.connectDisabledReason ?? (
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
          icon={<CaretRightOutlined />}
          disabled={session.connectDisabledReason !== null}
          onClick={() => void session.handleConnect()}
          style={{ fontSize: 11 }}
          data-testid="websocket-connect-button"
        >
          {t('workbench.editors.websocket.connect.label')}
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
                      { key: 'params', label: t('workbench.editors.websocket.tab.params') },
                      ...(socketioFlavor
                        ? [{ key: 'events', label: t('workbench.editors.websocket.tab.events') }]
                        : []),
                      { key: 'auth', label: t('workbench.editors.websocket.tab.auth') },
                      { key: 'headers', label: t('workbench.editors.websocket.tab.headers') },
                      { key: 'settings', label: t('workbench.editors.websocket.tab.settings') },
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
                      <WsMessageTab
                        draft={draft}
                        setDraft={setDraft}
                        socketioFlavor={socketioFlavor}
                        sessionOpen={session.sessionOpen}
                        args={args}
                        aids={aids}
                        encodingError={encodingError}
                        onSend={() => void session.handleSendMessage()}
                        selectedSavedUid={savedSelection.selectedSavedUid}
                        onSelectSavedMessage={savedSelection.selectSavedMessage}
                        railCollapsed={railCollapsed}
                        onRailCollapsedChange={setRailCollapsed}
                      />
                    )}
                    {activeTab === 'events' && socketioFlavor && (
                      <WsEventsTab rows={draft.events} onChange={(events) => setDraft((d) => ({ ...d, events }))} />
                    )}
                    {/* Connect-time surfaces — what the handshake carries —
                      freeze while a session is in flight; compose, events,
                      docs and spec stay live. */}
                    <SessionLock locked={session.inFlight}>
                      {activeTab === 'auth' && (
                        <WebSocketAuthTab
                          auth={draft.auth}
                          socketioFlavor={socketioFlavor}
                          onChange={(auth) => setDraft((d) => ({ ...d, auth }))}
                        />
                      )}
                      {activeTab === 'headers' && (
                        <WsHeadersTab
                          rows={draft.headers}
                          onChange={(headers) => setDraft((d) => ({ ...d, headers }))}
                        />
                      )}
                      {activeTab === 'params' && (
                        <WsParamsTab rows={draft.params} onChange={(params) => setDraft((d) => ({ ...d, params }))} />
                      )}
                    </SessionLock>
                    {activeTab === 'spec' && (
                      <WsSpecTab
                        aids={aids}
                        onLinkSpec={(specUid) => setDraft((d) => ({ ...d, specLink: { specUid } }))}
                      />
                    )}
                    {activeTab === 'settings' && (
                      <SessionLock locked={session.inFlight}>
                        <WebSocketSettingsTab draft={draft} setDraft={setDraft} socketioFlavor={socketioFlavor} />
                      </SessionLock>
                    )}
                  </div>
                </div>
              </div>
            </Allotment.Pane>
            <Allotment.Pane minSize={120}>
              {session.live !== null || session.snapshot !== null ? (
                <WsSessionPane
                  live={session.live}
                  snapshot={session.snapshot}
                  timing={session.timing}
                  hostNotice={session.hostNotice}
                  flavor={entity.flavor}
                  {...(listenedEvents !== null ? { listenedEvents } : {})}
                  onClear={session.handleClearSession}
                  onReconnect={() => void session.handleConnect()}
                  onSaveMessage={saveTimelineMessage}
                  {...(session.canSaveResponse ? { onSaveResponse: () => void session.handleSaveResponse() } : {})}
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
                    }}
                  >
                    <Text strong style={{ fontSize: 12 }}>
                      {t('workbench.editors.websocket.session.paneTitle')}
                    </Text>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      minHeight: 0,
                      padding: 24,
                      textAlign: 'center',
                    }}
                    data-testid="ws-session-empty"
                  >
                    <CaretRightOutlined style={{ fontSize: 20, color: token.colorTextQuaternary }} />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('workbench.editors.websocket.session.emptyHint')}
                    </Text>
                    <ShortcutKbd label={CONNECT_SHORTCUT} surface="page" size={22} />
                  </div>
                </div>
              )}
            </Allotment.Pane>
          </Allotment>
        </div>

      </div>
    </EntityScopeProvider>
  );
};

export default WebSocketRequestEditor;
