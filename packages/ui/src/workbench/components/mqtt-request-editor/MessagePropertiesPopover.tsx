/**
 * Per-message 5.0 properties popover — the gear on the publish compose
 * and the Last Will tab, the gear anatomy shared with the topic-options
 * popover: a title row naming the packet's properties with its (i)
 * card (the whole slice lit), the named properties as labeled (i)
 * rows, a hairline, then the User Properties section (scrolling list +
 * dashed Add) — user properties last, where every packet's property
 * table and every CLI puts them. Every label is the spec's word for the
 * thing on the wire; "Settings" never appears inside a gear. The cards
 * light the PUBLISH leg of the shared example on the publish leg and
 * the will line of the CONNECT leg on the will leg (the Will
 * Properties travel inside CONNECT). 3.1.1 renders the controls
 * disabled — the title card carries the version rule (never a silent
 * drop — the codec is encode-strict either way). The gear is icon +
 * word on the bar, where no column header names it.
 */

import { PlusOutlined, SettingOutlined } from '@ant-design/icons';
import { generateUid } from '@openheaders/core/utils';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  ComboKnob,
  durationSecondsInterpreter,
  formatDurationSeconds,
  numericPresets,
} from '@openheaders/ui/shared/combo-knob';
import { InfoPopoverContainerProvider } from '@openheaders/ui/shared/info-popover';
import { Badge, Button, ConfigProvider, Input, Popover, Switch, Tooltip, theme } from 'antd';
import type React from 'react';
import { useRef, useState } from 'react';
import type { MqttMessagePropertiesDraft } from './draft';
import { ModifiedDot } from '@openheaders/ui/shared/settings-rows';
import {
  type MessagePropertiesUnsaved,
  type MessagePropertyKnobKey,
  modifiedMessagePropertyKeys,
  userPropertyRowModified,
} from './mqtt-gear-unsaved';
import { type GearInfoKey, mqttGearPacket, mqttSettingsRowInfo } from './MqttSettingsRowInfo';
import OptionControl from './OptionControl';
import OptionLabel from './OptionLabel';

/** The packet the block rides — the Message bar's PUBLISH or the Last
 *  Will bar's CONNECT will line; each leg's cards light their own. */
export type MessagePropertiesLeg = 'publish' | 'will';

type MessagePropertiesSlot =
  | 'title'
  | 'userProperties'
  | 'responseTopic'
  | 'correlationData'
  | 'messageExpiry'
  | 'contentType'
  | 'payloadFormatIndicator';

const LEG_INFO: Record<MessagePropertiesLeg, Record<MessagePropertiesSlot, GearInfoKey>> = {
  publish: {
    title: 'publishProperties',
    userProperties: 'publishUserProperties',
    responseTopic: 'responseTopic',
    correlationData: 'correlationData',
    messageExpiry: 'messageExpiry',
    contentType: 'contentType',
    payloadFormatIndicator: 'payloadFormatIndicator',
  },
  will: {
    title: 'willProperties',
    userProperties: 'willUserProperties',
    responseTopic: 'willResponseTopic',
    correlationData: 'willCorrelationData',
    messageExpiry: 'willMessageExpiry',
    contentType: 'willContentType',
    payloadFormatIndicator: 'willPayloadFormatIndicator',
  },
};

// Wire = whole seconds (§3.3.2.3.3); absent = the message never expires.
const interpretMessageExpiry = durationSecondsInterpreter({ min: 0, max: 0xffff_ffff });
const MESSAGE_EXPIRY_PRESETS = numericPresets([60, 300, 3_600, 86_400], formatDurationSeconds);

/** The (i) popovers portal INSIDE this popover — portaled to body
 *  they would count as an outside click and close it. */
const resolvePropsPopover = (node: HTMLElement): HTMLElement | null =>
  node.closest<HTMLElement>('.oh-mqtt-message-props');

const MessagePropertiesPopover: React.FC<{
  value: MqttMessagePropertiesDraft;
  onChange: (next: MqttMessagePropertiesDraft) => void;
  v5: boolean;
  leg: MessagePropertiesLeg;
  /** The knobs differing from the saved request — the rows' salmon
   *  dots and the gear's; absent (no baseline) reads all-clean. */
  unsaved?: MessagePropertiesUnsaved;
  testId: string;
}> = ({ value, onChange, v5, leg, unsaved, testId }) => {
  const { token } = theme.useToken();
  const t = useT();
  const info = (slot: MessagePropertiesSlot) => mqttSettingsRowInfo(t, LEG_INFO[leg][slot]);
  const title = t(leg === 'publish' ? 'workbench.editors.mqtt.props.title' : 'workbench.editors.mqtt.will.propsTitle');
  const packet = mqttGearPacket(LEG_INFO[leg].title);
  const [open, setOpen] = useState(false);
  const userPropsRef = useRef<HTMLDivElement | null>(null);
  // The rows' dots: neutral while a knob is off its default, salmon
  // while it differs from the saved request; the gear's badge wears
  // the stronger of them (never red — MQTT has no unresolved tier).
  const modified = modifiedMessagePropertyKeys(value);
  const dot = (key: MessagePropertyKnobKey) => ({
    modified: modified.has(key),
    unsaved: unsaved?.knobs.has(key) === true,
  });
  const anyUnsaved = unsaved !== undefined && (unsaved.knobs.size > 0 || unsaved.rows.size > 0);
  const badgeTone = anyUnsaved ? 'unsaved' : modified.size > 0 ? 'modified' : null;
  const set = (patch: Partial<MqttMessagePropertiesDraft>) => onChange({ ...value, ...patch });
  // The row's undo: back to the knob's default while it is off it.
  const reset = (key: MessagePropertyKnobKey, labelKey: MessageKey, patch: Partial<MqttMessagePropertiesDraft>) => ({
    label: t(labelKey),
    modified: modified.has(key),
    disabled: !v5,
    onReset: () => set(patch),
  });
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
        {/* Both section rows wear the PACKET the popover rides — the
          user's call: each home of user properties says its packet
          where the list is, not only at the top. */}
        <OptionLabel strong text={title} mark={packet} info={info('title')} />
        {/* One anatomy for every row: the label column left, the
          control column right — explanations live behind the (i)
          popovers, never inline in the labels. An empty knob means the
          default in effect — its stated default reads at full text
          contrast, the Settings-tab discipline. */}
        <ConfigProvider
          theme={{
            components: {
              Input: { colorTextPlaceholder: token.colorText },
              Select: { colorTextPlaceholder: token.colorText },
            },
          }}
        >
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
            <OptionLabel
              text={t('workbench.editors.mqtt.props.responseTopic')}
              info={info('responseTopic')}
              {...dot('responseTopic')}
            />
            <OptionControl
              {...reset('responseTopic', 'workbench.editors.mqtt.props.responseTopic', { responseTopic: '' })}
            >
              <Input
                size="small"
                style={{ width: 200 }}
                placeholder={t('workbench.editors.mqtt.props.nonePlaceholder')}
                value={value.responseTopic}
                disabled={!v5}
                onChange={(e) => set({ responseTopic: e.target.value })}
                data-testid={`${testId}-response-topic`}
              />
            </OptionControl>
            <OptionLabel
              text={t('workbench.editors.mqtt.props.correlationData')}
              info={info('correlationData')}
              {...dot('correlationData')}
            />
            <OptionControl
              {...reset('correlationData', 'workbench.editors.mqtt.props.correlationData', { correlationData: '' })}
            >
              <Input
                size="small"
                style={{ width: 200 }}
                placeholder={t('workbench.editors.mqtt.props.nonePlaceholder')}
                value={value.correlationData}
                disabled={!v5}
                onChange={(e) => set({ correlationData: e.target.value })}
              />
            </OptionControl>
            <OptionLabel
              text={t('workbench.editors.mqtt.props.messageExpiry')}
              info={info('messageExpiry')}
              {...dot('messageExpiryInterval')}
            />
            <OptionControl
              {...reset('messageExpiryInterval', 'workbench.editors.mqtt.props.messageExpiry', {
                messageExpiryInterval: undefined,
              })}
            >
              <ComboKnob
                value={value.messageExpiryInterval}
                onChange={(messageExpiryInterval) => set({ messageExpiryInterval })}
                presets={MESSAGE_EXPIRY_PRESETS}
                interpret={interpretMessageExpiry}
                format={formatDurationSeconds}
                placeholder={t('workbench.editors.mqtt.props.messageExpiryPlaceholder')}
                disabled={!v5}
                ariaLabel={t('workbench.editors.mqtt.props.messageExpiry')}
                style={{ width: 200 }}
              />
            </OptionControl>
            <OptionLabel
              text={t('workbench.editors.mqtt.props.contentType')}
              info={info('contentType')}
              {...dot('contentType')}
            />
            <OptionControl {...reset('contentType', 'workbench.editors.mqtt.props.contentType', { contentType: '' })}>
              <Input
                size="small"
                style={{ width: 200 }}
                placeholder={t('workbench.editors.mqtt.props.nonePlaceholder')}
                value={value.contentType}
                disabled={!v5}
                onChange={(e) => set({ contentType: e.target.value })}
              />
            </OptionControl>
            <OptionLabel
              text={t('workbench.editors.mqtt.props.payloadFormatIndicator')}
              info={info('payloadFormatIndicator')}
              {...dot('payloadFormatIndicator')}
            />
            <OptionControl
              {...reset('payloadFormatIndicator', 'workbench.editors.mqtt.props.payloadFormatIndicator', {
                payloadFormatIndicator: false,
              })}
            >
              <Switch
                size="small"
                checked={value.payloadFormatIndicator}
                disabled={!v5}
                onChange={(payloadFormatIndicator) => set({ payloadFormatIndicator })}
              />
            </OptionControl>
          </div>
        </ConfigProvider>
        <div style={{ height: 1, background: token.colorSplit }} />
        <OptionLabel
          strong
          text={t('workbench.editors.mqtt.props.userProperties')}
          mark={packet}
          info={info('userProperties')}
          {...dot('userProperties')}
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
                {/* The row's dot in the knob rows' gutter: neutral
                  once its key is written, salmon while the saved
                  request lacks the row or holds it differently. */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 16,
                    flexShrink: 0,
                  }}
                >
                  {(unsaved?.rows.has(row.uid) === true || userPropertyRowModified(row)) && (
                    <ModifiedDot unsaved={unsaved?.rows.has(row.uid) === true} />
                  )}
                </span>
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
          style={{ fontSize: 11, alignSelf: 'flex-start', marginLeft: 20 }}
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
      </div>
    </InfoPopoverContainerProvider>
  );
  return (
    <Popover content={content} trigger="click" placement="bottom" open={open} onOpenChange={setOpen}>
      {/* The hover tooltip yields INSTANTLY once the popover opens —
        open suppresses it (the timeline sort-menu discipline). */}
      <Tooltip title={title} open={open ? false : undefined}>
        <Badge
          dot={badgeTone !== null}
          color={badgeTone === 'unsaved' ? '#ff7875' : token.colorTextSecondary}
          offset={[-2, 2]}
        >
          <Button size="small" icon={<SettingOutlined />} data-testid={testId}>
            {t('workbench.editors.mqtt.props.gearLabel')}
          </Button>
        </Badge>
      </Tooltip>
    </Popover>
  );
};

export default MessagePropertiesPopover;
