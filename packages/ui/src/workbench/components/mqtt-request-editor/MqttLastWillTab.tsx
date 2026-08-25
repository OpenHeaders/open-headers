/**
 * MqttLastWillTab — the will registered with the broker on CONNECT and
 * published by it if the session drops without a clean disconnect. An
 * empty topic means no will (the entity law); the payload authors per
 * its own ENCODING; the 5.0-only knobs (delay interval, properties)
 * render disabled-honest on 3.1.1.
 */

import type { MqttPayloadFormat, MqttRequestQos } from '@openheaders/core/types';
import { useT, type Translate } from '@openheaders/ui/context/LocaleContext';
import { Checkbox, Input, InputNumber, Segmented, Select, Tooltip, Typography } from 'antd';
import type React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import CodeEditor from '../shared/CodeEditor';
import { PAYLOAD_FORMAT_LANGUAGE } from './compose';
import type { MqttDraft } from './draft';
import MessagePropertiesPopover from './MessagePropertiesPopover';

const { Text } = Typography;

const QOS_OPTIONS = (t: Translate) => [
  { value: 0, label: t('workbench.editors.mqtt.qos.q0') },
  { value: 1, label: t('workbench.editors.mqtt.qos.q1') },
  { value: 2, label: t('workbench.editors.mqtt.qos.q2') },
];

interface MqttLastWillTabProps {
  draft: MqttDraft;
  setDraft: Dispatch<SetStateAction<MqttDraft>>;
  v5: boolean;
}

const MqttLastWillTab: React.FC<MqttLastWillTabProps> = ({ draft, setDraft, v5 }) => {
  const t = useT();
  return (
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
  );
};

export default MqttLastWillTab;
