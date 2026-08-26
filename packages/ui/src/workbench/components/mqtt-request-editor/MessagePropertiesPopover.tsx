/**
 * Per-message 5.0 properties popover — the gear on the publish compose
 * and the Last Will tab (the topics-grid options trigger). 3.1.1 renders the controls disabled with the
 * honest version line (never a silent drop — the codec is
 * encode-strict either way).
 */

import { PlusOutlined, SettingOutlined } from '@ant-design/icons';
import { generateUid } from '@openheaders/core/utils';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Badge, Button, Input, InputNumber, Popover, Switch, Tooltip, Typography } from 'antd';
import type React from 'react';
import { useState } from 'react';
import type { MqttMessagePropertiesDraft } from './draft';

const { Text } = Typography;

const MessagePropertiesPopover: React.FC<{
  value: MqttMessagePropertiesDraft;
  onChange: (next: MqttMessagePropertiesDraft) => void;
  v5: boolean;
  testId: string;
}> = ({ value, onChange, v5, testId }) => {
  const t = useT();
  const [open, setOpen] = useState(false);
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
    <Popover content={content} trigger="click" placement="topRight" open={open} onOpenChange={setOpen}>
      {/* The hover tooltip yields INSTANTLY once the popover opens —
        open suppresses it (the timeline sort-menu discipline). */}
      <Tooltip title={t('workbench.editors.mqtt.props.buttonTooltip')} open={open ? false : undefined}>
        <Badge dot={configured} offset={[-2, 2]}>
          <Button size="small" icon={<SettingOutlined />} data-testid={testId} />
        </Badge>
      </Tooltip>
    </Popover>
  );
};

export default MessagePropertiesPopover;
