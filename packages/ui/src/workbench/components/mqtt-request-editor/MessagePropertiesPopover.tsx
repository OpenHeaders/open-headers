/**
 * Per-message 5.0 properties popover — the gear on the publish compose
 * and the Last Will tab, in the topic-options anatomy: hint line, the
 * Properties section (user properties), a hairline, then the Settings
 * section as labeled (i) rows lighting the shared example's PUBLISH
 * leg. 3.1.1 renders the controls disabled with the honest version
 * line (never a silent drop — the codec is encode-strict either way).
 */

import { PlusOutlined, SettingOutlined } from '@ant-design/icons';
import { generateUid } from '@openheaders/core/utils';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoPopoverContainerProvider } from '@openheaders/ui/shared/info-popover';
import { Badge, Button, ConfigProvider, Input, InputNumber, Popover, Switch, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useRef, useState } from 'react';
import type { MqttMessagePropertiesDraft } from './draft';
import { mqttSettingsRowInfo } from './MqttSettingsRowInfo';
import OptionLabel from './OptionLabel';

const { Text } = Typography;

/** The (i) popovers portal INSIDE this popover — portaled to body
 *  they would count as an outside click and close it. */
const resolvePropsPopover = (node: HTMLElement): HTMLElement | null =>
  node.closest<HTMLElement>('.oh-mqtt-message-props');

const MessagePropertiesPopover: React.FC<{
  value: MqttMessagePropertiesDraft;
  onChange: (next: MqttMessagePropertiesDraft) => void;
  v5: boolean;
  testId: string;
}> = ({ value, onChange, v5, testId }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [open, setOpen] = useState(false);
  const userPropsRef = useRef<HTMLDivElement | null>(null);
  const configured =
    value.userProperties.some((row) => row.key.trim() !== '') ||
    value.responseTopic !== '' ||
    value.correlationData !== '' ||
    value.messageExpiryInterval !== undefined ||
    value.contentType !== '' ||
    value.payloadFormatIndicator;
  const set = (patch: Partial<MqttMessagePropertiesDraft>) => onChange({ ...value, ...patch });
  const content = (
    <InfoPopoverContainerProvider resolver={resolvePropsPopover}>
      <div
        className="oh-mqtt-message-props"
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          width: 'max-content',
          maxWidth: 420,
        }}
        data-testid={`${testId}-popover`}
      >
        <Text type="secondary" style={{ fontSize: 11 }}>
          {v5 ? t('workbench.editors.mqtt.props.hint') : t('workbench.editors.mqtt.props.v311')}
        </Text>
        <OptionLabel
          strong
          text={t('workbench.editors.mqtt.props.sectionProperties')}
          info={mqttSettingsRowInfo(t, 'publishProperties')}
        />
        {/* The list shows four rows and scrolls instead of growing the
          popover row by row; the right gutter keeps the scrollbar off
          the remove buttons. */}
        {value.userProperties.length > 0 && (
          <div
            ref={userPropsRef}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              maxHeight: 108,
              overflowY: 'auto',
              paddingRight: 10,
            }}
          >
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
          </div>
        )}
        <Button
          size="small"
          type="dashed"
          icon={<PlusOutlined style={{ fontSize: 10 }} />}
          disabled={!v5}
          style={{ fontSize: 11, alignSelf: 'flex-start' }}
          onClick={() => {
            set({ userProperties: [...value.userProperties, { uid: generateUid(), key: '', value: '' }] });
            requestAnimationFrame(() => {
              userPropsRef.current?.scrollTo({ top: userPropsRef.current.scrollHeight });
            });
          }}
          data-testid={`${testId}-add-user-prop`}
        >
          {t('workbench.editors.mqtt.props.addUserProp')}
        </Button>
        <div style={{ height: 1, background: token.colorSplit }} />
        <OptionLabel
          strong
          text={t('workbench.editors.mqtt.props.sectionSettings')}
          info={mqttSettingsRowInfo(t, 'publishSettings')}
        />
        {/* One anatomy for every row: the label column left, the
          control column right — explanations live behind the (i)
          popovers, never inline in the labels. An empty knob means the
          default in effect — its stated default reads at full text
          contrast, the Settings-tab discipline. */}
        <ConfigProvider
          theme={{
            components: {
              Input: { colorTextPlaceholder: token.colorText },
              InputNumber: { colorTextPlaceholder: token.colorText },
            },
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              columnGap: 12,
              rowGap: 8,
              alignItems: 'center',
            }}
          >
            <OptionLabel
              text={t('workbench.editors.mqtt.props.responseTopic')}
              info={mqttSettingsRowInfo(t, 'responseTopic')}
            />
            <Input
              size="small"
              style={{ width: 200 }}
              placeholder={t('workbench.editors.mqtt.props.nonePlaceholder')}
              value={value.responseTopic}
              disabled={!v5}
              onChange={(e) => set({ responseTopic: e.target.value })}
              data-testid={`${testId}-response-topic`}
            />
            <OptionLabel
              text={t('workbench.editors.mqtt.props.correlationData')}
              info={mqttSettingsRowInfo(t, 'correlationData')}
            />
            <Input
              size="small"
              style={{ width: 200 }}
              placeholder={t('workbench.editors.mqtt.props.nonePlaceholder')}
              value={value.correlationData}
              disabled={!v5}
              onChange={(e) => set({ correlationData: e.target.value })}
            />
            <OptionLabel
              text={t('workbench.editors.mqtt.props.messageExpiry')}
              info={mqttSettingsRowInfo(t, 'messageExpiry')}
            />
            <InputNumber
              size="small"
              min={0}
              max={0xffff_ffff}
              value={value.messageExpiryInterval}
              disabled={!v5}
              onChange={(next) => set({ messageExpiryInterval: next ?? undefined })}
              placeholder={t('workbench.editors.mqtt.props.messageExpiryPlaceholder')}
              style={{ width: 120 }}
            />
            <OptionLabel
              text={t('workbench.editors.mqtt.props.contentType')}
              info={mqttSettingsRowInfo(t, 'contentType')}
            />
            <Input
              size="small"
              style={{ width: 200 }}
              placeholder={t('workbench.editors.mqtt.props.nonePlaceholder')}
              value={value.contentType}
              disabled={!v5}
              onChange={(e) => set({ contentType: e.target.value })}
            />
            <OptionLabel
              text={t('workbench.editors.mqtt.props.payloadFormatIndicator')}
              info={mqttSettingsRowInfo(t, 'payloadFormatIndicator')}
            />
            <Switch
              size="small"
              style={{ justifySelf: 'start' }}
              checked={value.payloadFormatIndicator}
              disabled={!v5}
              onChange={(payloadFormatIndicator) => set({ payloadFormatIndicator })}
            />
          </div>
        </ConfigProvider>
      </div>
    </InfoPopoverContainerProvider>
  );
  return (
    <Popover content={content} trigger="click" placement="bottom" open={open} onOpenChange={setOpen}>
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
