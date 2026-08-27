/**
 * MqttSettingsTab — per-request connection knobs in the request
 * Settings tab's exact anatomy: collapsible group sections
 * (Connection · Session — MQTT 5.0 · TLS & trust) whose headers carry
 * the (i) group popovers, `label · (i) · control` rows from the shared
 * settings-row family with the effective defaults legible in the
 * controls, modified dots, and per-row resets.
 *
 * The tab edits the draft directly, so the dots track distance from
 * the PROTOCOL defaults — there is no saved-baseline (unsaved) plane
 * here; the editor's own dirty fingerprint covers "not saved yet".
 * The 5.0-only session group renders disabled-honest on 3.1.1: the
 * group header carries the honest line once and the rows stay
 * visible, disabled, values intact.
 */

import {
  MAX_ALPN_PROTOCOL_LENGTH,
  MAX_RECONNECT_ATTEMPTS,
  MAX_REQUEST_TIMEOUT_MS,
  MAX_SNI_SERVER_NAME_LENGTH,
  MIN_REQUEST_TIMEOUT_MS,
} from '@openheaders/core/schemas';
import { useVaultContext } from '@openheaders/ui/context';
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
import {
  ComboKnobRow,
  DependentRows,
  GroupSection,
  KnobRow,
  SelectKnobRow,
  TextKnobRow,
} from '@openheaders/ui/shared/settings-rows';
import { ConfigProvider, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import TrustedRootsSettingsRow from '../trusted-roots/TrustedRootsSettingsRow';
import VaultSelectFooter from '../variables/VaultSelectFooter';
import type { MqttDraft } from './draft';
import { mqttSettingsGroupInfo, mqttSettingsRowInfo } from './MqttSettingsRowInfo';
import { MQTT_GROUP_LABEL_KEY } from './settings-groups';

const { Text } = Typography;

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
const interpretReconnectPeriod = durationMsInterpreter({ min: MIN_REQUEST_TIMEOUT_MS, max: MAX_REQUEST_TIMEOUT_MS });
const RECONNECT_PERIOD_PRESETS = numericPresets([1_000, 2_000, 5_000, 10_000, 30_000], formatDurationMs);
const interpretReconnectMaxAttempts = countInterpreter({ min: 1, max: MAX_RECONNECT_ATTEMPTS });
const RECONNECT_MAX_ATTEMPTS_PRESETS = numericPresets([3, 5, 10, 50], String);
const interpretReceiveMaximum = countInterpreter({ min: 1, max: 65_535 });
const RECEIVE_MAXIMUM_PRESETS = numericPresets([1, 5, 20, 100], String);
const interpretMaxPacketSize = byteSizeInterpreter({ min: 1, max: 0xffff_ffff });
const interpretTopicAliasMaximum = countInterpreter({ min: 0, max: 65_535 });
const TOPIC_ALIAS_MAXIMUM_PRESETS = numericPresets([10, 50, 100], String);
const MAX_PACKET_SIZE_PRESETS = numericPresets(
  [64, 256, 1024, 10_240].map((kb) => kb * 1024),
  formatByteSize,
);

/** Session-scoped memory of the group folds: the tab unmounts on
 *  every editor tab switch, and a fold choice must survive that.
 *  Shared by every MQTT editor — a fold is a reading preference, not
 *  per-request state — and deliberately not persisted to disk. */
const sessionCollapsed: Record<string, boolean> = {};

interface MqttSettingsTabProps {
  draft: MqttDraft;
  setDraft: Dispatch<SetStateAction<MqttDraft>>;
  v5: boolean;
}

const MqttSettingsTab: React.FC<MqttSettingsTabProps> = ({ draft, setDraft, v5 }) => {
  const t = useT();
  const { token } = theme.useToken();
  // Collapsible group state — all expanded by default; a collapsed
  // group's header keeps the accent dot while it hides a modified
  // knob. Folds seed from (and write back to) the session store, so a
  // fold survives the tab's unmount on every editor tab switch.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => ({ ...sessionCollapsed }));
  const toggleGroup = (key: string): void =>
    setCollapsed((c) => {
      const next = !(c[key] ?? false);
      sessionCollapsed[key] = next;
      return { ...c, [key]: next };
    });
  const connectionModified =
    draft.clientId !== '' ||
    !draft.cleanStart ||
    draft.keepAlive !== undefined ||
    draft.timeoutMs !== undefined ||
    draft.autoReconnect ||
    draft.reconnectPeriodMs !== undefined ||
    draft.reconnectMaxAttempts !== undefined ||
    !draft.reconnectBackoff;
  const sessionModified =
    draft.sessionExpiryInterval !== undefined ||
    draft.receiveMaximum !== undefined ||
    draft.maximumPacketSize !== undefined ||
    draft.topicAliasMaximum !== undefined ||
    draft.requestResponseInformation ||
    !draft.requestProblemInformation;
  const tlsModified =
    !draft.sslVerification ||
    draft.clientCertificateRef !== undefined ||
    draft.sniServerName !== undefined ||
    draft.alpnProtocol !== undefined;
  // The client-certificate knob picks over THIS device's vault entries
  // by name — the request stores the name, each device resolves its
  // own entry; a ref with no entry here warns in place (the HTTP
  // Settings tab's contract).
  const { vault } = useVaultContext();
  const clientCertificateOptions = vault.secrets
    .filter((s) => s.kind === 'client-certificate')
    .map((s) => ({ value: s.name, label: s.name }));
  const clientCertificateRefDangling =
    draft.clientCertificateRef !== undefined &&
    !clientCertificateOptions.some((o) => o.value === draft.clientCertificateRef);

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
        >
          <TextKnobRow
            label={t('workbench.editors.mqtt.settings.clientIdLabel')}
            value={draft.clientId === '' ? undefined : draft.clientId}
            onChange={(clientId) => setDraft((d) => ({ ...d, clientId: clientId ?? '' }))}
            info={mqttSettingsRowInfo(t, 'clientId')}
            placeholder={t('workbench.editors.mqtt.settings.clientIdPlaceholder')}
            maxLength={MAX_CLIENT_ID_LENGTH}
            example={t('workbench.editors.mqtt.settings.clientIdExample')}
            testId="mqtt-client-id"
          />
          <KnobRow
            label={t(
              v5
                ? 'workbench.editors.mqtt.settings.cleanStartLabel'
                : 'workbench.editors.mqtt.settings.cleanSessionLabel',
            )}
            checked={draft.cleanStart}
            modified={!draft.cleanStart}
            onReset={() => setDraft((d) => ({ ...d, cleanStart: true }))}
            onChange={(cleanStart) => setDraft((d) => ({ ...d, cleanStart }))}
            info={mqttSettingsRowInfo(t, v5 ? 'cleanStart' : 'cleanSession')}
            testId="mqtt-clean-start"
          />
          <ComboKnobRow
            label={t('workbench.editors.mqtt.settings.keepAliveLabel')}
            value={draft.keepAlive}
            onChange={(keepAlive) => setDraft((d) => ({ ...d, keepAlive }))}
            info={mqttSettingsRowInfo(t, 'keepAlive')}
            presets={KEEP_ALIVE_PRESETS}
            interpret={interpretKeepAlive}
            format={formatDurationSeconds}
            placeholder={t('workbench.editors.mqtt.settings.keepAlivePlaceholder')}
            testId="mqtt-keep-alive"
          />
          <ComboKnobRow
            label={t('workbench.editors.mqtt.settings.timeoutLabel')}
            value={draft.timeoutMs}
            onChange={(timeoutMs) => setDraft((d) => ({ ...d, timeoutMs }))}
            info={mqttSettingsRowInfo(t, 'timeout')}
            presets={TIMEOUT_PRESETS}
            interpret={interpretTimeout}
            format={formatDurationMs}
            placeholder={t('workbench.editors.mqtt.settings.timeoutPlaceholder')}
            testId="mqtt-timeout"
          />
          <KnobRow
            label={t('workbench.editors.mqtt.settings.autoReconnectLabel')}
            checked={draft.autoReconnect}
            modified={draft.autoReconnect}
            onReset={() => setDraft((d) => ({ ...d, autoReconnect: false }))}
            onChange={(autoReconnect) => setDraft((d) => ({ ...d, autoReconnect }))}
            info={mqttSettingsRowInfo(t, 'autoReconnect')}
            testId="mqtt-auto-reconnect"
          />
          <DependentRows>
            <ComboKnobRow
              label={t('workbench.editors.mqtt.settings.reconnectPeriodLabel')}
              value={draft.reconnectPeriodMs}
              onChange={(reconnectPeriodMs) => setDraft((d) => ({ ...d, reconnectPeriodMs }))}
              info={mqttSettingsRowInfo(t, 'reconnectPeriod')}
              presets={RECONNECT_PERIOD_PRESETS}
              interpret={interpretReconnectPeriod}
              format={formatDurationMs}
              placeholder={t('workbench.editors.mqtt.settings.reconnectPeriodPlaceholder')}
              disabled={!draft.autoReconnect}
              testId="mqtt-reconnect-period"
            />
            <ComboKnobRow
              label={t('workbench.editors.mqtt.settings.reconnectMaxAttemptsLabel')}
              value={draft.reconnectMaxAttempts}
              onChange={(reconnectMaxAttempts) => setDraft((d) => ({ ...d, reconnectMaxAttempts }))}
              info={mqttSettingsRowInfo(t, 'reconnectMaxAttempts')}
              presets={RECONNECT_MAX_ATTEMPTS_PRESETS}
              interpret={interpretReconnectMaxAttempts}
              format={String}
              placeholder={t('workbench.editors.mqtt.settings.reconnectMaxAttemptsPlaceholder')}
              disabled={!draft.autoReconnect}
              testId="mqtt-reconnect-max-attempts"
            />
            <KnobRow
              label={t('workbench.editors.mqtt.settings.reconnectBackoffLabel')}
              checked={draft.reconnectBackoff}
              modified={!draft.reconnectBackoff}
              onReset={() => setDraft((d) => ({ ...d, reconnectBackoff: true }))}
              onChange={(reconnectBackoff) => setDraft((d) => ({ ...d, reconnectBackoff }))}
              info={mqttSettingsRowInfo(t, 'reconnectBackoff')}
              disabled={!draft.autoReconnect}
              testId="mqtt-reconnect-backoff"
            />
          </DependentRows>
        </GroupSection>
        <GroupSection
          label={t(MQTT_GROUP_LABEL_KEY.session)}
          expanded={collapsed.session !== true}
          onToggle={() => toggleGroup('session')}
          info={mqttSettingsGroupInfo(t, 'session')}
          modified={sessionModified}
        >
          {!v5 && (
            <Text type="secondary" style={{ fontSize: 11, marginBottom: 4 }}>
              {t('workbench.editors.mqtt.settings.sessionV311')}
            </Text>
          )}
          <ComboKnobRow
            label={t('workbench.editors.mqtt.settings.sessionExpiryLabel')}
            value={draft.sessionExpiryInterval}
            onChange={(sessionExpiryInterval) => setDraft((d) => ({ ...d, sessionExpiryInterval }))}
            info={mqttSettingsRowInfo(t, 'sessionExpiry')}
            presets={SESSION_EXPIRY_PRESETS}
            interpret={interpretSessionExpiry}
            format={formatDurationSeconds}
            placeholder={t('workbench.editors.mqtt.settings.zeroDefault')}
            disabled={!v5}
            testId="mqtt-session-expiry"
          />
          <ComboKnobRow
            label={t('workbench.editors.mqtt.settings.receiveMaximumLabel')}
            value={draft.receiveMaximum}
            onChange={(receiveMaximum) => setDraft((d) => ({ ...d, receiveMaximum }))}
            info={mqttSettingsRowInfo(t, 'receiveMaximum')}
            presets={RECEIVE_MAXIMUM_PRESETS}
            interpret={interpretReceiveMaximum}
            format={String}
            placeholder={t('workbench.editors.mqtt.settings.receiveMaximumPlaceholder')}
            disabled={!v5}
            testId="mqtt-receive-maximum"
          />
          <ComboKnobRow
            label={t('workbench.editors.mqtt.settings.maxPacketSizeLabel')}
            value={draft.maximumPacketSize}
            onChange={(maximumPacketSize) => setDraft((d) => ({ ...d, maximumPacketSize }))}
            info={mqttSettingsRowInfo(t, 'maxPacketSize')}
            presets={MAX_PACKET_SIZE_PRESETS}
            interpret={interpretMaxPacketSize}
            format={formatByteSize}
            placeholder={t('workbench.editors.mqtt.settings.noLimit')}
            disabled={!v5}
            testId="mqtt-max-packet-size"
          />
          <ComboKnobRow
            label={t('workbench.editors.mqtt.settings.topicAliasMaximumLabel')}
            value={draft.topicAliasMaximum}
            onChange={(topicAliasMaximum) => setDraft((d) => ({ ...d, topicAliasMaximum }))}
            info={mqttSettingsRowInfo(t, 'topicAliasMaximum')}
            presets={TOPIC_ALIAS_MAXIMUM_PRESETS}
            interpret={interpretTopicAliasMaximum}
            format={String}
            placeholder={t('workbench.editors.mqtt.settings.topicAliasMaximumPlaceholder')}
            disabled={!v5}
            testId="mqtt-topic-alias-maximum"
          />
          <KnobRow
            label={t('workbench.editors.mqtt.settings.requestResponseInfoLabel')}
            checked={draft.requestResponseInformation}
            modified={draft.requestResponseInformation}
            onReset={() => setDraft((d) => ({ ...d, requestResponseInformation: false }))}
            onChange={(requestResponseInformation) => setDraft((d) => ({ ...d, requestResponseInformation }))}
            info={mqttSettingsRowInfo(t, 'requestResponseInformation')}
            disabled={!v5}
            testId="mqtt-request-response-info"
          />
          <KnobRow
            label={t('workbench.editors.mqtt.settings.requestProblemInfoLabel')}
            checked={draft.requestProblemInformation}
            modified={!draft.requestProblemInformation}
            onReset={() => setDraft((d) => ({ ...d, requestProblemInformation: true }))}
            onChange={(requestProblemInformation) => setDraft((d) => ({ ...d, requestProblemInformation }))}
            info={mqttSettingsRowInfo(t, 'requestProblemInformation')}
            disabled={!v5}
            testId="mqtt-request-problem-info"
          />
        </GroupSection>
        <GroupSection
          label={t(MQTT_GROUP_LABEL_KEY.tls)}
          expanded={collapsed.tls !== true}
          onToggle={() => toggleGroup('tls')}
          info={mqttSettingsGroupInfo(t, 'tls')}
          modified={tlsModified}
        >
          <KnobRow
            label={t('workbench.editors.mqtt.settings.sslVerifyLabel')}
            checked={draft.sslVerification}
            modified={!draft.sslVerification}
            onReset={() => setDraft((d) => ({ ...d, sslVerification: true }))}
            onChange={(sslVerification) => setDraft((d) => ({ ...d, sslVerification }))}
            info={mqttSettingsRowInfo(t, 'sslVerification')}
            warning={t('workbench.editors.mqtt.settings.sslVerifyWarning')}
            testId="mqtt-ssl-verify"
          />
          <TrustedRootsSettingsRow kicker={t(MQTT_GROUP_LABEL_KEY.tls)} testId="mqtt-trusted-roots" />
          <SelectKnobRow
            label={t('workbench.editors.request.settings.clientCertificate')}
            value={draft.clientCertificateRef}
            onChange={(clientCertificateRef) => setDraft((d) => ({ ...d, clientCertificateRef }))}
            info={mqttSettingsRowInfo(t, 'clientCertificate')}
            options={clientCertificateOptions}
            placeholder={t('workbench.editors.request.settings.clientCertificatePlaceholder')}
            searchable
            notFoundContent={
              <Text type="secondary" style={{ fontSize: 12, padding: '6px 8px' }}>
                {t('workbench.editors.request.settings.clientCertificateEmpty')}
              </Text>
            }
            popupFooter={(close) => (
              <VaultSelectFooter
                label={t('workbench.editors.request.settings.vaultManageCertificates')}
                testId="mqtt-client-certificate-manage"
                onNavigate={close}
              />
            )}
            modified={draft.clientCertificateRef !== undefined}
            warning={
              clientCertificateRefDangling
                ? t('workbench.editors.request.settings.clientCertificateDangling', {
                    name: draft.clientCertificateRef ?? '',
                  })
                : undefined
            }
            testId="mqtt-client-certificate"
          />
          <TextKnobRow
            label={t('workbench.editors.mqtt.settings.sniLabel')}
            value={draft.sniServerName}
            onChange={(sniServerName) => setDraft((d) => ({ ...d, sniServerName }))}
            info={mqttSettingsRowInfo(t, 'sni')}
            placeholder={t('workbench.editors.mqtt.settings.sniPlaceholder')}
            maxLength={MAX_SNI_SERVER_NAME_LENGTH}
            example={t('workbench.editors.mqtt.settings.sniExample')}
            testId="mqtt-sni-server-name"
          />
          <TextKnobRow
            label={t('workbench.editors.mqtt.settings.alpnLabel')}
            value={draft.alpnProtocol}
            onChange={(alpnProtocol) => setDraft((d) => ({ ...d, alpnProtocol }))}
            info={mqttSettingsRowInfo(t, 'alpn')}
            placeholder={t('workbench.editors.mqtt.settings.alpnPlaceholder')}
            maxLength={MAX_ALPN_PROTOCOL_LENGTH}
            example={t('workbench.editors.mqtt.settings.alpnExample')}
            testId="mqtt-alpn-protocol"
          />
        </GroupSection>
      </div>
    </ConfigProvider>
  );
};

export default MqttSettingsTab;
