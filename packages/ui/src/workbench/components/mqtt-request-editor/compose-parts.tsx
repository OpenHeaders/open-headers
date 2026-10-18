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
import { type InfoPopoverContent, InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { Select, Typography } from 'antd';
import type React from 'react';
import { EncodingPicker } from '../shared/EncodingPicker';
import { TemplateInput } from '../template-input';

const { Text } = Typography;

/** The editor's empty-state line per ENCODING — base64/hex state the
 *  binary contract; text/json read the surface's own prompt. */
export const payloadPlaceholder = (t: Translate, format: MqttPayloadFormat, textPlaceholder: string): string =>
  format === 'base64'
    ? t('workbench.editors.mqtt.payloadPlaceholderBase64')
    : format === 'hex'
      ? t('workbench.editors.mqtt.payloadPlaceholderHex')
      : textPlaceholder;

/** The ENCODING picker — the body viewers' picker dress (glyph + label
 *  + chevron, a menu of glyph + label rows): the grammars (Text, JSON)
 *  above the divider, the byte spellings (Base64, Hex) below it. */
export const EncodingSelect: React.FC<{
  value: MqttPayloadFormat;
  onChange: (format: MqttPayloadFormat) => void;
  testId: string;
}> = ({ value, onChange, testId }) => {
  const t = useT();
  return (
    <EncodingPicker<MqttPayloadFormat>
      value={value}
      onChange={onChange}
      divideAfter={2}
      options={[
        { value: 'text', label: t('workbench.editors.mqtt.payload.formatText'), icon: 'text' },
        { value: 'json', label: t('workbench.editors.mqtt.payload.formatJson'), icon: 'json' },
        { value: 'base64', label: t('workbench.editors.mqtt.payload.formatBase64'), icon: 'base64' },
        { value: 'hex', label: t('workbench.editors.mqtt.payload.formatHex'), icon: 'hex' },
      ]}
      testId={testId}
    />
  );
};

/** `QoS` label (+ its (i) card) + the 46px integer knob — the meanings
 *  ride the menu. */
export const CompactQosSelect: React.FC<{
  value: MqttRequestQos;
  onChange: (qos: MqttRequestQos) => void;
  info?: InfoPopoverContent;
  testId: string;
}> = ({ value, onChange, info, testId }) => {
  const t = useT();
  return (
    <>
      {/* The bar's own text color and size — the Retain checkbox's
        label is the reference; a smaller secondary caption read high
        beside it. */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, lineHeight: '24px' }}>
        <span style={{ whiteSpace: 'nowrap' }}>{t('workbench.editors.mqtt.qos.compactLabel')}</span>
        {info && <InfoTrigger content={info} />}
      </span>
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
 *  TextKnob discipline, 200px. The field has no label, so its (i)
 *  card closes the example line. The topic rides the variable plane:
 *  the executor resolves it at publish (and the will's at CONNECT). */
export const TopicField: React.FC<{
  value: string;
  onChange: (topic: string) => void;
  placeholder: string;
  example: string;
  info?: InfoPopoverContent;
  testId: string;
}> = ({ value, onChange, placeholder, example, info, testId }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 200 }}>
    <TemplateInput
      size="small"
      flagUnresolved
      style={{ fontFamily: "'SF Mono', monospace", fontSize: 12 }}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      data-testid={testId}
    />
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Text type="secondary" style={{ fontSize: 11 }}>
        {example}
      </Text>
      {info && <InfoTrigger content={info} />}
    </span>
  </div>
);

/** A compose-bar label (Retain, Will delay) closed by its (i) card —
 *  the options popovers' `OptionLabel` shape at the bar's 12px. */
export const ComposeLabel: React.FC<{ text: string; info: InfoPopoverContent }> = ({ text, info }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    {text}
    <InfoTrigger content={info} />
  </span>
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
