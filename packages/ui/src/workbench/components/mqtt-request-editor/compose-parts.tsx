/**
 * Compose-bar leaves shared by every MQTT publish compose surface —
 * the Message tab, the Last Will tab and the response example's
 * message tab: the ENCODING dropdown, the compact QoS knob (integer;
 * the opened menu explains the levels), the narrow topic field with
 * its statement placeholder + muted example line, and the honest
 * encoding-error line under the bar. One anatomy, testids by prop.
 */

import type { MqttPayloadFormat, MqttRequestQos } from '@openheaders/core/types';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { Input, Select, Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

/** The editor's empty-state line per ENCODING — base64/hex state the
 *  binary contract; text/json read the surface's own prompt. */
export const payloadPlaceholder = (t: Translate, format: MqttPayloadFormat, textPlaceholder: string): string =>
  format === 'base64'
    ? t('workbench.editors.mqtt.payloadPlaceholderBase64')
    : format === 'hex'
      ? t('workbench.editors.mqtt.payloadPlaceholderHex')
      : textPlaceholder;

export const EncodingSelect: React.FC<{
  value: MqttPayloadFormat;
  onChange: (format: MqttPayloadFormat) => void;
  testId: string;
}> = ({ value, onChange, testId }) => {
  const t = useT();
  return (
    <Select
      size="small"
      style={{ width: 120 }}
      value={value}
      onChange={onChange}
      options={[
        { value: 'text', label: t('workbench.editors.mqtt.payload.formatText') },
        { value: 'json', label: t('workbench.editors.mqtt.payload.formatJson') },
        { value: 'base64', label: t('workbench.editors.mqtt.payload.formatBase64') },
        { value: 'hex', label: t('workbench.editors.mqtt.payload.formatHex') },
      ]}
      data-testid={testId}
    />
  );
};

/** `QoS` label + the 46px integer knob — the meanings ride the menu. */
export const CompactQosSelect: React.FC<{
  value: MqttRequestQos;
  onChange: (qos: MqttRequestQos) => void;
  testId: string;
}> = ({ value, onChange, testId }) => {
  const t = useT();
  return (
    <>
      <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', lineHeight: '24px' }}>
        {t('workbench.editors.mqtt.qos.compactLabel')}
      </Text>
      <Select
        size="small"
        style={{ width: 46 }}
        suffixIcon={null}
        popupMatchSelectWidth={false}
        value={value}
        onChange={onChange}
        options={[
          { value: 0, label: '0', meaning: t('workbench.editors.mqtt.qos.meaning0') },
          { value: 1, label: '1', meaning: t('workbench.editors.mqtt.qos.meaning1') },
          { value: 2, label: '2', meaning: t('workbench.editors.mqtt.qos.meaning2') },
        ]}
        optionRender={(option) => (
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 16 }}>
            <span>{option.data.label}</span>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {option.data.meaning}
            </Text>
          </span>
        )}
        data-testid={testId}
      />
    </>
  );
};

/** Statement placeholder + the muted example below — the settings-row
 *  TextKnob discipline, 200px. */
export const TopicField: React.FC<{
  value: string;
  onChange: (topic: string) => void;
  placeholder: string;
  example: string;
  testId: string;
}> = ({ value, onChange, placeholder, example, testId }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 200 }}>
    <Input
      size="small"
      style={{ fontFamily: "'SF Mono', monospace", fontSize: 12 }}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid={testId}
    />
    <Text type="secondary" style={{ fontSize: 11 }}>
      {example}
    </Text>
  </div>
);

/** Renders nothing while the payload decodes under its ENCODING. */
export const EncodingErrorLine: React.FC<{ error: 'base64' | 'hex' | null; testId: string }> = ({
  error,
  testId,
}) => {
  const t = useT();
  if (error === null) return null;
  return (
    <Text type="danger" style={{ fontSize: 11 }} data-testid={testId}>
      {error === 'base64'
        ? t('workbench.editors.mqtt.payload.invalidBase64')
        : t('workbench.editors.mqtt.payload.invalidHex')}
    </Text>
  );
};
