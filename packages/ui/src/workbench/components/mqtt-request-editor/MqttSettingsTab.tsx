/**
 * MqttSettingsTab — per-request connection settings rows (client id,
 * Clean Start, keep-alive, connect timeout, SSL verification) plus the
 * 5.0-only connect knobs (session expiry, receive maximum, maximum
 * packet size) rendered disabled-honest on 3.1.1.
 */

import { MAX_REQUEST_TIMEOUT_MS, MIN_REQUEST_TIMEOUT_MS } from '@openheaders/core/schemas';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { Input, InputNumber, Switch, Typography } from 'antd';
import type React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { MqttDraft } from './draft';
import { mqttSettingsRowInfo } from './MqttSettingsRowInfo';

const { Text } = Typography;

/** One Settings-tab row — the gRPC editor's SettingRow vocabulary; the
 *  (i) opens the shared example-session popover for the knob. */
const SettingRow: React.FC<{
  label: string;
  description: string;
  control: React.ReactNode;
  info: InfoPopoverContent;
}> = ({ label, description, control, info }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, padding: '10px 0' }}>
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Text strong style={{ fontSize: 12 }}>
          {label}
        </Text>
        <InfoTrigger content={info} />
      </span>
      <Text type="secondary" style={{ fontSize: 11 }}>
        {description}
      </Text>
    </div>
    <div style={{ flexShrink: 0 }}>{control}</div>
  </div>
);

interface MqttSettingsTabProps {
  draft: MqttDraft;
  setDraft: Dispatch<SetStateAction<MqttDraft>>;
  v5: boolean;
}

const MqttSettingsTab: React.FC<MqttSettingsTabProps> = ({ draft, setDraft, v5 }) => {
  const t = useT();
  return (
    <div style={{ maxWidth: 720 }}>
      <SettingRow
        label={t('workbench.editors.mqtt.settings.clientIdLabel')}
        description={t('workbench.editors.mqtt.settings.clientIdHelp')}
        info={mqttSettingsRowInfo(t, 'clientId')}
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
        info={mqttSettingsRowInfo(t, 'cleanStart')}
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
          v5 ? t('workbench.editors.mqtt.settings.sessionExpiryHelp') : t('workbench.editors.mqtt.settings.v311Knob')
        }
        info={mqttSettingsRowInfo(t, 'sessionExpiry')}
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
        info={mqttSettingsRowInfo(t, 'keepAlive')}
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
        info={mqttSettingsRowInfo(t, 'timeout')}
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
          v5 ? t('workbench.editors.mqtt.settings.receiveMaximumHelp') : t('workbench.editors.mqtt.settings.v311Knob')
        }
        info={mqttSettingsRowInfo(t, 'receiveMaximum')}
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
          v5 ? t('workbench.editors.mqtt.settings.maxPacketSizeHelp') : t('workbench.editors.mqtt.settings.v311Knob')
        }
        info={mqttSettingsRowInfo(t, 'maxPacketSize')}
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
        info={mqttSettingsRowInfo(t, 'sslVerification')}
        control={
          <Switch
            checked={draft.sslVerification}
            onChange={(sslVerification) => setDraft((d) => ({ ...d, sslVerification }))}
            data-testid="mqtt-ssl-verify"
          />
        }
      />
    </div>
  );
};

export default MqttSettingsTab;
