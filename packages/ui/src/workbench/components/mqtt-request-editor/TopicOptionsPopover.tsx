/**
 * Per-row 5.0 subscription options popover — the gear on the topics
 * grid, the message-options popover's sibling on the one anatomy: hint
 * line, the Properties section (user properties riding the SUBSCRIBE
 * packet), a hairline, then the Settings section as labeled (i) rows
 * lighting the shared example's SUBSCRIBE leg. 3.1.1 renders the
 * controls disabled with the honest version line. The gear wears a
 * dot once any option leaves its default, and its hover tooltip
 * yields the instant the popover opens.
 */

import { PlusOutlined, SettingOutlined } from '@ant-design/icons';
import type { MqttRetainHandling, MqttTopicRow } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoPopoverContainerProvider } from '@openheaders/ui/shared/info-popover';
import {
  Badge,
  Button,
  ConfigProvider,
  Input,
  InputNumber,
  Popover,
  Select,
  Switch,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type React from 'react';
import { useRef, useState } from 'react';
import { mqttSettingsRowInfo } from './MqttSettingsRowInfo';
import OptionLabel from './OptionLabel';

const { Text } = Typography;

/** The (i) popovers portal INSIDE this popover — portaled to body
 *  they would count as an outside click and close it. */
const resolveOptionsPopover = (node: HTMLElement): HTMLElement | null =>
  node.closest<HTMLElement>('.oh-mqtt-topic-options');

/** True once any subscription option leaves its default — the gear's
 *  dot. A user property counts only with a key written. */
export const topicOptionsConfigured = (row: MqttTopicRow): boolean =>
  (row.userProperties ?? []).some((prop) => prop.key.trim() !== '') ||
  row.noLocal === true ||
  row.retainAsPublished === true ||
  (row.retainHandling !== undefined && row.retainHandling !== 0) ||
  row.subscriptionId !== undefined;

const TopicOptionsPopover: React.FC<{
  row: MqttTopicRow;
  onChange: (next: MqttTopicRow) => void;
  v5: boolean;
}> = ({ row, onChange, v5 }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [open, setOpen] = useState(false);
  const userPropsRef = useRef<HTMLDivElement | null>(null);
  const userProperties = row.userProperties ?? [];
  const content = (
    <InfoPopoverContainerProvider resolver={resolveOptionsPopover}>
      <div
        className="oh-mqtt-topic-options"
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          width: 'max-content',
          maxWidth: 420,
        }}
        data-testid="mqtt-topic-options-popover"
      >
        <Text type="secondary" style={{ fontSize: 11 }}>
          {v5 ? t('workbench.editors.mqtt.topics.optionsHint') : t('workbench.editors.mqtt.props.v311')}
        </Text>
        {/* User Properties ride ONCE on this row's SUBSCRIBE packet —
          broker-defined metadata, never echoed on delivered messages
          (the (i) carries that honestly). */}
        <OptionLabel
          strong
          text={t('workbench.editors.mqtt.topics.subscribeProperties')}
          info={mqttSettingsRowInfo(t, 'subscribeProperties')}
        />
        {/* The list shows four rows and scrolls instead of growing the
          popover row by row; the right gutter keeps the scrollbar off
          the remove buttons. */}
        {userProperties.length > 0 && (
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
            {userProperties.map((prop, index) => (
              <div key={prop.uid} style={{ display: 'flex', gap: 4 }}>
                <Input
                  size="small"
                  placeholder={t('workbench.editors.mqtt.props.userPropKey')}
                  value={prop.key}
                  disabled={!v5}
                  onChange={(e) => {
                    const next = [...userProperties];
                    next[index] = { ...prop, key: e.target.value };
                    onChange({ ...row, userProperties: next });
                  }}
                  data-testid="mqtt-topic-userprop-key"
                />
                <Input
                  size="small"
                  placeholder={t('workbench.editors.mqtt.props.userPropValue')}
                  value={prop.value}
                  disabled={!v5}
                  onChange={(e) => {
                    const next = [...userProperties];
                    next[index] = { ...prop, value: e.target.value };
                    onChange({ ...row, userProperties: next });
                  }}
                  data-testid="mqtt-topic-userprop-value"
                />
                <Button
                  size="small"
                  type="text"
                  disabled={!v5}
                  aria-label={t('workbench.editors.mqtt.props.removeUserProp')}
                  onClick={() => {
                    const next = userProperties.filter((r) => r.uid !== prop.uid);
                    onChange({ ...row, userProperties: next.length > 0 ? next : undefined });
                  }}
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
            onChange({ ...row, userProperties: [...userProperties, { uid: generateUid(), key: '', value: '' }] });
            requestAnimationFrame(() => {
              userPropsRef.current?.scrollTo({ top: userPropsRef.current.scrollHeight });
            });
          }}
          data-testid="mqtt-topic-add-userprop"
        >
          {t('workbench.editors.mqtt.props.addUserProp')}
        </Button>
        <div style={{ height: 1, background: token.colorSplit }} />
        <OptionLabel
          strong
          text={t('workbench.editors.mqtt.topics.subscribeSettings')}
          info={mqttSettingsRowInfo(t, 'subscribeSettings')}
        />
        {/* One anatomy for every row: the label column left, the
          control column right — explanations live behind the (i)
          popovers, never inline in the labels. An empty knob means the
          default in effect — its stated default reads at full text
          contrast, the Settings-tab discipline. */}
        <ConfigProvider theme={{ components: { InputNumber: { colorTextPlaceholder: token.colorText } } }}>
          <div
            className="oh-stated-default"
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              columnGap: 12,
              rowGap: 8,
              alignItems: 'center',
            }}
          >
            <OptionLabel text={t('workbench.editors.mqtt.topics.noLocal')} info={mqttSettingsRowInfo(t, 'noLocal')} />
            <Switch
              size="small"
              style={{ justifySelf: 'start' }}
              disabled={!v5}
              checked={row.noLocal === true}
              onChange={(noLocal) => onChange({ ...row, noLocal })}
              data-testid="mqtt-topic-nolocal"
            />
            <OptionLabel
              text={t('workbench.editors.mqtt.topics.retainAsPublished')}
              info={mqttSettingsRowInfo(t, 'retainAsPublished')}
            />
            <Switch
              size="small"
              style={{ justifySelf: 'start' }}
              disabled={!v5}
              checked={row.retainAsPublished === true}
              onChange={(retainAsPublished) => onChange({ ...row, retainAsPublished })}
            />
            <OptionLabel
              text={t('workbench.editors.mqtt.topics.retainHandling')}
              info={mqttSettingsRowInfo(t, 'retainHandling')}
            />
            <Select
              size="small"
              style={{ width: 200 }}
              disabled={!v5}
              popupMatchSelectWidth={false}
              value={row.retainHandling ?? 0}
              options={[
                // title stays empty — the label's (i) popover carries
                // the values; the native label-title would double the
                // hover.
                { value: 0, title: '', label: t('workbench.editors.mqtt.topics.retainHandling0') },
                { value: 1, title: '', label: t('workbench.editors.mqtt.topics.retainHandling1') },
                { value: 2, title: '', label: t('workbench.editors.mqtt.topics.retainHandling2') },
              ]}
              onChange={(retainHandling: MqttRetainHandling) => onChange({ ...row, retainHandling })}
            />
            <OptionLabel
              text={t('workbench.editors.mqtt.topics.subscriptionId')}
              info={mqttSettingsRowInfo(t, 'subscriptionId')}
            />
            <InputNumber
              size="small"
              min={1}
              max={268_435_455}
              disabled={!v5}
              value={row.subscriptionId}
              onChange={(next) => onChange({ ...row, subscriptionId: next ?? undefined })}
              placeholder={t('workbench.editors.mqtt.topics.subscriptionIdPlaceholder')}
              style={{ width: 200 }}
            />
          </div>
        </ConfigProvider>
      </div>
    </InfoPopoverContainerProvider>
  );
  return (
    <Popover content={content} trigger="click" placement="bottom" open={open} onOpenChange={setOpen}>
      {/* The hover tooltip yields INSTANTLY once the popover opens —
        open suppresses it (the message-options discipline). */}
      <Tooltip title={t('workbench.editors.mqtt.topics.optionsTooltip')} open={open ? false : undefined}>
        <Badge dot={topicOptionsConfigured(row)} offset={[-2, 2]}>
          <Button
            size="small"
            type="text"
            icon={<SettingOutlined />}
            style={{ marginLeft: 4 }}
            data-testid="mqtt-topic-options"
          />
        </Badge>
      </Tooltip>
    </Popover>
  );
};

export default TopicOptionsPopover;
