/**
 * MqttLastWillTab — the will registered with the broker on CONNECT and
 * published by it if the session drops without a clean disconnect.
 * Mirrors the Message-tab anatomy (toolbar cluster above the editor,
 * the compose bar below it) minus what a will has no use for: no
 * saved-messages rail, no Send — the will travels with CONNECT — plus
 * the one 5.0 extra, Will Delay. An empty topic means no will (the
 * entity law); the 5.0-only knobs (delay interval, properties) render
 * disabled-honest on 3.1.1.
 */

import type { MqttPayloadFormat, MqttRequestQos } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  ComboKnob,
  durationSecondsInterpreter,
  formatDurationSeconds,
  numericPresets,
} from '@openheaders/ui/shared/combo-knob';
import { Checkbox, ConfigProvider, Input, Select, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { type Dispatch, type SetStateAction, useRef, useState } from 'react';
import CodeEditor from '../shared/CodeEditor';
import CodeEditorActions, { type CodeEditorActionsTarget } from '../shared/CodeEditorActions';
import EditorViewMenu from '../shared/EditorViewMenu';
import { PAYLOAD_FORMAT_LANGUAGE } from './compose';
import { type MqttDraft, payloadEncodingError } from './draft';
import MessagePropertiesPopover from './MessagePropertiesPopover';

const { Text } = Typography;

// Wire = whole seconds (§3.1.3.2.2); the spec default 0 publishes the
// will as soon as the session ends.
const interpretWillDelay = durationSecondsInterpreter({ min: 0, max: 0xffff_ffff });
const WILL_DELAY_PRESETS = numericPresets([10, 30, 60, 300], formatDurationSeconds);

interface MqttLastWillTabProps {
  draft: MqttDraft;
  setDraft: Dispatch<SetStateAction<MqttDraft>>;
  v5: boolean;
}

const MqttLastWillTab: React.FC<MqttLastWillTabProps> = ({ draft, setDraft, v5 }) => {
  const { token } = theme.useToken();
  const t = useT();
  // Will-editor wrap — the compose-editor default carries over (ON;
  // payloads are prose-like, scrolling hides the tail).
  const [wrapPayload, setWrapPayload] = useState(true);
  const payloadActionsRef = useRef<CodeEditorActionsTarget | null>(null);
  // No Send gates the will, so the encoding gate surfaces inline only.
  const encodingError = payloadEncodingError(draft.lastWill.payload, draft.lastWill.format);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
      <Text type="secondary" style={{ fontSize: 11 }}>
        {t('workbench.editors.mqtt.will.hint')}
      </Text>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
        <CodeEditorActions
          target={payloadActionsRef}
          language={PAYLOAD_FORMAT_LANGUAGE[draft.lastWill.format]}
          labels
          findText={t('workbench.editors.scriptEditor.find')}
          replaceText={t('workbench.editors.scriptEditor.replace')}
          formatText={t('workbench.editors.scriptEditor.beautify')}
        />
        <EditorViewMenu wrap={wrapPayload} onWrapChange={setWrapPayload} data-testid="mqtt-will-editor-menu" />
      </div>
      <div style={{ flex: 1, minHeight: 100, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          <CodeEditor
            value={draft.lastWill.payload}
            onChange={(payload) => setDraft((d) => ({ ...d, lastWill: { ...d.lastWill, payload } }))}
            language={PAYLOAD_FORMAT_LANGUAGE[draft.lastWill.format]}
            fill
            actions="external"
            actionsRef={payloadActionsRef}
            wordWrapOverride={wrapPayload ? 'on' : 'off'}
            placeholder={
              draft.lastWill.format === 'base64'
                ? t('workbench.editors.mqtt.payloadPlaceholderBase64')
                : draft.lastWill.format === 'hex'
                  ? t('workbench.editors.mqtt.payloadPlaceholderHex')
                  : t('workbench.editors.mqtt.will.payloadPlaceholder')
            }
          />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Select
          size="small"
          style={{ width: 120 }}
          value={draft.lastWill.format}
          onChange={(format: MqttPayloadFormat) => setDraft((d) => ({ ...d, lastWill: { ...d.lastWill, format } }))}
          options={[
            { value: 'text', label: t('workbench.editors.mqtt.payload.formatText') },
            { value: 'json', label: t('workbench.editors.mqtt.payload.formatJson') },
            { value: 'base64', label: t('workbench.editors.mqtt.payload.formatBase64') },
            { value: 'hex', label: t('workbench.editors.mqtt.payload.formatHex') },
          ]}
          data-testid="mqtt-will-format"
        />
        <span style={{ flex: 1 }} />
        <MessagePropertiesPopover
          value={draft.lastWill.properties}
          onChange={(properties) => setDraft((d) => ({ ...d, lastWill: { ...d.lastWill, properties } }))}
          v5={v5}
          testId="mqtt-will-props"
        />
        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', lineHeight: '24px' }}>
          {t('workbench.editors.mqtt.will.delayLabel')}
        </Text>
        {/* The empty knob means the default in effect — its stated
          default reads at full text contrast, the Settings-tab
          discipline. */}
        <ConfigProvider theme={{ components: { Select: { colorTextPlaceholder: token.colorText } } }}>
          <Tooltip title={v5 ? undefined : t('workbench.editors.mqtt.will.delayHelp')}>
            <span style={{ display: 'inline-flex' }}>
              <ComboKnob
                value={draft.lastWill.willDelayInterval}
                onChange={(willDelayInterval) =>
                  setDraft((d) => ({ ...d, lastWill: { ...d.lastWill, willDelayInterval } }))
                }
                presets={WILL_DELAY_PRESETS}
                interpret={interpretWillDelay}
                format={formatDurationSeconds}
                placeholder={t('workbench.editors.mqtt.will.delayPlaceholder')}
                disabled={!v5}
                ariaLabel={t('workbench.editors.mqtt.will.delayLabel')}
                style={{ width: 130 }}
                testId="mqtt-will-delay"
              />
            </span>
          </Tooltip>
        </ConfigProvider>
        <Checkbox
          checked={draft.lastWill.retain}
          onChange={(e) => setDraft((d) => ({ ...d, lastWill: { ...d.lastWill, retain: e.target.checked } }))}
          data-testid="mqtt-will-retain"
        >
          {t('workbench.editors.mqtt.retainLabel')}
        </Checkbox>
        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', lineHeight: '24px' }}>
          {t('workbench.editors.mqtt.qos.compactLabel')}
        </Text>
        <Select
          size="small"
          style={{ width: 46 }}
          suffixIcon={null}
          popupMatchSelectWidth={false}
          value={draft.lastWill.qos}
          onChange={(qos: MqttRequestQos) => setDraft((d) => ({ ...d, lastWill: { ...d.lastWill, qos } }))}
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
          data-testid="mqtt-will-qos"
        />
        {/* Statement placeholder + the muted example below — the
          settings-row TextKnob discipline. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 200 }}>
          <Input
            size="small"
            style={{ fontFamily: "'SF Mono', monospace", fontSize: 12 }}
            placeholder={t('workbench.editors.mqtt.will.topicPlaceholder')}
            value={draft.lastWill.topic}
            onChange={(e) => setDraft((d) => ({ ...d, lastWill: { ...d.lastWill, topic: e.target.value } }))}
            data-testid="mqtt-will-topic"
          />
          <Text type="secondary" style={{ fontSize: 11 }}>
            {t('workbench.editors.mqtt.will.topicExample')}
          </Text>
        </div>
      </div>
      {encodingError !== null && (
        <Text type="danger" style={{ fontSize: 11 }} data-testid="mqtt-will-encoding-error">
          {encodingError === 'base64'
            ? t('workbench.editors.mqtt.payload.invalidBase64')
            : t('workbench.editors.mqtt.payload.invalidHex')}
        </Text>
      )}
    </div>
  );
};

export default MqttLastWillTab;
