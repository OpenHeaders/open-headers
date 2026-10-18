/**
 * MqttLastWillTab — the will registered with the broker on CONNECT and
 * published by it if the session drops without a clean disconnect.
 * Mirrors the Message-tab anatomy (toolbar cluster above the editor,
 * the compose bar below it) minus what a will has no use for: no
 * saved-messages rail, no Send — the will travels with CONNECT — plus
 * the one 5.0 extra, Will Delay. The block persists once any field
 * leaves its default — what is typed is saved; the wire's topic gate
 * is the executor's at CONNECT, so an empty topic means no will is
 * registered. The 5.0-only knobs (delay interval, properties) render
 * disabled-honest on 3.1.1.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  ComboKnob,
  durationSecondsInterpreter,
  formatDurationSeconds,
  numericPresets,
} from '@openheaders/ui/shared/combo-knob';
import { Checkbox, ConfigProvider, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { type Dispatch, type SetStateAction, useRef, useState } from 'react';
import CodeEditor from '../shared/CodeEditor';
import CodeEditorActions, { type CodeEditorActionsTarget } from '../shared/CodeEditorActions';
import EditorViewMenu from '../shared/EditorViewMenu';
import { PAYLOAD_FORMAT_LANGUAGE, payloadFormatForLanguage } from './compose';
import {
  CompactQosSelect,
  ComposeLabel,
  EncodingErrorLine,
  EncodingSelect,
  payloadPlaceholder,
  TopicField,
} from './compose-parts';
import { mqttSettingsRowInfo } from './MqttSettingsRowInfo';
import { type MqttDraft, payloadEncodingError } from './draft';
import type { MessagePropertiesUnsaved } from './mqtt-gear-unsaved';
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
  /** The will-properties knobs differing from the saved request — the
   *  gear's row dots. */
  unsavedProperties?: MessagePropertiesUnsaved;
}

const MqttLastWillTab: React.FC<MqttLastWillTabProps> = ({ draft, setDraft, v5, unsavedProperties }) => {
  const { token } = theme.useToken();
  const t = useT();
  // Will-editor wrap — the compose-editor default carries over (ON;
  // payloads are prose-like, scrolling hides the tail).
  const [wrapPayload, setWrapPayload] = useState(true);
  const payloadActionsRef = useRef<CodeEditorActionsTarget | null>(null);
  // No Send gates the will, so the encoding gate surfaces inline only.
  const encodingError = payloadEncodingError(draft.lastWill.payload, draft.lastWill.format);
  const editorPlaceholder = payloadPlaceholder(
    t,
    draft.lastWill.format,
    t('workbench.editors.mqtt.will.payloadPlaceholder'),
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
        <CodeEditorActions
          target={payloadActionsRef}
          language={PAYLOAD_FORMAT_LANGUAGE[draft.lastWill.format]}
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
            placeholder={editorPlaceholder}
            onLanguageDetected={(language) => {
              const format = payloadFormatForLanguage(language);
              if (format !== null) setDraft((d) => ({ ...d, lastWill: { ...d.lastWill, format } }));
            }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <EncodingSelect
          value={draft.lastWill.format}
          onChange={(format) => setDraft((d) => ({ ...d, lastWill: { ...d.lastWill, format } }))}
          testId="mqtt-will-format"
        />
        <span style={{ flex: 1 }} />
        <MessagePropertiesPopover
          value={draft.lastWill.properties}
          onChange={(properties) => setDraft((d) => ({ ...d, lastWill: { ...d.lastWill, properties } }))}
          v5={v5}
          leg="will"
          unsaved={unsavedProperties}
          testId="mqtt-will-props"
        />
        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', lineHeight: '24px' }}>
          <ComposeLabel text={t('workbench.editors.mqtt.will.delayLabel')} info={mqttSettingsRowInfo(t, 'willDelay')} />
        </Text>
        {/* The empty knob means the default in effect — its stated
          default reads at full text contrast, the Settings-tab
          discipline. */}
        <ConfigProvider theme={{ components: { Select: { colorTextPlaceholder: token.colorText } } }}>
          <Tooltip title={v5 ? undefined : t('workbench.editors.mqtt.will.delayHelp')}>
            <span className="oh-stated-default" style={{ display: 'inline-flex' }}>
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
          <ComposeLabel text={t('workbench.editors.mqtt.retainLabel')} info={mqttSettingsRowInfo(t, 'willRetain')} />
        </Checkbox>
        <CompactQosSelect
          value={draft.lastWill.qos}
          onChange={(qos) => setDraft((d) => ({ ...d, lastWill: { ...d.lastWill, qos } }))}
          info={mqttSettingsRowInfo(t, 'willQos')}
          testId="mqtt-will-qos"
        />
        <TopicField
          value={draft.lastWill.topic}
          onChange={(topic) => setDraft((d) => ({ ...d, lastWill: { ...d.lastWill, topic } }))}
          placeholder={t('workbench.editors.mqtt.will.topicPlaceholder')}
          example={t('workbench.editors.mqtt.will.topicExample')}
          info={mqttSettingsRowInfo(t, 'willTopic')}
          testId="mqtt-will-topic"
        />
      </div>
      <EncodingErrorLine error={encodingError} testId="mqtt-will-encoding-error" />
    </div>
  );
};

export default MqttLastWillTab;
