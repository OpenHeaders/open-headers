/**
 * Per-row 5.0 subscription options popover — the gear on the topics
 * grid, the message-properties popover's sibling on the gear anatomy,
 * split the way the SUBSCRIBE packet is (the user's call, S8: the spec
 * over a shared shape): a title row "Subscription options" with its
 * (i) card over the options byte's three knobs (No Local, Retain As
 * Published, Retain Handling — the row's QoS is the fourth bit, on the
 * grid); a hairline; "Subscription properties" over the Subscription
 * Identifier; a hairline; "User properties" over the list — the two
 * things the spec files as properties of the packet, each under its
 * own row. Every section row wears the packet as a mark. Every label
 * is the spec's word; "Settings" never appears inside a gear. 3.1.1
 * renders the controls disabled under a first line that says why and
 * offers the switch to 5.0. The gear wears a dot once any value leaves its default, and
 * its hover tooltip yields the instant the popover opens. The gear is
 * icon + word (the user's call, S8), as the bars' gears.
 */

import { PlusOutlined, SettingOutlined } from '@ant-design/icons';
import type { MqttRetainHandling, MqttTopicRow } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoPopoverContainerProvider } from '@openheaders/ui/shared/info-popover';
import { Badge, Button, ConfigProvider, Input, InputNumber, Popover, Select, Switch, Tooltip, theme } from 'antd';
import type React from 'react';
import { useRef, useState } from 'react';
import { ModifiedDot } from '@openheaders/ui/shared/settings-rows';
import {
  modifiedTopicOptionKeys,
  type TopicOptionKnobKey,
  type TopicOptionsUnsaved,
  userPropertyRowModified,
} from './mqtt-gear-unsaved';
import { mqttGearPacket, mqttSettingsRowInfo } from './MqttSettingsRowInfo';
import OptionControl from './OptionControl';
import OptionLabel from './OptionLabel';
import VersionGateLine from './VersionGateLine';

/** The (i) popovers portal INSIDE this popover — portaled to body
 *  they would count as an outside click and close it. */
const resolveOptionsPopover = (node: HTMLElement): HTMLElement | null =>
  node.closest<HTMLElement>('.oh-mqtt-topic-options');

/** True once any subscription option or property leaves its default —
 *  the gear's neutral dot. A user property counts only with a key
 *  written. */
export const topicOptionsConfigured = (row: MqttTopicRow): boolean => modifiedTopicOptionKeys(row).size > 0;

const GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  columnGap: 12,
  rowGap: 8,
  alignItems: 'center',
};

const TopicOptionsPopover: React.FC<{
  row: MqttTopicRow;
  onChange: (next: MqttTopicRow) => void;
  v5: boolean;
  /** The row's knobs differing from the saved request — the rows'
   *  salmon dots and the gear's; absent (no baseline) reads all-clean. */
  unsaved?: TopicOptionsUnsaved;
  /** Flips the REQUEST to 5.0 — the first line's button on 3.1.1. */
  onSwitchToV5?: () => void;
}> = ({ row, onChange, v5, unsaved, onSwitchToV5 }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [open, setOpen] = useState(false);
  const userPropsRef = useRef<HTMLDivElement | null>(null);
  const userProperties = row.userProperties ?? [];
  // The rows' dots: neutral while a knob is off its default, salmon
  // while it differs from the saved request; the gear's badge wears
  // the stronger of them (never red — MQTT has no unresolved tier).
  const modified = modifiedTopicOptionKeys(row);
  const dot = (key: TopicOptionKnobKey) => ({ modified: modified.has(key), unsaved: unsaved?.knobs.has(key) === true });
  const anyUnsaved = unsaved !== undefined && (unsaved.knobs.size > 0 || unsaved.rows.size > 0);
  const badgeTone = anyUnsaved ? 'unsaved' : modified.size > 0 ? 'modified' : null;
  // The row's undo: back to the knob's default while it is off it —
  // an absent key, which the save projection then drops.
  const reset = (key: TopicOptionKnobKey, labelKey: MessageKey) => ({
    label: t(labelKey),
    modified: modified.has(key),
    disabled: !v5,
    onReset: () => onChange({ ...row, [key]: undefined }),
  });
  const hairline = <div style={{ height: 1, background: token.colorSplit }} />;
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
          // Room for the 3.1.1 gate line on one line in every locale.
          maxWidth: 520,
        }}
        data-testid="mqtt-topic-options-popover"
      >
        {!v5 && <VersionGateLine onSwitchToV5={onSwitchToV5} testId="mqtt-topic-options-v5-gate" />}
        {/* Every section row wears the PACKET the popover rides — the
          user's call: each home of user properties says its packet
          where the list is, not only at the top. */}
        <OptionLabel
          strong
          text={t('workbench.editors.mqtt.topics.optionsTitle')}
          mark={mqttGearPacket('subscriptionOptions')}
          info={mqttSettingsRowInfo(t, 'subscriptionOptions')}
        />
        {/* One anatomy for every row: the label column left, the
          control column right — explanations live behind the (i)
          popovers, never inline in the labels. An empty knob means the
          default in effect — its stated default reads at full text
          contrast, the Settings-tab discipline. */}
        <ConfigProvider theme={{ components: { InputNumber: { colorTextPlaceholder: token.colorText } } }}>
          <div className="oh-stated-default" style={GRID_STYLE}>
            <OptionLabel
              text={t('workbench.editors.mqtt.topics.noLocal')}
              info={mqttSettingsRowInfo(t, 'noLocal')}
              {...dot('noLocal')}
            />
            <OptionControl {...reset('noLocal', 'workbench.editors.mqtt.topics.noLocal')}>
              <Switch
                size="small"
                disabled={!v5}
                checked={row.noLocal === true}
                onChange={(noLocal) => onChange({ ...row, noLocal })}
                data-testid="mqtt-topic-nolocal"
              />
            </OptionControl>
            <OptionLabel
              text={t('workbench.editors.mqtt.topics.retainAsPublished')}
              info={mqttSettingsRowInfo(t, 'retainAsPublished')}
              {...dot('retainAsPublished')}
            />
            <OptionControl {...reset('retainAsPublished', 'workbench.editors.mqtt.topics.retainAsPublished')}>
              <Switch
                size="small"
                disabled={!v5}
                checked={row.retainAsPublished === true}
                onChange={(retainAsPublished) => onChange({ ...row, retainAsPublished })}
              />
            </OptionControl>
            <OptionLabel
              text={t('workbench.editors.mqtt.topics.retainHandling')}
              info={mqttSettingsRowInfo(t, 'retainHandling')}
              {...dot('retainHandling')}
            />
            <OptionControl {...reset('retainHandling', 'workbench.editors.mqtt.topics.retainHandling')}>
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
            </OptionControl>
          </div>
          {hairline}
          <OptionLabel
            strong
            text={t('workbench.editors.mqtt.topics.subscribeProperties')}
            mark={mqttGearPacket('subscribeProperties')}
            info={mqttSettingsRowInfo(t, 'subscribeProperties')}
          />
          <div className="oh-stated-default" style={GRID_STYLE}>
            <OptionLabel
              text={t('workbench.editors.mqtt.topics.subscriptionId')}
              info={mqttSettingsRowInfo(t, 'subscriptionId')}
              {...dot('subscriptionId')}
            />
            <OptionControl {...reset('subscriptionId', 'workbench.editors.mqtt.topics.subscriptionId')}>
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
            </OptionControl>
          </div>
        </ConfigProvider>
        {hairline}
        <OptionLabel
          strong
          text={t('workbench.editors.mqtt.props.userProperties')}
          mark={mqttGearPacket('subscribeUserProperties')}
          info={mqttSettingsRowInfo(t, 'subscribeUserProperties')}
          {...dot('userProperties')}
        />
        {/* User Properties ride ONCE on this row's SUBSCRIBE packet —
          broker-defined metadata, never echoed on delivered messages
          (the section's (i) carries that honestly). The list shows
          four rows and scrolls instead of growing the popover row by
          row; the right gutter keeps the scrollbar off the remove
          buttons. */}
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
                  {(unsaved?.rows.has(prop.uid) === true || userPropertyRowModified(prop)) && (
                    <ModifiedDot unsaved={unsaved?.rows.has(prop.uid) === true} />
                  )}
                </span>
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
          style={{ fontSize: 11, alignSelf: 'flex-start', marginLeft: 20 }}
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
      </div>
    </InfoPopoverContainerProvider>
  );
  return (
    <Popover content={content} trigger="click" placement="bottom" open={open} onOpenChange={setOpen}>
      {/* The hover tooltip yields INSTANTLY once the popover opens —
        open suppresses it (the message-properties discipline). */}
      <Tooltip title={t('workbench.editors.mqtt.topics.optionsTitle')} open={open ? false : undefined}>
        <Badge
          dot={badgeTone !== null}
          color={badgeTone === 'unsaved' ? '#ff7875' : token.colorTextSecondary}
          offset={[-2, 2]}
        >
          {/* Icon + word, as the bars' gears — the user's call; the
            Options track pays for the word. */}
          <Button
            size="small"
            type="text"
            icon={<SettingOutlined />}
            style={{ marginLeft: 4, fontSize: 12 }}
            data-testid="mqtt-topic-options"
          >
            {t('workbench.editors.mqtt.topics.optionsGearLabel')}
          </Button>
        </Badge>
      </Tooltip>
    </Popover>
  );
};

export default TopicOptionsPopover;
