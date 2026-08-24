/**
 * MqttRequestEditor — tab body for one MqttRequest entity.
 *
 * Editor shell: version select (V5 default / V3.1.1) + scheme select
 * (mqtt/mqtts/ws/wss string surgery) + URL in the header title slot.
 * Tabs: Docs / Message / Topics / Authorization (shell — a later phase
 * wires Basic auth) / Properties / Last Will / AsyncAPI / Settings.
 *
 * The Message tab is the publish compose: payload editor with the
 * Text / JSON / Base64 / Hexadecimal ENCODING select (base64/hex
 * author BINARY payloads — invalid input gates Send honestly, unlike
 * the WebSocket display-only format toggle), topic input, QoS menu,
 * Retain, the per-message 5.0 properties popover, and the
 * Saved-messages rail (synced entity rows; clicking one loads the
 * compose; Send-from-row publishes while the session is open).
 *
 * Connect opens the live session through the `executeMqttRequest`
 * channel — answered in-process on node hosts (`requestRuntime`), and
 * IN the page realm on surfaces carrying the `mqttPageSession`
 * capability (the extension workbench: MQTT-over-WebSocket on the
 * platform socket, so ws(s):// URLs connect; mqtt(s):// tcp schemes
 * render the honest named affordance — never a silent downgrade to ws
 * — and configured node-only knobs (SSL verification off) surface in
 * the session pane's Connect-side honesty notice). A browser surface
 * without the capability keeps the honest disabled posture. The editor
 * publishes a page-session resolution factory while mounted
 * (`mqtt-page-session.ts`) so the page host resolves {{refs}} from the
 * renderer scopes. In flight Connect MORPHS to Disconnect (the clean
 * DISCONNECT via the `closeMqttSession` rider), the Message tab's
 * Send publishes the compose through `publishMqttMessage` — enabled
 * only while the session is open and the payload encoding is valid —
 * and the Topics grid's Subscribe switches ride the
 * `setMqttSubscription` rider, marking each row with its SUBACK grant
 * (QoS downgrades honest): the stored table stays the DRAFT, live
 * toggles never edit the entity (the ratified publication-gate
 * idiom). Compose and result stack in a vertical Allotment split (the
 * WS editor's discipline): the result pane is always attached —
 * empty-state hint before the first connect, `MqttSessionPane` with
 * the live timeline while open, the settled snapshot's capture after.
 *
 * 3.1.1 renders every 5.0-only surface disabled-honest (the encode-
 * strict codec law surfaced at the editor): CONNECT user properties,
 * per-message/will property popovers, per-subscription options, and
 * the 5.0 connect knobs.
 *
 * Dirty derives from form-vs-canonical equality via `useReprime`
 * (never setDirty); saves flow through the RequestsContext's
 * `updateMqttRequest` (the MQTT write client under the hood).
 */

import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DisconnectOutlined,
  LinkOutlined,
  MoreOutlined,
  PlusOutlined,
  SendOutlined,
} from '@ant-design/icons';
import {
  AsyncApiParseError,
  parseAsyncApi,
  synthesizeExamplePayload,
  type AsyncApiCensus,
  type AsyncApiMessage,
} from '@openheaders/core/asyncapi';
import { hostBridge, type MqttPublishWire } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import { topicFilterError } from '@openheaders/core/mqtt';
import { MAX_REQUEST_TIMEOUT_MS, MIN_REQUEST_TIMEOUT_MS } from '@openheaders/core/schemas';
import { MQTT_REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import type {
  ExecutedMqttSnapshot,
  MqttPayloadFormat,
  MqttRequest as MqttRequestEntity,
  MqttRequestQos,
  MqttRetainHandling,
  MqttSavedMessage,
  MqttTopicRow,
} from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { useT, type Translate } from '@openheaders/ui/context/LocaleContext';
import { EntityScopeProvider } from '@openheaders/ui/shared/awareness';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useSpecs } from '@openheaders/ui/shared/hooks/readers/useSpecs';
import { useVariableResolverInputs } from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import { isMac } from '@openheaders/ui/shared/platform';
import { getMqttResponseExampleSyncMirrorForWorkspace } from '@openheaders/ui/context/mirrors/mqtt-response-example-sync-mirror';
import {
  applyMqttResponseExampleCreate,
  nextMqttExampleName,
} from '@openheaders/ui/shared/sync/mqtt-response-example-write-client';
import { Allotment } from 'allotment';
import {
  App,
  Badge,
  Button,
  Checkbox,
  ConfigProvider,
  Dropdown,
  Input,
  InputNumber,
  Popover,
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
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LanguageId } from '@openheaders/ui/workbench/languages/registry';
import CodeEditor from '../shared/CodeEditor';
import CodeEditorActions, { type CodeEditorActionsTarget } from '../shared/CodeEditorActions';
import EditorViewMenu from '../shared/EditorViewMenu';
import DocsTab from '../request-editor/DocsTab';
import { EditableGridTable } from '../request-editor/EditableGridTable';
import type { EditableRowAdapter } from '../request-editor/editable-grid-types';
import KeyValueTable from '../request-editor/KeyValueTable';
import EditorHeader from '../shell/EditorHeader';
import {
  capturedMqttRequestFromDraft,
  capturedMqttResponseFromSnapshot,
} from '../mqtt-response-example/mqtt-example-draft';
import {
  buildMqttRequestUpdates,
  canonicalMqttRequestProjection,
  draftFromMqttRequest,
  draftToProperties,
  emptyLastWillDraft,
  emptyMessagePropertiesDraft,
  type MqttDraft,
  type MqttMessagePropertiesDraft,
  payloadEncodingError,
  propertiesToDraft,
  trimTopicRows,
} from './draft';
import { subscribeMqttPrefill } from './mqtt-prefill-bus';
import { grantLabel } from './session-display';
import { makeMqttPageResolutionFactory, publishMqttPageResolutionFactory } from './mqtt-page-session';
import MqttSessionPane from './MqttSessionPane';
import { useLiveMqttSession, type MqttSessionTiming } from './useLiveMqttSession';

const { Text } = Typography;

const CONNECT_SHORTCUT = isMac ? '⌘↵' : 'Ctrl+Enter';
const SEND_MESSAGE_SHORTCUT = isMac ? '⇧⌘↵' : 'Ctrl+Shift+Enter';

/** One row's live SUBACK/UNSUBACK truth while the session is open —
 *  the stored table stays the draft; this map marks it. */
interface LiveSubscriptionMark {
  subscribed: boolean;
  grantCode: number | null;
}

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
  lastWill: emptyLastWillDraft(),
  specLink: undefined,
  clientId: '',
  cleanStart: true,
  sessionExpiryInterval: undefined,
  keepAlive: undefined,
  receiveMaximum: undefined,
  maximumPacketSize: undefined,
  timeoutMs: undefined,
  sslVerification: true,
});

/** Monaco language per compose ENCODING — base64/hex author plain text. */
const PAYLOAD_FORMAT_LANGUAGE = {
  text: 'text',
  json: 'json',
  base64: 'text',
  hex: 'text',
} as const satisfies Record<MqttPayloadFormat, LanguageId>;

const MQTT_SCHEMES = ['mqtt', 'mqtts', 'ws', 'wss'] as const;
type MqttScheme = (typeof MQTT_SCHEMES)[number];

const schemeOf = (url: string): MqttScheme => {
  for (const scheme of ['mqtts', 'mqtt', 'wss', 'ws'] as const) {
    if (url.startsWith(`${scheme}://`)) return scheme;
  }
  return 'mqtt';
};

/** Rewrite the URL's scheme prefix — string surgery on the draft URL
 *  only (templates and schemeless authorities stay as typed). */
const withScheme = (url: string, scheme: MqttScheme): string => {
  for (const existing of ['mqtts', 'mqtt', 'wss', 'ws'] as const) {
    if (url.startsWith(`${existing}://`)) return `${scheme}://${url.slice(existing.length + 3)}`;
  }
  return `${scheme}://${url}`;
};

/** Topics-grid row adapter — the topic filter rides the key track; the
 *  QoS / Subscribe / options cluster lives in the value cell. */
const TOPIC_ROW_ADAPTER: EditableRowAdapter<MqttTopicRow> = {
  getId: (r) => r.uid,
  getEnabled: () => true,
  setEnabled: (r) => r,
  getKey: (r) => r.topicFilter,
  setKey: (r, v) => ({ ...r, topicFilter: v }),
  getDescription: (r) => r.description ?? '',
  setDescription: (r, v) => ({ ...r, description: v }),
  makeEmpty: () => ({ uid: generateUid(), topicFilter: '' }),
  isEmpty: (r) => !r.topicFilter && !r.description,
};

const QOS_OPTIONS = (t: Translate) => [
  { value: 0, label: t('workbench.editors.mqtt.qos.q0') },
  { value: 1, label: t('workbench.editors.mqtt.qos.q1') },
  { value: 2, label: t('workbench.editors.mqtt.qos.q2') },
];

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

/**
 * Per-message 5.0 properties popover — the "⋯" on the publish compose
 * and the Last Will tab. 3.1.1 renders the controls disabled with the
 * honest version line (never a silent drop — the codec is
 * encode-strict either way).
 */
const MessagePropertiesPopover: React.FC<{
  value: MqttMessagePropertiesDraft;
  onChange: (next: MqttMessagePropertiesDraft) => void;
  v5: boolean;
  testId: string;
}> = ({ value, onChange, v5, testId }) => {
  const t = useT();
  const configured =
    value.userProperties.some((row) => row.key.trim() !== '') ||
    value.responseTopic !== '' ||
    value.correlationData !== '' ||
    value.messageExpiryInterval !== undefined ||
    value.contentType !== '' ||
    value.payloadFormatIndicator;
  const set = (patch: Partial<MqttMessagePropertiesDraft>) => onChange({ ...value, ...patch });
  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 340 }} data-testid={`${testId}-popover`}>
      <Text type="secondary" style={{ fontSize: 11 }}>
        {v5 ? t('workbench.editors.mqtt.props.hint') : t('workbench.editors.mqtt.props.v311')}
      </Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {value.userProperties.map((row, index) => (
          <div key={row.uid} style={{ display: 'flex', gap: 4 }}>
            <Input
              size="small"
              placeholder={t('workbench.editors.mqtt.props.userPropKey')}
              value={row.key}
              disabled={!v5}
              onChange={(e) => {
                const next = [...value.userProperties];
                next[index] = { ...row, key: e.target.value };
                set({ userProperties: next });
              }}
            />
            <Input
              size="small"
              placeholder={t('workbench.editors.mqtt.props.userPropValue')}
              value={row.value}
              disabled={!v5}
              onChange={(e) => {
                const next = [...value.userProperties];
                next[index] = { ...row, value: e.target.value };
                set({ userProperties: next });
              }}
            />
            <Button
              size="small"
              type="text"
              disabled={!v5}
              aria-label={t('workbench.editors.mqtt.props.removeUserProp')}
              onClick={() => set({ userProperties: value.userProperties.filter((r) => r.uid !== row.uid) })}
            >
              ×
            </Button>
          </div>
        ))}
        <Button
          size="small"
          type="dashed"
          icon={<PlusOutlined style={{ fontSize: 10 }} />}
          disabled={!v5}
          style={{ fontSize: 11, alignSelf: 'flex-start' }}
          onClick={() => set({ userProperties: [...value.userProperties, { uid: generateUid(), key: '', value: '' }] })}
          data-testid={`${testId}-add-user-prop`}
        >
          {t('workbench.editors.mqtt.props.addUserProp')}
        </Button>
      </div>
      <Input
        size="small"
        addonBefore={t('workbench.editors.mqtt.props.responseTopic')}
        value={value.responseTopic}
        disabled={!v5}
        onChange={(e) => set({ responseTopic: e.target.value })}
        data-testid={`${testId}-response-topic`}
      />
      <Input
        size="small"
        addonBefore={t('workbench.editors.mqtt.props.correlationData')}
        value={value.correlationData}
        disabled={!v5}
        onChange={(e) => set({ correlationData: e.target.value })}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
          {t('workbench.editors.mqtt.props.messageExpiry')}
        </Text>
        <InputNumber
          size="small"
          min={0}
          max={0xffff_ffff}
          value={value.messageExpiryInterval}
          disabled={!v5}
          onChange={(next) => set({ messageExpiryInterval: next ?? undefined })}
          style={{ width: 120 }}
        />
      </div>
      <Input
        size="small"
        addonBefore={t('workbench.editors.mqtt.props.contentType')}
        value={value.contentType}
        disabled={!v5}
        onChange={(e) => set({ contentType: e.target.value })}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Switch
          size="small"
          checked={value.payloadFormatIndicator}
          disabled={!v5}
          onChange={(payloadFormatIndicator) => set({ payloadFormatIndicator })}
        />
        <Text type="secondary" style={{ fontSize: 11 }}>
          {t('workbench.editors.mqtt.props.payloadFormatIndicator')}
        </Text>
      </div>
    </div>
  );
  return (
    <Popover content={content} trigger="click" placement="topRight">
      <Tooltip title={t('workbench.editors.mqtt.props.buttonTooltip')}>
        <Badge dot={configured} offset={[-2, 2]}>
          <Button size="small" icon={<MoreOutlined />} data-testid={testId} />
        </Badge>
      </Tooltip>
    </Popover>
  );
};

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
  const { mqttRequests, updateMqttRequest, executeMqtt } = useRequests();
  const specs = useSpecs(workspaceId);

  const entity = useMemo(() => mqttRequests.find((r) => r.uid === mqttRequestUid) ?? null, [mqttRequests, mqttRequestUid]);

  const [draft, setDraft] = useState<MqttDraft>(() => (entity ? draftFromMqttRequest(entity) : emptyMqttDraft()));
  const [activeTab, setActiveTab] = useState('message');
  const [renamingSavedUid, setRenamingSavedUid] = useState<string | null>(null);
  // Compose-editor wrap — a per-pane override of the global setting,
  // ON by default (payloads are prose-like; scrolling hides the tail).
  const [wrapPayload, setWrapPayload] = useState(true);
  const payloadActionsRef = useRef<CodeEditorActionsTarget | null>(null);

  const formFingerprint = useMemo(() => stableStringify(buildMqttRequestUpdates(draft)), [draft]);

  const reprime = useReprime({
    liveEntity: entity,
    scope: { entityType: MQTT_REQUEST_ENTITY_TYPE, entityId: entity?.uid ?? null },
    enabled: entity !== null,
    formFingerprint,
    signature: (e: MqttRequestEntity) => stableStringify(canonicalMqttRequestProjection(e)),
    populate: (e: MqttRequestEntity) => setDraft(draftFromMqttRequest(e)),
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

  // ── Session (node hosts + page-realm capability surfaces) ─────────
  const requestRuntimeKind = getCapability('requestRuntime')?.() ?? 'browser';
  const nodeHost = requestRuntimeKind === 'node';
  const pageSession = !nodeHost && (getCapability('mqttPageSession')?.() ?? false);
  const [inFlight, setInFlight] = useState(false);
  const [snapshot, setSnapshot] = useState<ExecutedMqttSnapshot | null>(null);
  const [timing, setTiming] = useState<MqttSessionTiming | null>(null);
  const [hostNotice, setHostNotice] = useState<string | null>(null);
  const activeSendIdRef = useRef<string | null>(null);
  const liveSession = useLiveMqttSession();

  // Page-session resolution publisher — the host executing in this
  // page realm injects the CURRENT factory into the executor at
  // Connect, so republish on every renderer-scope change while an
  // MQTT editor is mounted (nothing can Connect without one).
  const resolverInputs = useVariableResolverInputs();
  useEffect(() => {
    if (!pageSession) return;
    publishMqttPageResolutionFactory(makeMqttPageResolutionFactory(resolverInputs));
  }, [pageSession, resolverInputs]);

  // Live Subscribe-toggle truth while the session is open — keyed by
  // row uid; seeded from the open-time SUBACK items (grants positional
  // over the enabled rows, in the executor's packet order), updated by
  // each rider's own grant. The stored table stays the DRAFT.
  const [liveSubs, setLiveSubs] = useState<ReadonlyMap<string, LiveSubscriptionMark>>(new Map());
  /** The open-time SUBSCRIBE groups' row uids, in the executor's
   *  packet order: rows without a Subscription Identifier ride one
   *  packet, each identified row its own. */
  const openSubGroupsRef = useRef<string[][]>([]);
  const consumedSubGroupsRef = useRef(0);

  useEffect(() => {
    const live = liveSession.live;
    if (live === null) return;
    const groups = openSubGroupsRef.current;
    let consumed = consumedSubGroupsRef.current;
    if (consumed >= groups.length) return;
    let seen = 0;
    const marks = new Map<string, LiveSubscriptionMark>();
    for (let i = 0; i < live.count && consumed < groups.length; i++) {
      const item = live.items[i];
      if (item.kind !== 'subscribed') continue;
      if (seen < consumedSubGroupsRef.current) {
        seen++;
        continue;
      }
      const uids = groups[consumed];
      item.grants.forEach((grant, index) => {
        const uid = uids[index];
        if (uid !== undefined) marks.set(uid, { subscribed: grant.reasonCode <= 2, grantCode: grant.reasonCode });
      });
      consumed++;
      seen++;
    }
    if (marks.size === 0) return;
    consumedSubGroupsRef.current = consumed;
    setLiveSubs((prev) => {
      const next = new Map(prev);
      for (const [uid, mark] of marks) next.set(uid, mark);
      return next;
    });
  }, [liveSession.live]);

  const handleConnect = useCallback(async () => {
    if (!entity || inFlight) return;
    // The CURRENT compose state connects — saved or not (the HTTP
    // editor's draft-send law); identity fields ride along verbatim.
    const draftEntity: MqttRequestEntity = {
      schemaVersion: 5,
      uid: entity.uid,
      path: entity.path,
      name: entity.name,
      ...buildMqttRequestUpdates(draft),
    };
    // The open-time SUBSCRIBE grouping mirrors the executor's: one
    // packet for the plain rows, one per Subscription Identifier —
    // grants map back onto rows positionally within each group.
    const enabledRows = trimTopicRows(draft.topics).filter((row) => row.subscribe !== false);
    const plainUids = enabledRows.filter((row) => row.subscriptionId === undefined || !v5).map((row) => row.uid);
    const idUids = v5
      ? enabledRows.filter((row) => row.subscriptionId !== undefined).map((row) => [row.uid])
      : [];
    openSubGroupsRef.current = [...(plainUids.length > 0 ? [plainUids] : []), ...idUids];
    consumedSubGroupsRef.current = 0;
    setLiveSubs(new Map());
    // Per-knob honesty on the page-session path: the platform socket
    // cannot skip TLS verification — a CONFIGURED knob is named for
    // the session's whole life instead of silently dropping (the
    // connect deadline DOES apply here).
    const inapplicableKnobs: string[] = [];
    if (pageSession && !draft.sslVerification) {
      inapplicableKnobs.push(t('workbench.editors.mqtt.session.knobSslVerify'));
    }
    setHostNotice(
      inapplicableKnobs.length > 0
        ? t('workbench.editors.mqtt.session.hostNotice', { knobs: inapplicableKnobs.join(', ') })
        : null,
    );
    const sendId = crypto.randomUUID();
    activeSendIdRef.current = sendId;
    setInFlight(true);
    setSnapshot(null);
    setTiming(null);
    liveSession.beginSession(sendId);
    const settled = await executeMqtt({ draft: draftEntity, sendId });
    const session = liveSession.takeSession();
    setTiming(session === null ? null : { ...session, endedAt: Date.now() });
    liveSession.endSession();
    activeSendIdRef.current = null;
    setInFlight(false);
    setLiveSubs(new Map());
    if (settled === null) {
      toast.error(t('workbench.editors.mqtt.session.connectFailed'));
      return;
    }
    setSnapshot(settled);
  }, [entity, inFlight, draft, v5, pageSession, executeMqtt, liveSession, toast, t]);

  // Disconnect morphs from Connect while the session is open — the
  // clean DISCONNECT; the pending RPC above resolves with the
  // whole-session snapshot once the connection closes.
  const handleDisconnect = useCallback(() => {
    const sendId = activeSendIdRef.current;
    if (!sendId) return;
    hostBridge.call('closeMqttSession', { sendId }).catch(() => {});
  }, []);

  // Publish one compose block — the executor resolves {{refs}} through
  // the resolver it built at Connect and decodes the payload per its
  // ENCODING; a failure reports here without touching the open session.
  const handlePublish = useCallback(
    async (message: MqttPublishWire) => {
      const sendId = activeSendIdRef.current;
      if (!sendId) return;
      const result = await hostBridge.call('publishMqttMessage', { sendId, message }).catch(() => null);
      if (result === null || !result.success) {
        toast.error(result?.error ?? t('workbench.editors.mqtt.session.sendFailed'));
      }
    },
    [toast, t],
  );

  const composePublishWire = useCallback((): MqttPublishWire => {
    const properties = draftToProperties(draft.publishProperties);
    return {
      topic: draft.topic,
      payload: draft.payload,
      ...(draft.payloadFormat !== 'text' ? { format: draft.payloadFormat } : {}),
      ...(draft.qos !== 0 ? { qos: draft.qos } : {}),
      ...(draft.retain ? { retain: true } : {}),
      ...(properties !== undefined ? { properties } : {}),
    };
  }, [draft.topic, draft.payload, draft.payloadFormat, draft.qos, draft.retain, draft.publishProperties]);

  // Live Subscribe toggle — rides the rider and marks the row; the
  // stored table (the draft) is never edited while the session is open.
  const handleLiveSubscriptionToggle = useCallback(
    async (row: MqttTopicRow, subscribe: boolean) => {
      const sendId = activeSendIdRef.current;
      if (!sendId) return;
      setLiveSubs((prev) => new Map(prev).set(row.uid, { subscribed: subscribe, grantCode: null }));
      const result = await hostBridge
        .call('setMqttSubscription', {
          sendId,
          subscription: {
            topicFilter: row.topicFilter,
            subscribe,
            ...(row.qos !== undefined ? { qos: row.qos } : {}),
            ...(v5 && row.noLocal !== undefined ? { noLocal: row.noLocal } : {}),
            ...(v5 && row.retainAsPublished !== undefined ? { retainAsPublished: row.retainAsPublished } : {}),
            ...(v5 && row.retainHandling !== undefined ? { retainHandling: row.retainHandling } : {}),
            ...(v5 && row.subscriptionId !== undefined ? { subscriptionId: row.subscriptionId } : {}),
          },
        })
        .catch(() => null);
      if (result === null || !result.success) {
        toast.error(result?.error ?? t('workbench.editors.mqtt.session.subscribeFailed'));
        setLiveSubs((prev) => new Map(prev).set(row.uid, { subscribed: !subscribe, grantCode: null }));
        return;
      }
      const grantCode = result.grantCode ?? null;
      setLiveSubs((prev) =>
        new Map(prev).set(row.uid, {
          subscribed: subscribe && (grantCode === null || grantCode <= 2),
          grantCode,
        }),
      );
    },
    [v5, toast, t],
  );

  const handleClearSession = useCallback(() => {
    setSnapshot(null);
    setTiming(null);
    setHostNotice(null);
  }, []);

  // Save Response — freeze the settled session as an example under
  // this request. Captures the AUTHORED compose state (draft fields as
  // edited, variable refs unresolved) plus the settled snapshot's
  // facts; only a session that opened can be captured (the gRPC
  // example's law).
  const handleSaveResponse = useCallback(async () => {
    if (!entity || !workspaceId || !snapshot || snapshot.error !== null || !snapshot.connected) return;
    const response = capturedMqttResponseFromSnapshot(snapshot);
    if (response === null) return;
    const mirror = getMqttResponseExampleSyncMirrorForWorkspace(workspaceId);
    await mirror.hydrated;
    const name = nextMqttExampleName(mirror, entity.uid, entity.name);
    const result = await applyMqttResponseExampleCreate(
      {
        mqttRequestPath: entity.path,
        example: {
          mqttRequestUid: entity.uid,
          name,
          capturedAt: new Date().toISOString(),
          request: capturedMqttRequestFromDraft(draft),
          response,
        },
      },
      { workspaceId, surfaceId: 'workbench' },
    );
    if (result.ok) {
      toast.success(t('workbench.editors.mqtt.toast.savedExample', { name }));
      onOpenMqttResponseExample?.(result.mqttResponseExample.uid, name, entity.uid);
    } else {
      toast.error(
        'message' in result && result.message
          ? t('workbench.editors.mqtt.toast.saveExampleFailedDetail', { message: result.message })
          : t('workbench.editors.mqtt.toast.saveExampleFailed'),
      );
    }
  }, [entity, workspaceId, snapshot, draft, toast, onOpenMqttResponseExample, t]);

  const canSaveResponse =
    workspaceId !== null && snapshot !== null && snapshot.error === null && snapshot.connected;

  const sessionOpen = inFlight && liveSession.live !== null && liveSession.live.open !== null;

  // ── AsyncAPI spec binding ─────────────────────────────────────────
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

  // ── Compose aids off the specLink census (the WS Phase F recipe) ──
  // Channel messages first (channel-local keys — the vendor outline
  // shape), then reusable component messages not shadowed by a channel
  // entry. Each option pre-computes its synthesis over the ratified
  // subset so unsupported payloads (no schema, combinators) render
  // disabled instead of failing on pick. The channel's ADDRESS rides
  // along — on MQTT it IS the publish topic, an affordance the WS
  // editor has no seat for.
  const exampleMessages = useMemo(() => {
    const c = census.census;
    if (!c) return [];
    const seen = new Set<string>();
    const out: {
      key: string;
      label: string;
      message: AsyncApiMessage;
      topicAddress: string | null;
      synth: { value: unknown } | null;
    }[] = [];
    const add = (scope: string, message: AsyncApiMessage, topicAddress: string | null) => {
      const key = `${scope}:${message.name}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        key,
        label: message.name,
        message,
        topicAddress,
        synth: synthesizeExamplePayload(message.payload, c.componentSchemas),
      });
    };
    for (const channel of c.channels) for (const message of channel.messages) add(channel.name, message, channel.address);
    for (const message of c.componentMessages) add('components', message, null);
    return out;
  }, [census]);

  // Apply one censused message to the compose surface: the synthesized
  // payload lands in the payload editor as pretty JSON, the ENCODING
  // flips to JSON, and a channel-scoped pick prefills the publish topic
  // with the channel address (the mqtt-only affordance).
  const applyExampleMessage = useCallback(
    (key: string) => {
      const option = exampleMessages.find((m) => m.key === key);
      if (!option || option.synth === null) return;
      const text = JSON.stringify(option.synth.value, null, 2);
      setDraft((d) => ({
        ...d,
        payload: text,
        payloadFormat: 'json' as const,
        ...(option.topicAddress !== null ? { topic: option.topicAddress } : {}),
      }));
      setActiveTab('message');
    },
    [exampleMessages],
  );

  // ── Channel browser (AsyncAPI tab) — the WS `browserTree` recipe ──
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
        title: t('workbench.editors.mqtt.spec.browser.servers'),
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
        title: t('workbench.editors.mqtt.spec.browser.channels'),
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
        title: t('workbench.editors.mqtt.spec.browser.operations'),
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
        title: t('workbench.editors.mqtt.spec.browser.components'),
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

  // ── Saved-messages rail ──────────────────────────────────────────
  const addSavedMessageFromCompose = useCallback(() => {
    setDraft((d) => {
      const baseName = t('workbench.editors.mqtt.saved.defaultName');
      const names = new Set(d.savedMessages.map((m) => m.name));
      let name = baseName;
      let counter = 2;
      while (names.has(name)) name = `${baseName} (${counter++})`;
      const properties = buildMqttRequestUpdates(d).publishProperties;
      const row: MqttSavedMessage = {
        uid: generateUid(),
        name,
        topic: d.topic,
        payload: d.payload,
        ...(d.payloadFormat !== 'text' ? { format: d.payloadFormat } : {}),
        ...(d.qos !== 0 ? { qos: d.qos } : {}),
        ...(d.retain ? { retain: true } : {}),
        ...(properties !== undefined ? { properties } : {}),
      };
      return { ...d, savedMessages: [...d.savedMessages, row] };
    });
  }, [t]);

  const loadSavedMessage = useCallback((row: MqttSavedMessage) => {
    setDraft((d) => ({
      ...d,
      topic: row.topic,
      payload: row.payload,
      payloadFormat: row.format ?? 'text',
      qos: row.qos ?? 0,
      retain: row.retain ?? false,
      publishProperties: propertiesToDraft(row.properties),
    }));
  }, []);

  const encodingError = payloadEncodingError(draft.payload, draft.payloadFormat);

  // Connect gate: node hosts run every scheme; a page-session surface
  // runs ws(s):// natively and names the tcp-scheme limit honestly
  // (mqtt/mqtts dial a raw TCP socket no browser page can open — the
  // scheme is named, never silently downgraded to ws); a browser
  // surface without the capability keeps the honest disabled posture.
  const connectDisabledReason =
    !nodeHost && !pageSession
      ? t('workbench.editors.mqtt.connect.browserHost')
      : draft.url.trim() === ''
        ? t('workbench.editors.mqtt.connect.needsUrl')
        : pageSession && /^mqtts?:\/\//i.test(draft.url.trim())
          ? t('workbench.editors.mqtt.connect.tcpSchemeBrowser', { scheme: schemeOf(draft.url.trim()) })
          : null;

  // ⌘/Ctrl+Enter connects from anywhere in the editor — the same gate
  // as the Connect button, and the same MORPH: while the session is
  // in flight the chord disconnects. ⌘/Ctrl+Shift+Enter publishes the
  // compose — a dead key outside an open session or on a malformed
  // payload. Capture phase so the chords win inside Monaco too.
  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'Enter') return;
      if (e.shiftKey) {
        if (!sessionOpen || encodingError !== null) return;
        e.preventDefault();
        e.stopPropagation();
        void handlePublish(composePublishWire());
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
    [
      sessionOpen,
      encodingError,
      inFlight,
      connectDisabledReason,
      handlePublish,
      composePublishWire,
      handleDisconnect,
      handleConnect,
    ],
  );

  if (!entity) {
    return (
      <div style={{ padding: 24, background: token.colorBgContainer }}>
        <Text type="secondary">{t('workbench.editors.mqtt.notFound')}</Text>
      </div>
    );
  }

  const scheme = schemeOf(draft.url);

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
        placeholder={t('workbench.editors.mqtt.spec.useExample')}
        value={null}
        options={exampleMessages.map((m) => ({ value: m.key, label: m.label, disabled: m.synth === null }))}
        onChange={(key: string) => applyExampleMessage(key)}
        data-testid="mqtt-use-example-message"
      />
    ) : null;

  // Header consolidates the full target row (the WS editor's
  // discipline): version + scheme + URL in the title slot, Connect in
  // the actions slot next to the standardized Save. Where a session
  // cannot run, Connect stays a visible DISABLED affordance with the
  // honest gate copy — never a hidden button.
  const headerTitle = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
      <Tooltip title={t('workbench.editors.mqtt.version.tooltip')}>
        <Select
          size="small"
          style={{ width: 84, flexShrink: 0 }}
          value={draft.protocolVersion}
          options={[
            { value: '5.0', label: t('workbench.editors.mqtt.version.v5') },
            { value: '3.1.1', label: t('workbench.editors.mqtt.version.v311') },
          ]}
          onChange={(protocolVersion: '5.0' | '3.1.1') => setDraft((d) => ({ ...d, protocolVersion }))}
          data-testid="mqtt-version-select"
        />
      </Tooltip>
      <Tooltip title={t('workbench.editors.mqtt.scheme.tooltip')}>
        <Select
          size="small"
          style={{ width: 92, flexShrink: 0 }}
          value={scheme}
          options={MQTT_SCHEMES.map((s) => ({ value: s, label: `${s}://` }))}
          onChange={(next: MqttScheme) => setDraft((d) => ({ ...d, url: withScheme(d.url, next) }))}
          data-testid="mqtt-scheme-select"
        />
      </Tooltip>
      <Input
        style={{ flex: 1, minWidth: 0, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
        placeholder={t('workbench.editors.mqtt.urlPlaceholder')}
        value={draft.url}
        onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
        data-testid="mqtt-url-input"
      />
    </div>
  );

  // Connect morphs into Disconnect while the session is in flight —
  // the Invoke→Stop treatment: solid on the darkened error token.
  const headerActions = inFlight ? (
    <Tooltip
      placement="bottom"
      title={
        <ShortcutHintTitle label={CONNECT_SHORTCUT}>{t('workbench.editors.mqtt.connect.disconnect')}</ShortcutHintTitle>
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
          data-testid="mqtt-connect-button"
        >
          {t('workbench.editors.mqtt.connect.disconnect')}
        </Button>
      </ConfigProvider>
    </Tooltip>
  ) : (
    <Tooltip
      placement="bottom"
      title={
        connectDisabledReason ?? (
          <ShortcutHintTitle label={CONNECT_SHORTCUT}>{t('workbench.editors.mqtt.connect.label')}</ShortcutHintTitle>
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
        {linkedSpec
          ? t('workbench.editors.mqtt.specFooter.using', { name: linkedSpec.name })
          : t('workbench.editors.mqtt.specFooter.none')}
      </Text>
      {census.census !== null && census.census.issues.length > 0 && (
        <Text type="warning" style={{ fontSize: 11 }}>
          {t('workbench.editors.mqtt.spec.issues', { count: census.census.issues.length })}
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
                <DocsTab value={draft.description} onChange={(description) => setDraft((d) => ({ ...d, description }))} />
              )}
              {activeTab === 'message' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
                  {/* Toolbar row ABOVE the editor (the ScriptsTab
                    discipline): the ENCODING select on the left —
                    base64/hex compose binary payloads, so this is a
                    wire choice, not a display toggle. Find / Replace /
                    Beautify cluster on the right (a JSON affordance). */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Segmented
                        size="small"
                        value={draft.payloadFormat}
                        onChange={(payloadFormat) =>
                          setDraft((d) => ({ ...d, payloadFormat: payloadFormat as MqttPayloadFormat }))
                        }
                        options={[
                          { value: 'text', label: t('workbench.editors.mqtt.payload.formatText') },
                          { value: 'json', label: t('workbench.editors.mqtt.payload.formatJson') },
                          { value: 'base64', label: t('workbench.editors.mqtt.payload.formatBase64') },
                          { value: 'hex', label: t('workbench.editors.mqtt.payload.formatHex') },
                        ]}
                        data-testid="mqtt-payload-format"
                      />
                      {exampleSelect}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {draft.payloadFormat === 'json' && (
                        <CodeEditorActions
                          target={payloadActionsRef}
                          language="json"
                          labels
                          findText={t('workbench.editors.scriptEditor.find')}
                          replaceText={t('workbench.editors.scriptEditor.replace')}
                          formatText={t('workbench.editors.scriptEditor.beautify')}
                        />
                      )}
                      <EditorViewMenu wrap={wrapPayload} onWrapChange={setWrapPayload} data-testid="mqtt-editor-menu" />
                    </div>
                  </div>
                  {/* Publish row: topic + QoS + Retain + per-message
                    properties + the disabled Send scaffold (enables
                    with the session plane; invalid base64/hex is the
                    other honest gate). */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Input
                      size="small"
                      style={{ flex: 1, minWidth: 0, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
                      placeholder={t('workbench.editors.mqtt.topicPlaceholder')}
                      value={draft.topic}
                      onChange={(e) => setDraft((d) => ({ ...d, topic: e.target.value }))}
                      data-testid="mqtt-topic-input"
                    />
                    <Select
                      size="small"
                      style={{ width: 150 }}
                      value={draft.qos}
                      options={QOS_OPTIONS(t)}
                      onChange={(qos: MqttRequestQos) => setDraft((d) => ({ ...d, qos }))}
                      data-testid="mqtt-qos-select"
                    />
                    <Checkbox
                      checked={draft.retain}
                      onChange={(e) => setDraft((d) => ({ ...d, retain: e.target.checked }))}
                      data-testid="mqtt-retain"
                    >
                      {t('workbench.editors.mqtt.retainLabel')}
                    </Checkbox>
                    <MessagePropertiesPopover
                      value={draft.publishProperties}
                      onChange={(publishProperties) => setDraft((d) => ({ ...d, publishProperties }))}
                      v5={v5}
                      testId="mqtt-publish-props"
                    />
                    <Tooltip
                      title={
                        encodingError !== null
                          ? t('workbench.editors.mqtt.payload.invalidGate')
                          : sessionOpen ? (
                              <ShortcutHintTitle label={SEND_MESSAGE_SHORTCUT}>
                                {t('workbench.editors.mqtt.sendLabel')}
                              </ShortcutHintTitle>
                            ) : (
                              t('workbench.editors.mqtt.session.sendIdle')
                            )
                      }
                    >
                      <span style={{ display: 'inline-flex' }}>
                        <Button
                          size="small"
                          type="primary"
                          icon={<SendOutlined />}
                          disabled={!sessionOpen || encodingError !== null}
                          onClick={() => void handlePublish(composePublishWire())}
                          data-testid="mqtt-send-message"
                        >
                          {t('workbench.editors.mqtt.sendLabel')}
                        </Button>
                      </span>
                    </Tooltip>
                  </div>
                  {encodingError !== null && (
                    <Text type="danger" style={{ fontSize: 11 }} data-testid="mqtt-encoding-error">
                      {encodingError === 'base64'
                        ? t('workbench.editors.mqtt.payload.invalidBase64')
                        : t('workbench.editors.mqtt.payload.invalidHex')}
                    </Text>
                  )}
                  <div style={{ flex: 1, minHeight: 100, display: 'flex', gap: 0 }}>
                    {/* Absolute inset host — a fill editor must not
                      size its own flex parent (the BodyTab discipline).
                      COLUMN direction: a fill CodeEditor stretches to
                      full width only on the cross axis — as a row-flex
                      child it sizes to its content and renders as a
                      sliver (the WS editor's column-wrapper idiom). */}
                    <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
                        <CodeEditor
                          value={draft.payload}
                          onChange={(payload) => setDraft((d) => ({ ...d, payload }))}
                          language={PAYLOAD_FORMAT_LANGUAGE[draft.payloadFormat]}
                          fill
                          actions="external"
                          actionsRef={payloadActionsRef}
                          wordWrapOverride={wrapPayload ? 'on' : 'off'}
                          placeholder={
                            draft.payloadFormat === 'base64'
                              ? t('workbench.editors.mqtt.payloadPlaceholderBase64')
                              : draft.payloadFormat === 'hex'
                                ? t('workbench.editors.mqtt.payloadPlaceholderHex')
                                : t('workbench.editors.mqtt.payloadPlaceholder')
                          }
                        />
                      </div>
                    </div>
                    {/* Saved-messages rail — synced entity rows, not
                      local state: they travel with the workspace and
                      git-sync. Clicking a row loads the compose;
                      Send-from-row lands with the session plane. */}
                    <div
                      style={{
                        width: 208,
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        borderLeft: `1px solid ${token.colorBorderSecondary}`,
                        paddingLeft: 8,
                        marginLeft: 8,
                        overflow: 'auto',
                      }}
                      data-testid="mqtt-saved-rail"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text strong style={{ fontSize: 11 }}>
                          {t('workbench.editors.mqtt.saved.title')}
                        </Text>
                        <Tooltip title={t('workbench.editors.mqtt.saved.addTooltip')}>
                          <Button
                            size="small"
                            type="text"
                            icon={<PlusOutlined style={{ fontSize: 10 }} />}
                            onClick={addSavedMessageFromCompose}
                            data-testid="mqtt-saved-add"
                          />
                        </Tooltip>
                      </div>
                      {draft.savedMessages.length === 0 && (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {t('workbench.editors.mqtt.saved.emptyHint')}
                        </Text>
                      )}
                      {draft.savedMessages.map((row) => (
                        <div
                          key={row.uid}
                          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                          data-testid="mqtt-saved-row"
                        >
                          {renamingSavedUid === row.uid ? (
                            <Input
                              size="small"
                              autoFocus
                              defaultValue={row.name}
                              onBlur={(e) => {
                                const name = e.target.value.trim();
                                setRenamingSavedUid(null);
                                if (!name) return;
                                setDraft((d) => ({
                                  ...d,
                                  savedMessages: d.savedMessages.map((m) => (m.uid === row.uid ? { ...m, name } : m)),
                                }));
                              }}
                              onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
                            />
                          ) : (
                            <Button
                              size="small"
                              type="text"
                              style={{
                                flex: 1,
                                minWidth: 0,
                                justifyContent: 'flex-start',
                                fontSize: 11,
                                overflow: 'hidden',
                              }}
                              onClick={() => loadSavedMessage(row)}
                              title={row.topic}
                            >
                              {row.name}
                            </Button>
                          )}
                          {/* Send-from-row — publishes the saved
                            preset AS STORED while the session is open;
                            the compose surface stays untouched. */}
                          {sessionOpen && (
                            <Tooltip title={t('workbench.editors.mqtt.saved.sendTooltip')}>
                              <Button
                                size="small"
                                type="text"
                                icon={<SendOutlined style={{ fontSize: 11 }} />}
                                onClick={() =>
                                  void handlePublish({
                                    topic: row.topic,
                                    payload: row.payload,
                                    ...(row.format !== undefined ? { format: row.format } : {}),
                                    ...(row.qos !== undefined ? { qos: row.qos } : {}),
                                    ...(row.retain !== undefined ? { retain: row.retain } : {}),
                                    ...(row.properties !== undefined ? { properties: row.properties } : {}),
                                  })
                                }
                                data-testid="mqtt-saved-row-send"
                              />
                            </Tooltip>
                          )}
                          <Dropdown
                            trigger={['click']}
                            menu={{
                              items: [
                                {
                                  key: 'rename',
                                  label: t('workbench.editors.mqtt.saved.rename'),
                                  onClick: () => setRenamingSavedUid(row.uid),
                                },
                                {
                                  key: 'duplicate',
                                  label: t('workbench.editors.mqtt.saved.duplicate'),
                                  onClick: () =>
                                    setDraft((d) => ({
                                      ...d,
                                      savedMessages: [...d.savedMessages, { ...row, uid: generateUid() }],
                                    })),
                                },
                                {
                                  key: 'delete',
                                  label: t('workbench.editors.mqtt.saved.delete'),
                                  danger: true,
                                  onClick: () =>
                                    setDraft((d) => ({
                                      ...d,
                                      savedMessages: d.savedMessages.filter((m) => m.uid !== row.uid),
                                    })),
                                },
                              ],
                            }}
                          >
                            <Button
                              size="small"
                              type="text"
                              icon={<MoreOutlined style={{ fontSize: 11 }} />}
                              data-testid="mqtt-saved-row-menu"
                            />
                          </Dropdown>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'topics' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="mqtt-topics-table">
                  {/* The stored table is the DRAFT the session
                    subscribes from at open — live Subscribe toggles
                    will ride session riders, never edit these rows. */}
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {t('workbench.editors.mqtt.topics.hint')}
                  </Text>
                  <EditableGridTable<MqttTopicRow>
                    rows={draft.topics}
                    onChange={(topics) => setDraft((d) => ({ ...d, topics }))}
                    adapter={TOPIC_ROW_ADAPTER}
                    keyPlaceholder={t('workbench.editors.mqtt.topics.filterPlaceholder')}
                    headerLabels={{
                      key: t('workbench.editors.mqtt.topics.filterLabel'),
                      value: t('workbench.editors.mqtt.topics.optionsLabel'),
                    }}
                    hideEnabled
                    columnWidths={{ value: '210px' }}
                    renderKeyCell={(row, update, ctx) => {
                      const filterError = !ctx.isPlaceholder && row.topicFilter.trim() ? topicFilterError(row.topicFilter) : null;
                      return (
                        <Tooltip title={filterError ?? undefined} open={filterError ? undefined : false}>
                          <Input
                            size="small"
                            variant="borderless"
                            style={{ fontFamily: "'SF Mono', monospace", fontSize: 12 }}
                            placeholder={t('workbench.editors.mqtt.topics.filterPlaceholder')}
                            value={row.topicFilter}
                            status={filterError ? 'error' : undefined}
                            onChange={(e) => update({ ...row, topicFilter: e.target.value })}
                            data-testid="mqtt-topic-filter-input"
                          />
                        </Tooltip>
                      );
                    }}
                    renderValueCell={(row, update, ctx) =>
                      ctx.isPlaceholder ? (
                        <span />
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, paddingLeft: 4 }}>
                          <Select
                            size="small"
                            style={{ width: 74 }}
                            value={row.qos ?? 0}
                            options={[
                              { value: 0, label: 'QoS 0' },
                              { value: 1, label: 'QoS 1' },
                              { value: 2, label: 'QoS 2' },
                            ]}
                            onChange={(qos: MqttRequestQos) => update({ ...row, qos })}
                            data-testid="mqtt-topic-qos"
                          />
                          {/* While the session is open the switch is
                            the LIVE toggle — it rides the rider and
                            marks the row with the SUBACK grant; the
                            stored draft row stays untouched (the
                            publication-gate idiom). */}
                          <Tooltip
                            title={
                              sessionOpen
                                ? t('workbench.editors.mqtt.topics.subscribeLiveLabel')
                                : t('workbench.editors.mqtt.topics.subscribeLabel')
                            }
                          >
                            <Switch
                              size="small"
                              checked={
                                sessionOpen
                                  ? (liveSubs.get(row.uid)?.subscribed ?? row.subscribe !== false)
                                  : row.subscribe !== false
                              }
                              onChange={(subscribe) => {
                                if (sessionOpen) {
                                  void handleLiveSubscriptionToggle(row, subscribe);
                                  return;
                                }
                                update({ ...row, subscribe });
                              }}
                              data-testid="mqtt-topic-subscribe"
                            />
                          </Tooltip>
                          {sessionOpen &&
                            (() => {
                              const grantCode = liveSubs.get(row.uid)?.grantCode;
                              if (grantCode === undefined || grantCode === null) return null;
                              return (
                                <Tag
                                  color={grantCode <= 2 ? 'success' : 'error'}
                                  style={{ marginInlineEnd: 0, fontSize: 10, lineHeight: '16px' }}
                                  data-testid="mqtt-topic-grant"
                                >
                                  {grantLabel(grantCode, t)}
                                </Tag>
                              );
                            })()}
                          <Popover
                            trigger="click"
                            placement="left"
                            content={
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 280 }}>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  {v5
                                    ? t('workbench.editors.mqtt.topics.optionsHint')
                                    : t('workbench.editors.mqtt.props.v311')}
                                </Text>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Switch
                                    size="small"
                                    disabled={!v5}
                                    checked={row.noLocal === true}
                                    onChange={(noLocal) => update({ ...row, noLocal })}
                                    data-testid="mqtt-topic-nolocal"
                                  />
                                  <Text type="secondary" style={{ fontSize: 11 }}>
                                    {t('workbench.editors.mqtt.topics.noLocal')}
                                  </Text>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Switch
                                    size="small"
                                    disabled={!v5}
                                    checked={row.retainAsPublished === true}
                                    onChange={(retainAsPublished) => update({ ...row, retainAsPublished })}
                                  />
                                  <Text type="secondary" style={{ fontSize: 11 }}>
                                    {t('workbench.editors.mqtt.topics.retainAsPublished')}
                                  </Text>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                                    {t('workbench.editors.mqtt.topics.retainHandling')}
                                  </Text>
                                  <Select
                                    size="small"
                                    style={{ flex: 1 }}
                                    disabled={!v5}
                                    value={row.retainHandling ?? 0}
                                    options={[
                                      { value: 0, label: t('workbench.editors.mqtt.topics.retainHandling0') },
                                      { value: 1, label: t('workbench.editors.mqtt.topics.retainHandling1') },
                                      { value: 2, label: t('workbench.editors.mqtt.topics.retainHandling2') },
                                    ]}
                                    onChange={(retainHandling: MqttRetainHandling) => update({ ...row, retainHandling })}
                                  />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                                    {t('workbench.editors.mqtt.topics.subscriptionId')}
                                  </Text>
                                  <InputNumber
                                    size="small"
                                    min={1}
                                    max={268_435_455}
                                    disabled={!v5}
                                    value={row.subscriptionId}
                                    onChange={(next) => update({ ...row, subscriptionId: next ?? undefined })}
                                    style={{ width: 120 }}
                                  />
                                </div>
                              </div>
                            }
                          >
                            <Button size="small" type="text" icon={<MoreOutlined />} data-testid="mqtt-topic-options" />
                          </Popover>
                        </span>
                      )
                    }
                  />
                </div>
              )}
              {activeTab === 'auth' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
                  {/* Shell only — Basic auth (username/password on
                    CONNECT) wires up in a later phase; the disabled
                    select is the honest scaffold, never a hidden tab. */}
                  <div>
                    <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
                      {t('workbench.editors.mqtt.auth.typeLabel')}
                    </Text>
                    <Select
                      style={{ width: 220 }}
                      value="none"
                      disabled
                      options={[
                        { value: 'none', label: t('workbench.editors.mqtt.auth.typeNone') },
                        { value: 'basic', label: t('workbench.editors.mqtt.auth.typeBasic') },
                      ]}
                      data-testid="mqtt-auth-type"
                    />
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {t('workbench.editors.mqtt.auth.pending')}
                  </Text>
                </div>
              )}
              {activeTab === 'properties' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="mqtt-user-props">
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {v5 ? t('workbench.editors.mqtt.userProps.hint') : t('workbench.editors.mqtt.userProps.v311')}
                  </Text>
                  <div
                    style={v5 ? undefined : { opacity: 0.55, pointerEvents: 'none' }}
                    aria-disabled={!v5}
                  >
                    <KeyValueTable
                      rows={draft.userProperties}
                      onChange={(userProperties) => setDraft((d) => ({ ...d, userProperties }))}
                      keyPlaceholder={t('workbench.editors.mqtt.userProps.keyPlaceholder')}
                      valuePlaceholder={t('workbench.editors.mqtt.userProps.valuePlaceholder')}
                    />
                  </div>
                </div>
              )}
              {activeTab === 'lastwill' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {t('workbench.editors.mqtt.will.hint')}
                  </Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Input
                      size="small"
                      style={{ flex: 1, minWidth: 0, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
                      placeholder={t('workbench.editors.mqtt.will.topicPlaceholder')}
                      value={draft.lastWill.topic}
                      onChange={(e) => setDraft((d) => ({ ...d, lastWill: { ...d.lastWill, topic: e.target.value } }))}
                      data-testid="mqtt-will-topic"
                    />
                    <Select
                      size="small"
                      style={{ width: 150 }}
                      value={draft.lastWill.qos}
                      options={QOS_OPTIONS(t)}
                      onChange={(qos: MqttRequestQos) => setDraft((d) => ({ ...d, lastWill: { ...d.lastWill, qos } }))}
                      data-testid="mqtt-will-qos"
                    />
                    <Checkbox
                      checked={draft.lastWill.retain}
                      onChange={(e) => setDraft((d) => ({ ...d, lastWill: { ...d.lastWill, retain: e.target.checked } }))}
                      data-testid="mqtt-will-retain"
                    >
                      {t('workbench.editors.mqtt.retainLabel')}
                    </Checkbox>
                    <Tooltip title={t('workbench.editors.mqtt.will.delayHelp')}>
                      <InputNumber
                        size="small"
                        min={0}
                        max={0xffff_ffff}
                        disabled={!v5}
                        value={draft.lastWill.willDelayInterval}
                        onChange={(next) =>
                          setDraft((d) => ({ ...d, lastWill: { ...d.lastWill, willDelayInterval: next ?? undefined } }))
                        }
                        placeholder={t('workbench.editors.mqtt.will.delayPlaceholder')}
                        style={{ width: 130 }}
                        data-testid="mqtt-will-delay"
                      />
                    </Tooltip>
                    <MessagePropertiesPopover
                      value={draft.lastWill.properties}
                      onChange={(properties) => setDraft((d) => ({ ...d, lastWill: { ...d.lastWill, properties } }))}
                      v5={v5}
                      testId="mqtt-will-props"
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Segmented
                      size="small"
                      value={draft.lastWill.format}
                      onChange={(format) =>
                        setDraft((d) => ({ ...d, lastWill: { ...d.lastWill, format: format as MqttPayloadFormat } }))
                      }
                      options={[
                        { value: 'text', label: t('workbench.editors.mqtt.payload.formatText') },
                        { value: 'json', label: t('workbench.editors.mqtt.payload.formatJson') },
                        { value: 'base64', label: t('workbench.editors.mqtt.payload.formatBase64') },
                        { value: 'hex', label: t('workbench.editors.mqtt.payload.formatHex') },
                      ]}
                      data-testid="mqtt-will-format"
                    />
                  </div>
                  <div style={{ flex: 1, minHeight: 100, position: 'relative' }}>
                    {/* Column direction — see the Message-tab host. */}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
                      <CodeEditor
                        value={draft.lastWill.payload}
                        onChange={(payload) => setDraft((d) => ({ ...d, lastWill: { ...d.lastWill, payload } }))}
                        language={PAYLOAD_FORMAT_LANGUAGE[draft.lastWill.format]}
                        fill
                        placeholder={t('workbench.editors.mqtt.will.payloadPlaceholder')}
                      />
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'spec' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
                  <div>
                    <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
                      {t('workbench.editors.mqtt.spec.selectLabel')}
                    </Text>
                    <Select
                      style={{ width: '100%' }}
                      placeholder={t('workbench.editors.mqtt.spec.selectPlaceholder')}
                      value={linkedSpec?.uid}
                      options={asyncapiSpecs.map((s) => ({ value: s.uid, label: s.name }))}
                      onChange={(specUid: string) => setDraft((d) => ({ ...d, specLink: { specUid } }))}
                      data-testid="mqtt-spec-select"
                    />
                  </div>
                  {census.census && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {t('workbench.editors.mqtt.spec.summary', {
                        servers: census.census.servers.length,
                        channels: census.census.channels.length,
                        operations: census.census.operations.length,
                      })}
                    </Text>
                  )}
                  {browserTree.length > 0 && (
                    <div data-testid="mqtt-asyncapi-browser">
                      {/* Pick a message row to land its synthesized
                        example on the compose surface (a channel-scoped
                        pick also prefills the publish topic with the
                        channel address). */}
                      <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
                        {t('workbench.editors.mqtt.spec.browser.hint')}
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
                      {t('workbench.editors.mqtt.spec.parseFailure', { message: census.parseError })}
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
                  <SettingRow
                    label={t('workbench.editors.mqtt.settings.clientIdLabel')}
                    description={t('workbench.editors.mqtt.settings.clientIdHelp')}
                    control={
                      <Input
                        style={{ width: 260, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
                        placeholder={t('workbench.editors.mqtt.settings.clientIdPlaceholder')}
                        value={draft.clientId}
                        onChange={(e) => setDraft((d) => ({ ...d, clientId: e.target.value }))}
                        data-testid="mqtt-client-id"
                      />
                    }
                  />
                  <SettingRow
                    label={t('workbench.editors.mqtt.settings.cleanStartLabel')}
                    description={t('workbench.editors.mqtt.settings.cleanStartHelp')}
                    control={
                      <Switch
                        checked={draft.cleanStart}
                        onChange={(cleanStart) => setDraft((d) => ({ ...d, cleanStart }))}
                        data-testid="mqtt-clean-start"
                      />
                    }
                  />
                  <SettingRow
                    label={t('workbench.editors.mqtt.settings.sessionExpiryLabel')}
                    description={
                      v5
                        ? t('workbench.editors.mqtt.settings.sessionExpiryHelp')
                        : t('workbench.editors.mqtt.settings.v311Knob')
                    }
                    control={
                      <InputNumber
                        min={0}
                        max={0xffff_ffff}
                        disabled={!v5}
                        value={draft.sessionExpiryInterval}
                        onChange={(value) => setDraft((d) => ({ ...d, sessionExpiryInterval: value ?? undefined }))}
                        placeholder={t('workbench.editors.mqtt.settings.zeroDefault')}
                        style={{ width: 160 }}
                        data-testid="mqtt-session-expiry"
                      />
                    }
                  />
                  <SettingRow
                    label={t('workbench.editors.mqtt.settings.keepAliveLabel')}
                    description={t('workbench.editors.mqtt.settings.keepAliveHelp')}
                    control={
                      <InputNumber
                        min={0}
                        max={65_535}
                        value={draft.keepAlive}
                        onChange={(value) => setDraft((d) => ({ ...d, keepAlive: value ?? undefined }))}
                        placeholder="60"
                        style={{ width: 160 }}
                        data-testid="mqtt-keep-alive"
                      />
                    }
                  />
                  <SettingRow
                    label={t('workbench.editors.mqtt.settings.timeoutLabel')}
                    description={t('workbench.editors.mqtt.settings.timeoutHelp')}
                    control={
                      <InputNumber
                        min={MIN_REQUEST_TIMEOUT_MS}
                        max={MAX_REQUEST_TIMEOUT_MS}
                        step={1000}
                        value={draft.timeoutMs}
                        onChange={(value) => setDraft((d) => ({ ...d, timeoutMs: value ?? undefined }))}
                        placeholder={t('workbench.editors.mqtt.settings.timeoutPlaceholder')}
                        style={{ width: 160 }}
                        data-testid="mqtt-timeout"
                      />
                    }
                  />
                  <SettingRow
                    label={t('workbench.editors.mqtt.settings.receiveMaximumLabel')}
                    description={
                      v5
                        ? t('workbench.editors.mqtt.settings.receiveMaximumHelp')
                        : t('workbench.editors.mqtt.settings.v311Knob')
                    }
                    control={
                      <InputNumber
                        min={1}
                        max={65_535}
                        disabled={!v5}
                        value={draft.receiveMaximum}
                        onChange={(value) => setDraft((d) => ({ ...d, receiveMaximum: value ?? undefined }))}
                        placeholder={t('workbench.editors.mqtt.settings.brokerDefault')}
                        style={{ width: 160 }}
                        data-testid="mqtt-receive-maximum"
                      />
                    }
                  />
                  <SettingRow
                    label={t('workbench.editors.mqtt.settings.maxPacketSizeLabel')}
                    description={
                      v5
                        ? t('workbench.editors.mqtt.settings.maxPacketSizeHelp')
                        : t('workbench.editors.mqtt.settings.v311Knob')
                    }
                    control={
                      <InputNumber
                        min={1}
                        max={0xffff_ffff}
                        disabled={!v5}
                        value={draft.maximumPacketSize}
                        onChange={(value) => setDraft((d) => ({ ...d, maximumPacketSize: value ?? undefined }))}
                        placeholder={t('workbench.editors.mqtt.settings.noLimit')}
                        style={{ width: 160 }}
                        data-testid="mqtt-max-packet-size"
                      />
                    }
                  />
                  <SettingRow
                    label={t('workbench.editors.mqtt.settings.sslVerifyLabel')}
                    description={t('workbench.editors.mqtt.settings.sslVerifyHelp')}
                    control={
                      <Switch
                        checked={draft.sslVerification}
                        onChange={(sslVerification) => setDraft((d) => ({ ...d, sslVerification }))}
                        data-testid="mqtt-ssl-verify"
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
                <MqttSessionPane
                  live={liveSession.live}
                  snapshot={snapshot}
                  timing={timing}
                  protocolVersion={draft.protocolVersion}
                  hostNotice={hostNotice}
                  onClear={handleClearSession}
                  {...(canSaveResponse ? { onSaveResponse: () => void handleSaveResponse() } : {})}
                />
              ) : (
                // Always-attached session pane (the WS editor's
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
                      {t('workbench.editors.mqtt.session.title')}
                    </Text>
                  </div>
                  <div style={{ padding: '16px 12px' }} data-testid="mqtt-session-empty">
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('workbench.editors.mqtt.session.emptyHint')}
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

export default MqttRequestEditor;
