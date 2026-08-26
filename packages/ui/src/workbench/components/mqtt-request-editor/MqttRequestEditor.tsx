/**
 * MqttRequestEditor — tab body for one MqttRequest entity; the
 * ORCHESTRATOR over the editor's modules, one concern per file:
 *
 *   - `useMqttSessionPlane` — Connect/Disconnect on the
 *     `executeMqttRequest` channel (node hosts + `mqttPageSession`
 *     page-realm surfaces, honesty gates included), the live session
 *     feed, publish + live Subscribe riders, Save Response.
 *   - `useMqttComposeAids` — the AsyncAPI specLink census and its
 *     compose aids (example picker, channel browser).
 *   - `useMqttSavedSelection` — the Saved-messages selection plane:
 *     the compose is the selected row's editor and user edits write
 *     through to it (the bound draft setter every tab rides).
 *   - `MqttTargetRow` — version + scheme + URL header title (the
 *     version knob locks while a session is in flight).
 *   - `MqttMessageTab` (compose bar + collapsible Saved-messages
 *     rail) / `MqttTopicsTab` / `MqttAuthTab` / `MqttLastWillTab` /
 *     `MqttSpecTab` / `MqttSettingsTab` — the compose tabs (Docs and
 *     the CONNECT user-properties grid ride shared components inline).
 *   - `compose.ts` — ENCODING→language map, scheme surgery, the
 *     compose publish wire.
 *
 * This file keeps what genuinely spans them: the draft + derived-dirty
 * reprime + prefill hand-off, the ⌘/Ctrl+Enter chord plane, the editor
 * shell/save, the header (target row + Connect/Disconnect morph), the
 * compose/session Allotment split with the always-attached session
 * pane, and the spec footer.
 *
 * 3.1.1 renders every 5.0-only surface disabled-honest (the encode-
 * strict codec law surfaced at the editor). Dirty derives from
 * form-vs-canonical equality via `useReprime` (never setDirty); saves
 * flow through the RequestsContext's `updateMqttRequest`.
 */

import { CaretRightOutlined } from '@ant-design/icons';
import { MQTT_REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import type { MqttRequest as MqttRequestEntity } from '@openheaders/core/types';
import { ShortcutHintTitle, ShortcutKbd } from '@openheaders/ui/components/ShortcutKbd';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityScopeProvider } from '@openheaders/ui/shared/awareness';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { isMac } from '@openheaders/ui/shared/platform';
import { Allotment } from 'allotment';
import { App, Badge, Button, ConfigProvider, Tabs, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import DocsTab from '../request-editor/DocsTab';
import KeyValueTable from '../request-editor/KeyValueTable';
import EditorHeader from '../shell/EditorHeader';
import { composePublishWire } from './compose';
import {
  buildMqttRequestUpdates,
  canonicalMqttRequestProjection,
  draftFromMqttRequest,
  emptyLastWillDraft,
  emptyMessagePropertiesDraft,
  type MqttDraft,
  payloadEncodingError,
  propertiesToDraft,
} from './draft';
import { subscribeMqttPrefill } from './mqtt-prefill-bus';
import MqttAuthTab from './MqttAuthTab';
import MqttLastWillTab from './MqttLastWillTab';
import MqttMessageTab from './MqttMessageTab';
import MqttSessionPane from './MqttSessionPane';
import MqttSettingsTab from './MqttSettingsTab';
import MqttSpecTab from './MqttSpecTab';
import MqttTargetRow from './MqttTargetRow';
import MqttTopicsTab from './MqttTopicsTab';
import { useMqttComposeAids } from './useMqttComposeAids';
import { useMqttSavedSelection } from './useMqttSavedSelection';
import { useMqttSessionPlane } from './useMqttSessionPlane';

const { Text } = Typography;

const CONNECT_SHORTCUT = isMac ? '⌘↵' : 'Ctrl+Enter';

interface MqttRequestEditorProps {
  mqttRequestUid: string;
  workspaceId: string | null;
  /** "Save Response" landed — open the minted example's viewer tab. */
  onOpenMqttResponseExample?: (uid: string, name: string, mqttRequestUid: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

const emptyMqttDraft = (): MqttDraft => ({
  description: '',
  url: '',
  protocolVersion: '5.0',
  topic: '',
  payload: '',
  payloadFormat: 'text',
  qos: 0,
  retain: false,
  publishProperties: emptyMessagePropertiesDraft(),
  topics: [],
  savedMessages: [],
  userProperties: [],
  auth: { type: 'none' },
  lastWill: emptyLastWillDraft(),
  specLink: undefined,
  clientId: '',
  cleanStart: true,
  sessionExpiryInterval: undefined,
  keepAlive: undefined,
  receiveMaximum: undefined,
  maximumPacketSize: undefined,
  topicAliasMaximum: undefined,
  requestResponseInformation: false,
  requestProblemInformation: true,
  timeoutMs: undefined,
  sslVerification: true,
  clientCertificateRef: undefined,
  sniServerName: undefined,
  alpnProtocol: undefined,
});

const MqttRequestEditor: React.FC<MqttRequestEditorProps> = ({
  mqttRequestUid,
  workspaceId,
  onOpenMqttResponseExample,
  onDirtyChange,
  registerSaveRef,
}) => {
  const { token } = theme.useToken();
  const { message: toast } = App.useApp();
  const t = useT();
  const { mqttRequests, updateMqttRequest } = useRequests();

  const entity = useMemo(() => mqttRequests.find((r) => r.uid === mqttRequestUid) ?? null, [mqttRequests, mqttRequestUid]);

  const [draft, rawSetDraft] = useState<MqttDraft>(() => (entity ? draftFromMqttRequest(entity) : emptyMqttDraft()));
  const [activeTab, setActiveTab] = useState('message');

  // Saved-messages selection plane: the compose is the selected row's
  // editor. Every USER edit below rides the bound setter (compose
  // edits write through to the selected row); sync repopulates stay
  // RAW — reprime must never fabricate edits.
  const savedSelection = useMqttSavedSelection(draft, rawSetDraft);
  const setDraft = savedSelection.setBoundDraft;

  const formFingerprint = useMemo(() => stableStringify(buildMqttRequestUpdates(draft)), [draft]);

  const reprime = useReprime({
    liveEntity: entity,
    scope: { entityType: MQTT_REQUEST_ENTITY_TYPE, entityId: entity?.uid ?? null },
    enabled: entity !== null,
    formFingerprint,
    signature: (e: MqttRequestEntity) => stableStringify(canonicalMqttRequestProjection(e)),
    populate: (e: MqttRequestEntity) => rawSetDraft(draftFromMqttRequest(e)),
  });
  const isDirty = reprime.isDirty;

  const v5 = draft.protocolVersion === '5.0';

  // "Open in Request" prefill — a saved example's captured request
  // block lands as unsaved draft edits (the gRPC prefill flow; the
  // version knob rides along as the capture's fact).
  useEffect(() => {
    if (!entity) return;
    return subscribeMqttPrefill(entity.uid, (captured) => {
      setDraft((d) => ({
        ...d,
        url: captured.url,
        protocolVersion: captured.protocolVersion,
        topic: captured.topic,
        payload: captured.payload,
        payloadFormat: captured.payloadFormat,
        qos: captured.qos,
        retain: captured.retain,
        publishProperties: propertiesToDraft(captured.publishProperties),
        topics: captured.topics.map((row) => ({ ...row })),
        clientId: captured.clientId ?? '',
        sslVerification: captured.sslVerification,
        timeoutMs: captured.timeoutMs,
      }));
    });
  }, [entity]);

  // ── Session plane + compose aids ─────────────────────────────────
  const session = useMqttSessionPlane({ entity, draft, workspaceId, v5, onOpenMqttResponseExample });
  const onExampleApplied = useCallback(() => setActiveTab('message'), []);
  const aids = useMqttComposeAids({ specLink: draft.specLink, workspaceId, setDraft, onApplied: onExampleApplied });

  const encodingError = payloadEncodingError(draft.payload, draft.payloadFormat);

  // Live subscribed-topics count for the session pane's summary
  // affordance — SUBACK-granted rows plus live toggles, the honest
  // live state (never the draft's switch positions).
  const subscribedTopicsCount = useMemo(() => {
    let count = 0;
    for (const mark of session.liveSubs.values()) if (mark.subscribed) count++;
    return count;
  }, [session.liveSubs]);
  const handleShowTopics = useCallback(() => setActiveTab('topics'), []);

  // ⌘/Ctrl+Enter connects from anywhere in the editor — the same gate
  // as the Connect button, and the same MORPH: while the session is
  // in flight the chord disconnects. ⌘/Ctrl+Shift+Enter publishes the
  // compose — a dead key outside an open session or on a malformed
  // payload. Capture phase so the chords win inside Monaco too.
  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'Enter') return;
      if (e.shiftKey) {
        if (!session.sessionOpen || encodingError !== null) return;
        e.preventDefault();
        e.stopPropagation();
        void session.handlePublish(composePublishWire(draft));
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
    [session, encodingError, draft],
  );

  // ── Save ─────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!entity || !isDirty) return;
    const result = await updateMqttRequest(entity.uid, buildMqttRequestUpdates(draft));
    if (result.ok) return;
    if (result.reason === 'not-found') {
      toast.error(t('workbench.editors.mqtt.toast.deletedOtherTab'));
    } else {
      toast.error(
        result.message
          ? t('workbench.editors.mqtt.toast.updateFailedDetail', { message: result.message })
          : t('workbench.editors.mqtt.toast.updateFailed'),
      );
    }
  }, [entity, isDirty, draft, updateMqttRequest, toast, t]);

  const handleSaveSync = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  const shell = useEditorShell({
    entityType: MQTT_REQUEST_ENTITY_TYPE,
    entityId: entity?.uid ?? null,
    isDirty,
    onSave: handleSaveSync,
    onDirtyChange,
    registerSaveRef,
  });

  if (!entity) {
    return (
      <div style={{ padding: 24, background: token.colorBgContainer }}>
        <Text type="secondary">{t('workbench.editors.mqtt.notFound')}</Text>
      </div>
    );
  }

  // Header consolidates the full target row (the WS editor's
  // discipline): version + scheme + URL in the title slot, Connect in
  // the actions slot next to the standardized Save. Where a session
  // cannot run, Connect stays a visible DISABLED affordance with the
  // honest gate copy — never a hidden button.
  const headerTitle = <MqttTargetRow draft={draft} setDraft={setDraft} inFlight={session.inFlight} />;

  // Connect morphs while the session is in flight — the Invoke→Stop
  // treatment verbatim: solid on the darkened error token with the
  // square stop glyph; Connect carries the caret the Invoke button
  // wears. The label stays HONEST across the phases: Cancel while the
  // attempt is still connecting, Disconnect only once the session is
  // actually open (both close the same send).
  const inFlightLabel = session.sessionOpen
    ? t('workbench.editors.mqtt.connect.disconnect')
    : t('workbench.editors.mqtt.connect.cancel');
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
          data-testid="mqtt-connect-button"
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
          <ShortcutHintTitle label={CONNECT_SHORTCUT}>{t('workbench.editors.mqtt.connect.label')}</ShortcutHintTitle>
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
          data-testid="mqtt-connect-button"
        >
          {t('workbench.editors.mqtt.connect.label')}
        </Button>
      </span>
    </Tooltip>
  );

  const willConfigured = draft.lastWill.topic.trim() !== '';

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
        {aids.linkedSpec
          ? t('workbench.editors.mqtt.specFooter.using', { name: aids.linkedSpec.name })
          : t('workbench.editors.mqtt.specFooter.none')}
      </Text>
      {aids.census.census !== null && aids.census.census.issues.length > 0 && (
        <Text type="warning" style={{ fontSize: 11 }}>
          {t('workbench.editors.mqtt.spec.issues', { count: aids.census.census.issues.length })}
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

        {/* Compose / session split — the WS editor's stacked Allotment
          discipline: the sash bounds the compose surface, and the
          session pane is always attached (empty-state hint before the
          first connect). */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <Allotment vertical proportionalLayout separator>
            <Allotment.Pane minSize={220} preferredSize="55%">
              <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '0 12px' }}>
                  <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    size="small"
                    tabBarStyle={{ marginBottom: 0 }}
                    items={[
                      { key: 'docs', label: t('workbench.editors.mqtt.tab.docs') },
                      { key: 'message', label: t('workbench.editors.mqtt.tab.message') },
                      { key: 'topics', label: t('workbench.editors.mqtt.tab.topics') },
                      { key: 'auth', label: t('workbench.editors.mqtt.tab.auth') },
                      { key: 'properties', label: t('workbench.editors.mqtt.tab.properties') },
                      {
                        key: 'lastwill',
                        label: willConfigured ? (
                          <Badge dot offset={[4, 0]}>
                            {t('workbench.editors.mqtt.tab.lastWill')}
                          </Badge>
                        ) : (
                          t('workbench.editors.mqtt.tab.lastWill')
                        ),
                      },
                      { key: 'spec', label: t('workbench.editors.mqtt.tab.spec') },
                      { key: 'settings', label: t('workbench.editors.mqtt.tab.settings') },
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
                      <MqttMessageTab
                        draft={draft}
                        setDraft={setDraft}
                        v5={v5}
                        sessionOpen={session.sessionOpen}
                        encodingError={encodingError}
                        selectedSavedUid={savedSelection.selectedSavedUid}
                        onSelectSavedMessage={savedSelection.selectSavedMessage}
                        aids={aids}
                        onPublish={(message) => void session.handlePublish(message)}
                      />
                    )}
                    {activeTab === 'topics' && (
                      <MqttTopicsTab
                        rows={draft.topics}
                        onChange={(topics) => setDraft((d) => ({ ...d, topics }))}
                        v5={v5}
                        sessionOpen={session.sessionOpen}
                        liveSubs={session.liveSubs}
                        onLiveToggle={(row, subscribe) => void session.handleLiveSubscriptionToggle(row, subscribe)}
                      />
                    )}
                    {activeTab === 'auth' && (
                      <MqttAuthTab auth={draft.auth} onChange={(auth) => setDraft((d) => ({ ...d, auth }))} />
                    )}
                    {activeTab === 'properties' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="mqtt-user-props">
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {v5 ? t('workbench.editors.mqtt.userProps.hint') : t('workbench.editors.mqtt.userProps.v311')}
                        </Text>
                        <div style={v5 ? undefined : { opacity: 0.55, pointerEvents: 'none' }} aria-disabled={!v5}>
                          <KeyValueTable
                            rows={draft.userProperties}
                            onChange={(userProperties) => setDraft((d) => ({ ...d, userProperties }))}
                            keyPlaceholder={t('workbench.editors.mqtt.userProps.keyPlaceholder')}
                            valuePlaceholder={t('workbench.editors.mqtt.userProps.valuePlaceholder')}
                          />
                        </div>
                      </div>
                    )}
                    {activeTab === 'lastwill' && <MqttLastWillTab draft={draft} setDraft={setDraft} v5={v5} />}
                    {activeTab === 'spec' && (
                      <MqttSpecTab
                        aids={aids}
                        onLinkSpec={(specUid) => setDraft((d) => ({ ...d, specLink: { specUid } }))}
                      />
                    )}
                    {activeTab === 'settings' && <MqttSettingsTab draft={draft} setDraft={setDraft} v5={v5} />}
                  </div>
                </div>
              </div>
            </Allotment.Pane>
            <Allotment.Pane minSize={120}>
              {session.live !== null || session.snapshot !== null ? (
                <MqttSessionPane
                  live={session.live}
                  snapshot={session.snapshot}
                  timing={session.timing}
                  protocolVersion={draft.protocolVersion}
                  hostNotice={session.hostNotice}
                  onClear={session.handleClearSession}
                  subscribedTopicsCount={subscribedTopicsCount}
                  onShowTopics={handleShowTopics}
                  {...(session.canSaveResponse ? { onSaveResponse: () => void session.handleSaveResponse() } : {})}
                />
              ) : (
                // Always-attached response pane before the first
                // session — the gRPC empty-state posture verbatim:
                // Response title row, centered caret + hint + the
                // Connect chord.
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
                      {t('workbench.editors.mqtt.session.emptyTitle')}
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
                    data-testid="mqtt-session-empty"
                  >
                    <CaretRightOutlined style={{ fontSize: 20, color: token.colorTextQuaternary }} />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('workbench.editors.mqtt.session.emptyHint')}
                    </Text>
                    <ShortcutKbd label={CONNECT_SHORTCUT} surface="page" size={22} />
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

export default MqttRequestEditor;
