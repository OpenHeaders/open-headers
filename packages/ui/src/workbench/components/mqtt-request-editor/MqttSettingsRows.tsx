/**
 * MqttSettingsRows — the MQTT Settings rows over a props-driven VALUE
 * (the kind's inheritable knobs plus the request-only client id),
 * rendered by two hosts: the request's Settings tab
 * (`MqttSettingsTab`, which maps its draft to the value and back, the
 * switches concrete on the draft) and a collection's / folder's
 * Settings section (the `mqtt` sub-tab over the container's one
 * `settings` object). Same groups, same rows, same (i) copy in both —
 * the lift, never a copy.
 *
 * Groups: Connection · Session resilience · Session — MQTT 5.0 · TLS
 * & trust. The 5.0-only session group renders disabled-honest on a
 * 3.1.1 request (the header carries the honest line once, the rows
 * stay visible, values intact); a container's requests may be either
 * version, so its rows stay live and read as 5.0. A container never
 * shows the client id (session identity, request-only). On the
 * ancestor plane (`inherited`) the rows read their placeholders off
 * the chain and dot any own value.
 */

import { MAX_ALPN_PROTOCOL_LENGTH, MAX_REQUEST_TIMEOUT_MS, MIN_REQUEST_TIMEOUT_MS } from '@openheaders/core/schemas';
import type { KindSettings } from '@openheaders/core/settings-inheritance';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  byteSizeInterpreter,
  countInterpreter,
  durationMsInterpreter,
  durationSecondsInterpreter,
  formatByteSize,
  formatDurationMs,
  formatDurationSeconds,
  numericPresets,
} from '@openheaders/ui/shared/combo-knob';
import { ComboKnobRow, GroupSection, KnobRow, TextKnobRow } from '@openheaders/ui/shared/settings-rows';
import { ConfigProvider, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import DialRows, { isDialModified } from '../shared/dial/DialRows';
import { type InheritedSettingsView, inheritedRowsFor } from '../shared/inherited-settings/inherited-settings';
import SessionResilienceGroup from '../shared/resilience/SessionResilienceGroup';
import type { ResilienceInfoKey } from '../shared/resilience/resilience-row-info';
import TlsTrustGroup from '../shared/tls-trust/TlsTrustGroup';
import { type MqttResilienceInfoKey, mqttSettingsGroupInfo, mqttSettingsRowInfo } from './MqttSettingsRowInfo';
import { MQTT_GROUP_LABEL_KEY } from './settings-groups';

const { Text } = Typography;

/** The rows' value: the kind's inheritable knobs (every key optional,
 *  `undefined` = inherit or the runtime default) plus the request-only
 *  client id a container never carries. */
export interface MqttSettingsValue extends KindSettings<'mqtt'> {
  clientId?: string | undefined;
}

const CONNECTION_KEYS = ['cleanStart', 'keepAlive', 'resolveToAddress', 'proxyMode', 'proxyUrl', 'proxyCredentialRef', 'timeoutMs'] as const;
const SESSION_KEYS = [
  'sessionExpiryInterval',
  'receiveMaximum',
  'maximumPacketSize',
  'topicAliasMaximum',
  'requestResponseInformation',
  'requestProblemInformation',
] as const;

/** CONNECT carries the Client ID as UTF-8; brokers must accept at
 *  least 23 bytes but commonly allow far more — cap the field
 *  generously without inviting essays. */
const MAX_CLIENT_ID_LENGTH = 256;

/** Bounded interpreters + preset lists for the numeric combo knobs —
 *  free text becomes concrete candidates ("30" → "30 s" / "30 min");
 *  readings outside the wire field's range stay visible as disabled
 *  entries naming the violated bound. Keep-alive and session expiry
 *  are whole seconds on the wire; the connect timeout and the
 *  reconnect period are app milliseconds; packet size is bytes. */
const interpretKeepAlive = durationSecondsInterpreter({ min: 0, max: 65_535 });
const KEEP_ALIVE_PRESETS = numericPresets([15, 30, 60, 300], formatDurationSeconds);
const interpretSessionExpiry = durationSecondsInterpreter({ min: 0, max: 0xffff_ffff });
const SESSION_EXPIRY_PRESETS = numericPresets([300, 3_600, 86_400], formatDurationSeconds);
const interpretTimeout = durationMsInterpreter({ min: MIN_REQUEST_TIMEOUT_MS, max: MAX_REQUEST_TIMEOUT_MS });
const TIMEOUT_PRESETS = numericPresets([1_000, 5_000, 10_000, 30_000, 60_000], formatDurationMs);
const interpretReceiveMaximum = countInterpreter({ min: 1, max: 65_535 });
const RECEIVE_MAXIMUM_PRESETS = numericPresets([1, 5, 20, 100], String);
const interpretMaxPacketSize = byteSizeInterpreter({ min: 1, max: 0xffff_ffff });
const interpretTopicAliasMaximum = countInterpreter({ min: 0, max: 65_535 });
const TOPIC_ALIAS_MAXIMUM_PRESETS = numericPresets([10, 50, 100], String);
const MAX_PACKET_SIZE_PRESETS = numericPresets(
  [64, 256, 1024, 10_240].map((kb) => kb * 1024),
  formatByteSize,
);

/** The resilience rows MQTT masks in — the reconnect quartet lights
 *  the session card; the liveness rows never render here. */
const MQTT_RESILIENCE_ROWS: Record<MqttResilienceInfoKey, true> = {
  autoReconnect: true,
  reconnectPeriod: true,
  reconnectMaxAttempts: true,
  reconnectBackoff: true,
};
const isMqttResilienceRow = (key: ResilienceInfoKey): key is MqttResilienceInfoKey => key in MQTT_RESILIENCE_ROWS;

/** Session-scoped memory of the group folds: the rows unmount on
 *  every editor tab switch, and a fold choice must survive that.
 *  Shared by every MQTT surface — a fold is a reading preference, not
 *  per-request state — and deliberately not persisted to disk. */
const sessionCollapsed: Record<string, boolean> = {};

export interface MqttSettingsRowsProps {
  value: MqttSettingsValue;
  /** The whole next value — the host merges it into its own draft. */
  onChange: (next: MqttSettingsValue) => void;
  /** The request's protocol version gates the 5.0 session rows; a
   *  container's rows stay live. */
  v5: boolean;
  /** `request` (default): the request's own rows. `container`: the
   *  inheritable rows alone, the client id left out. */
  scope?: 'request' | 'container';
  /** Keys whose value differs from the saved baseline; absent = no
   *  such plane. */
  unsaved?: ReadonlySet<string>;
  /** The ancestor plane — see the shared blocks. */
  inherited?: InheritedSettingsView;
}

const MqttSettingsRows: React.FC<MqttSettingsRowsProps> = ({
  value,
  onChange,
  v5,
  scope = 'request',
  unsaved,
  inherited,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const container = scope === 'container';
  const live = v5 || container;
  const rows = inheritedRowsFor(inherited);
  const explicit = inherited !== undefined;
  const isUnsaved = (key: string): boolean => unsaved?.has(key) === true;
  const set = (patch: Partial<MqttSettingsValue>): void => onChange({ ...value, ...patch });
  // Collapsible group state — all expanded by default; a collapsed
  // group's header keeps the accent dot while it hides a modified
  // knob. Folds seed from (and write back to) the session store, so a
  // fold survives the rows' unmount on every editor tab switch.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => ({ ...sessionCollapsed }));
  const toggleGroup = (key: string): void =>
    setCollapsed((c) => {
      const next = !(c[key] ?? false);
      sessionCollapsed[key] = next;
      return { ...c, [key]: next };
    });
  const cleanStart = rows.toggle('cleanStart', value.cleanStart, true);
  const responseInfo = rows.toggle('requestResponseInformation', value.requestResponseInformation, false);
  const problemInfo = rows.toggle('requestProblemInformation', value.requestProblemInformation, true);
  const connectionModified =
    (!container && value.clientId !== undefined) ||
    (explicit
      ? CONNECTION_KEYS.some((key) => value[key] !== undefined)
      : value.cleanStart === false || value.keepAlive !== undefined || isDialModified(value) || value.timeoutMs !== undefined);
  const sessionModified = explicit
    ? SESSION_KEYS.some((key) => value[key] !== undefined)
    : value.sessionExpiryInterval !== undefined ||
      value.receiveMaximum !== undefined ||
      value.maximumPacketSize !== undefined ||
      value.topicAliasMaximum !== undefined ||
      value.requestResponseInformation === true ||
      value.requestProblemInformation === false;

  return (
    <ConfigProvider
      theme={{
        components: {
          // An empty knob means "the default in effect" — its stated
          // default must read as live behavior, not a disabled
          // control, so placeholders render at full text contrast,
          // exactly like a set value; the dot and reset affordances
          // carry the customized-vs-default distinction.
          Select: { colorTextPlaceholder: token.colorText },
          Input: { colorTextPlaceholder: token.colorText },
          InputNumber: { colorTextPlaceholder: token.colorText },
        },
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 560 }}>
        <GroupSection
          label={t(MQTT_GROUP_LABEL_KEY.connection)}
          expanded={collapsed.connection !== true}
          onToggle={() => toggleGroup('connection')}
          info={mqttSettingsGroupInfo(t, 'connection')}
          modified={connectionModified}
          unsaved={CONNECTION_KEYS.some(isUnsaved)}
        >
          {!container && (
            <TextKnobRow
              label={t('workbench.editors.mqtt.settings.clientIdLabel')}
              value={value.clientId}
              onChange={(clientId) => set({ clientId })}
              info={mqttSettingsRowInfo(t, 'clientId')}
              placeholder={t('workbench.editors.mqtt.settings.clientIdPlaceholder')}
              maxLength={MAX_CLIENT_ID_LENGTH}
              example={t('workbench.editors.mqtt.settings.clientIdExample')}
              testId="mqtt-client-id"
            />
          )}
          <KnobRow
            label={t(
              live ? 'workbench.editors.mqtt.settings.cleanStartLabel' : 'workbench.editors.mqtt.settings.cleanSessionLabel',
            )}
            checked={cleanStart.checked}
            modified={explicit ? value.cleanStart !== undefined : value.cleanStart === false}
            unsaved={isUnsaved('cleanStart')}
            onReset={() => set({ cleanStart: undefined })}
            onChange={(next) => set({ cleanStart: next })}
            info={mqttSettingsRowInfo(t, live ? 'cleanStart' : 'cleanSession')}
            note={cleanStart.note}
            testId="mqtt-clean-start"
          />
          <ComboKnobRow
            label={t('workbench.editors.mqtt.settings.keepAliveLabel')}
            value={value.keepAlive}
            onChange={(keepAlive) => set({ keepAlive })}
            info={mqttSettingsRowInfo(t, 'keepAlive')}
            presets={KEEP_ALIVE_PRESETS}
            interpret={interpretKeepAlive}
            format={formatDurationSeconds}
            {...rows.field(
              'keepAlive',
              value.keepAlive,
              t('workbench.editors.mqtt.settings.keepAlivePlaceholder'),
              formatDurationSeconds,
            )}
            unsaved={isUnsaved('keepAlive')}
            testId="mqtt-keep-alive"
          />
          <DialRows
            groupLabel={t(MQTT_GROUP_LABEL_KEY.connection)}
            value={value}
            onChange={(next) => set(next)}
            rowInfo={(key) => mqttSettingsRowInfo(t, key)}
            unsaved={unsaved}
            inherited={inherited}
            testIdPrefix="mqtt"
          />
          <ComboKnobRow
            label={t('workbench.editors.mqtt.settings.timeoutLabel')}
            value={value.timeoutMs}
            onChange={(timeoutMs) => set({ timeoutMs })}
            info={mqttSettingsRowInfo(t, 'timeout')}
            presets={TIMEOUT_PRESETS}
            interpret={interpretTimeout}
            format={formatDurationMs}
            {...rows.field(
              'timeoutMs',
              value.timeoutMs,
              t('workbench.editors.mqtt.settings.timeoutPlaceholder'),
              formatDurationMs,
            )}
            unsaved={isUnsaved('timeoutMs')}
            testId="mqtt-timeout"
          />
        </GroupSection>
        <SessionResilienceGroup
          groupLabel={t(MQTT_GROUP_LABEL_KEY.resilience)}
          groupInfo={mqttSettingsGroupInfo(t, 'resilience')}
          expanded={collapsed.resilience !== true}
          onToggle={() => toggleGroup('resilience')}
          value={value}
          onChange={(next) => set(next)}
          liveness="none"
          rowInfo={(key) => (isMqttResilienceRow(key) ? mqttSettingsRowInfo(t, key) : undefined)}
          unsaved={unsaved}
          inherited={inherited}
          testIdPrefix="mqtt"
        />
        <GroupSection
          label={t(MQTT_GROUP_LABEL_KEY.session)}
          expanded={collapsed.session !== true}
          onToggle={() => toggleGroup('session')}
          info={mqttSettingsGroupInfo(t, 'session')}
          modified={sessionModified}
          unsaved={SESSION_KEYS.some(isUnsaved)}
        >
          {!live && (
            <Text type="secondary" style={{ fontSize: 11, marginBottom: 4 }}>
              {t('workbench.editors.mqtt.settings.sessionV311')}
            </Text>
          )}
          <ComboKnobRow
            label={t('workbench.editors.mqtt.settings.sessionExpiryLabel')}
            value={value.sessionExpiryInterval}
            onChange={(sessionExpiryInterval) => set({ sessionExpiryInterval })}
            info={mqttSettingsRowInfo(t, 'sessionExpiry')}
            presets={SESSION_EXPIRY_PRESETS}
            interpret={interpretSessionExpiry}
            format={formatDurationSeconds}
            {...rows.field(
              'sessionExpiryInterval',
              value.sessionExpiryInterval,
              t('workbench.editors.mqtt.settings.zeroDefault'),
              formatDurationSeconds,
            )}
            disabled={!live}
            unsaved={isUnsaved('sessionExpiryInterval')}
            testId="mqtt-session-expiry"
          />
          <ComboKnobRow
            label={t('workbench.editors.mqtt.settings.receiveMaximumLabel')}
            value={value.receiveMaximum}
            onChange={(receiveMaximum) => set({ receiveMaximum })}
            info={mqttSettingsRowInfo(t, 'receiveMaximum')}
            presets={RECEIVE_MAXIMUM_PRESETS}
            interpret={interpretReceiveMaximum}
            format={String}
            {...rows.field(
              'receiveMaximum',
              value.receiveMaximum,
              t('workbench.editors.mqtt.settings.receiveMaximumPlaceholder'),
              String,
            )}
            disabled={!live}
            unsaved={isUnsaved('receiveMaximum')}
            testId="mqtt-receive-maximum"
          />
          <ComboKnobRow
            label={t('workbench.editors.mqtt.settings.maxPacketSizeLabel')}
            value={value.maximumPacketSize}
            onChange={(maximumPacketSize) => set({ maximumPacketSize })}
            info={mqttSettingsRowInfo(t, 'maxPacketSize')}
            presets={MAX_PACKET_SIZE_PRESETS}
            interpret={interpretMaxPacketSize}
            format={formatByteSize}
            {...rows.field(
              'maximumPacketSize',
              value.maximumPacketSize,
              t('workbench.editors.mqtt.settings.noLimit'),
              formatByteSize,
            )}
            disabled={!live}
            unsaved={isUnsaved('maximumPacketSize')}
            testId="mqtt-max-packet-size"
          />
          <ComboKnobRow
            label={t('workbench.editors.mqtt.settings.topicAliasMaximumLabel')}
            value={value.topicAliasMaximum}
            onChange={(topicAliasMaximum) => set({ topicAliasMaximum })}
            info={mqttSettingsRowInfo(t, 'topicAliasMaximum')}
            presets={TOPIC_ALIAS_MAXIMUM_PRESETS}
            interpret={interpretTopicAliasMaximum}
            format={String}
            {...rows.field(
              'topicAliasMaximum',
              value.topicAliasMaximum,
              t('workbench.editors.mqtt.settings.topicAliasMaximumPlaceholder'),
              String,
            )}
            disabled={!live}
            unsaved={isUnsaved('topicAliasMaximum')}
            testId="mqtt-topic-alias-maximum"
          />
          <KnobRow
            label={t('workbench.editors.mqtt.settings.requestResponseInfoLabel')}
            checked={responseInfo.checked}
            modified={
              explicit ? value.requestResponseInformation !== undefined : value.requestResponseInformation === true
            }
            unsaved={isUnsaved('requestResponseInformation')}
            onReset={() => set({ requestResponseInformation: undefined })}
            onChange={(requestResponseInformation) => set({ requestResponseInformation })}
            info={mqttSettingsRowInfo(t, 'requestResponseInformation')}
            disabled={!live}
            note={responseInfo.note}
            testId="mqtt-request-response-info"
          />
          <KnobRow
            label={t('workbench.editors.mqtt.settings.requestProblemInfoLabel')}
            checked={problemInfo.checked}
            modified={
              explicit ? value.requestProblemInformation !== undefined : value.requestProblemInformation === false
            }
            unsaved={isUnsaved('requestProblemInformation')}
            onReset={() => set({ requestProblemInformation: undefined })}
            onChange={(requestProblemInformation) => set({ requestProblemInformation })}
            info={mqttSettingsRowInfo(t, 'requestProblemInformation')}
            disabled={!live}
            note={problemInfo.note}
            testId="mqtt-request-problem-info"
          />
        </GroupSection>
        <TlsTrustGroup
          groupLabel={t(MQTT_GROUP_LABEL_KEY.tls)}
          groupInfo={mqttSettingsGroupInfo(t, 'tls')}
          expanded={collapsed.tls !== true}
          onToggle={() => toggleGroup('tls')}
          value={value}
          onChange={(next) => set(next)}
          rowInfo={(key) => mqttSettingsRowInfo(t, key)}
          unsaved={unsaved}
          inherited={inherited}
          trustedRootsRow={!container}
          testIdPrefix="mqtt"
        >
          <TextKnobRow
            label={t('workbench.editors.mqtt.settings.alpnLabel')}
            value={value.alpnProtocol}
            onChange={(alpnProtocol) => set({ alpnProtocol })}
            info={mqttSettingsRowInfo(t, 'alpn')}
            {...rows.field(
              'alpnProtocol',
              value.alpnProtocol,
              t('workbench.editors.mqtt.settings.alpnPlaceholder'),
              String,
            )}
            maxLength={MAX_ALPN_PROTOCOL_LENGTH}
            example={t('workbench.editors.mqtt.settings.alpnExample')}
            unsaved={isUnsaved('alpnProtocol')}
            testId="mqtt-alpn-protocol"
          />
        </TlsTrustGroup>
      </div>
    </ConfigProvider>
  );
};

export default MqttSettingsRows;
