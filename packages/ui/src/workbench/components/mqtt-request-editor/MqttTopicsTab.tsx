/**
 * MqttTopicsTab — the subscription table. The stored table is the
 * DRAFT the session subscribes from at open; while the session is open
 * the Subscribe switch is the LIVE toggle — it rides the
 * `setMqttSubscription` rider and marks the row with its SUBACK grant
 * (QoS downgrades honest), never editing the stored row (the ratified
 * publication-gate idiom). Columns: Topic filter (the Params tables'
 * borderless `TemplateInput` cell), the ⋯ options slot (the 5.0
 * subscription options popover, disabled-honest on 3.1.1), the compact
 * QoS knob, Subscribe, Description.
 */

import { PlusOutlined, SettingOutlined } from '@ant-design/icons';
import { topicFilterError } from '@openheaders/core/mqtt';
import type { MqttRequestQos, MqttRetainHandling, MqttTopicRow } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoPopoverContainerProvider } from '@openheaders/ui/shared/info-popover';
import {
  Button,
  ConfigProvider,
  Input,
  InputNumber,
  Popover,
  Select,
  Switch,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type React from 'react';
import { cellFont } from '../request-editor/editable-grid-styles';
import { EditableGridTable } from '../request-editor/EditableGridTable';
import type { EditableRowAdapter } from '../request-editor/editable-grid-types';
import { TEMPLATE_INPUT_LINE_HEIGHT, TemplateInput } from '../template-input';
import { mqttSettingsRowInfo } from './MqttSettingsRowInfo';
import OptionLabel from './OptionLabel';
import { grantFailureLabel } from './session-display';
import type { LiveSubscriptionMark } from './useMqttSessionPlane';

const { Text } = Typography;

// The Params-cell metrics: center the collapsed line inside the 32px
// cell with symmetric padding (see `KeyValueTable`).
const CELL_LINE_PX = 12 * TEMPLATE_INPUT_LINE_HEIGHT;
const CELL_VERTICAL_PADDING = (32 - CELL_LINE_PX) / 2;

/** The (i) popovers portal INSIDE the options popover — portaled to
 *  body they would count as an outside click and close it. */
const resolveOptionsPopover = (node: HTMLElement): HTMLElement | null =>
  node.closest<HTMLElement>('.oh-mqtt-topic-options');

/** Topics-grid row adapter — the topic filter rides the key track; the
 *  ⋯ options slot, QoS and Subscribe each own an aux/value track. */
const TOPIC_ROW_ADAPTER: EditableRowAdapter<MqttTopicRow> = {
  getId: (r) => r.uid,
  getEnabled: () => true,
  setEnabled: (r) => r,
  getKey: (r) => r.topicFilter,
  setKey: (r, v) => ({ ...r, topicFilter: v }),
  getDescription: (r) => r.description ?? '',
  setDescription: (r, v) => ({ ...r, description: v }),
  // A minted row starts UNSUBSCRIBED (explicit false — absent still
  // reads as on for rows saved before this default): the user enables
  // the switch once the filter and options are written, and a row
  // typed mid-session never wears an ON switch no live subscription
  // backs.
  makeEmpty: () => ({ uid: generateUid(), topicFilter: '', subscribe: false }),
  isEmpty: (r) => !r.topicFilter && !r.description,
};

interface MqttTopicsTabProps {
  rows: MqttTopicRow[];
  onChange: (rows: MqttTopicRow[]) => void;
  v5: boolean;
  sessionOpen: boolean;
  liveSubs: ReadonlyMap<string, LiveSubscriptionMark>;
  onLiveToggle: (row: MqttTopicRow, subscribe: boolean) => void;
}

const MqttTopicsTab: React.FC<MqttTopicsTabProps> = ({ rows, onChange, v5, sessionOpen, liveSubs, onLiveToggle }) => {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="mqtt-topics-table">
      {/* The stored table is the DRAFT the session subscribes from at
        open — live Subscribe toggles will ride session riders, never
        edit these rows. */}
      <Text type="secondary" style={{ fontSize: 11 }}>
        {t('workbench.editors.mqtt.topics.hint')}
      </Text>
      <EditableGridTable<MqttTopicRow>
        rows={rows}
        onChange={onChange}
        adapter={TOPIC_ROW_ADAPTER}
        keyPlaceholder={t('workbench.editors.mqtt.topics.filterPlaceholder')}
        headerLabels={{
          key: t('workbench.editors.mqtt.topics.filterLabel'),
          value: t('workbench.editors.mqtt.topics.qosColLabel'),
        }}
        hideEnabled
        columnWidths={{ value: '64px' }}
        renderKeyCell={(row, update, ctx) => {
          const filterError = !ctx.isPlaceholder && row.topicFilter.trim() ? topicFilterError(row.topicFilter) : null;
          const grantCode = sessionOpen ? liveSubs.get(row.uid)?.grantCode : undefined;
          // Success grants render as silence — the ON switch is the
          // answer; only a FAILED grant marks the row.
          const grantFailure = grantCode !== undefined && grantCode !== null ? grantFailureLabel(grantCode, t) : null;
          return (
            <>
              <Tooltip title={filterError ?? undefined} open={filterError ? undefined : false}>
                <TemplateInput
                  variant="borderless"
                  expandOnFocus
                  expanded={ctx.expanded}
                  value={row.topicFilter}
                  placeholder={t('workbench.editors.mqtt.topics.filterPlaceholder')}
                  status={filterError ? 'error' : undefined}
                  onChange={(topicFilter) => update({ ...row, topicFilter })}
                  style={{
                    ...cellFont,
                    flex: 1,
                    padding: `${CELL_VERTICAL_PADDING}px 6px`,
                    color: ctx.dim ? token.colorTextQuaternary : token.colorText,
                  }}
                  data-testid="mqtt-topic-filter-input"
                />
              </Tooltip>
              {/* A FAILED grant marks the row's filter — the fixed
                QoS/Subscribe tracks have no room for it. */}
              {grantFailure !== null && (
                <Tag
                  color="error"
                  style={{ marginInlineEnd: 0, fontSize: 10, lineHeight: '16px', flexShrink: 0 }}
                  data-testid="mqtt-topic-grant"
                >
                  {grantFailure}
                </Tag>
              )}
            </>
          );
        }}
        renderValueCell={(row, update, ctx) => (
          // The compact QoS knob (the compose bar's idiom): the value
          // shows the bare integer; the opened menu explains the levels.
          <Select
            size="small"
            style={{ width: 46, marginLeft: 6 }}
            suffixIcon={null}
            popupMatchSelectWidth={false}
            disabled={ctx.isPlaceholder}
            value={row.qos ?? 0}
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
            onChange={(qos: MqttRequestQos) => {
              update({ ...row, qos });
              // Changing the QoS of a LIVE-subscribed row unsubscribes
              // it — the old grant no longer describes the row, and
              // re-subscribing is the honest way to the new level. The
              // check mirrors the switch's own truth (mark, or the
              // draft for open-time rows the seed has not marked yet).
              if (sessionOpen && (liveSubs.get(row.uid)?.subscribed ?? row.subscribe !== false)) {
                onLiveToggle({ ...row, qos }, false);
              }
            }}
            data-testid="mqtt-topic-qos"
          />
        )}
        auxColumns={[
          {
            // The subscription-options slot — its own labeled track
            // riding the Topic column, persistent hairline on its left
            // edge. The ghost row keeps the dimmed disabled gear so
            // the column reads as a column before any row is minted.
            label: t('workbench.editors.mqtt.topics.optionsColLabel'),
            position: 'after-key',
            width: '76px',
            divider: true,
            render: (row, update, ctx) =>
              ctx.isPlaceholder ? (
                <Button
                  size="small"
                  type="text"
                  icon={<SettingOutlined />}
                  disabled
                  style={{ marginLeft: 4 }}
                  data-testid="mqtt-topic-options"
                />
              ) : (
                <Popover
                  trigger="click"
                  placement="bottom"
                  content={
                    // The (i) popovers must portal inside this popover
                    // (see resolveOptionsPopover) — the marker class is
                    // the resolver's anchor, position: relative its
                    // positioning context.
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
                      >
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {v5 ? t('workbench.editors.mqtt.topics.optionsHint') : t('workbench.editors.mqtt.props.v311')}
                      </Text>
                      {/* User Properties ride ONCE on this row's
                        SUBSCRIBE packet — broker-defined metadata,
                        never echoed on delivered messages (the (i)
                        carries that honestly). */}
                      <OptionLabel
                        strong
                        text={t('workbench.editors.mqtt.topics.subscribeProperties')}
                        info={mqttSettingsRowInfo(t, 'subscribeProperties')}
                      />
                      {/* The list shows four rows and scrolls instead of
                        growing the popover row by row; the right gutter
                        keeps the scrollbar off the remove buttons. */}
                      {(row.userProperties ?? []).length > 0 && (
                        <div
                          className="oh-mqtt-topic-userprops"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                            maxHeight: 108,
                            overflowY: 'auto',
                            paddingRight: 10,
                          }}
                        >
                          {(row.userProperties ?? []).map((prop, index) => (
                            <div key={prop.uid} style={{ display: 'flex', gap: 4 }}>
                              <Input
                                size="small"
                                placeholder={t('workbench.editors.mqtt.props.userPropKey')}
                                value={prop.key}
                                disabled={!v5}
                                onChange={(e) => {
                                  const next = [...(row.userProperties ?? [])];
                                  next[index] = { ...prop, key: e.target.value };
                                  update({ ...row, userProperties: next });
                                }}
                                data-testid="mqtt-topic-userprop-key"
                              />
                              <Input
                                size="small"
                                placeholder={t('workbench.editors.mqtt.props.userPropValue')}
                                value={prop.value}
                                disabled={!v5}
                                onChange={(e) => {
                                  const next = [...(row.userProperties ?? [])];
                                  next[index] = { ...prop, value: e.target.value };
                                  update({ ...row, userProperties: next });
                                }}
                                data-testid="mqtt-topic-userprop-value"
                              />
                              <Button
                                size="small"
                                type="text"
                                disabled={!v5}
                                aria-label={t('workbench.editors.mqtt.props.removeUserProp')}
                                onClick={() => {
                                  const next = (row.userProperties ?? []).filter((r) => r.uid !== prop.uid);
                                  update({ ...row, userProperties: next.length > 0 ? next : undefined });
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
                        onClick={(e) => {
                          update({
                            ...row,
                            userProperties: [...(row.userProperties ?? []), { uid: generateUid(), key: '', value: '' }],
                          });
                          // No hook slot inside a cell renderer — the list
                          // resolves off the popover marker instead.
                          const list = e.currentTarget
                            .closest('.oh-mqtt-topic-options')
                            ?.querySelector<HTMLElement>('.oh-mqtt-topic-userprops');
                          requestAnimationFrame(() => list?.scrollTo({ top: list.scrollHeight }));
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
                      {/* One anatomy for every row: the label column left,
                        the control column right — explanations live behind
                        the (i) popovers, never inline in the labels. */}
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
                          text={t('workbench.editors.mqtt.topics.noLocal')}
                          info={mqttSettingsRowInfo(t, 'noLocal')}
                        />
                        <Switch
                          size="small"
                          style={{ justifySelf: 'start' }}
                          disabled={!v5}
                          checked={row.noLocal === true}
                          onChange={(noLocal) => update({ ...row, noLocal })}
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
                          onChange={(retainAsPublished) => update({ ...row, retainAsPublished })}
                        />
                        <OptionLabel
                          text={t('workbench.editors.mqtt.topics.retainHandling')}
                          info={mqttSettingsRowInfo(t, 'retainHandling')}
                        />
                        <Select
                          size="small"
                          disabled={!v5}
                          popupMatchSelectWidth={false}
                          value={row.retainHandling ?? 0}
                          options={[
                            // title stays empty — the label's (i) popover
                            // carries the values; the native label-title
                            // would double the hover.
                            { value: 0, title: '', label: t('workbench.editors.mqtt.topics.retainHandling0') },
                            { value: 1, title: '', label: t('workbench.editors.mqtt.topics.retainHandling1') },
                            { value: 2, title: '', label: t('workbench.editors.mqtt.topics.retainHandling2') },
                          ]}
                          onChange={(retainHandling: MqttRetainHandling) => update({ ...row, retainHandling })}
                        />
                        <OptionLabel
                          text={t('workbench.editors.mqtt.topics.subscriptionId')}
                          info={mqttSettingsRowInfo(t, 'subscriptionId')}
                        />
                        {/* The empty knob means the default in effect —
                          its stated default reads at full text
                          contrast, the Settings-tab discipline. */}
                        <ConfigProvider
                          theme={{ components: { InputNumber: { colorTextPlaceholder: token.colorText } } }}
                        >
                          <InputNumber
                            size="small"
                            min={1}
                            max={268_435_455}
                            disabled={!v5}
                            value={row.subscriptionId}
                            onChange={(next) => update({ ...row, subscriptionId: next ?? undefined })}
                            placeholder={t('workbench.editors.mqtt.topics.subscriptionIdPlaceholder')}
                            style={{ width: 120 }}
                          />
                        </ConfigProvider>
                      </div>
                      </div>
                    </InfoPopoverContainerProvider>
                  }
                >
                  <Button
                    size="small"
                    type="text"
                    icon={<SettingOutlined />}
                    style={{ marginLeft: 4 }}
                    data-testid="mqtt-topic-options"
                  />
                </Popover>
              ),
          },
          {
            label: t('workbench.editors.mqtt.topics.subscribeColLabel'),
            position: 'after-value',
            width: '96px',
            divider: true,
            render: (row, update, ctx) =>
              ctx.isPlaceholder ? (
                <Switch
                  size="small"
                  disabled
                  checked={false}
                  checkedChildren={t('shared.settingsRows.enabled')}
                  unCheckedChildren={t('shared.settingsRows.disabled')}
                  style={{ marginLeft: 10 }}
                />
              ) : (
                // While the session is open the switch is the LIVE
                // toggle — it rides the rider and marks the row with
                // the SUBACK grant; the stored draft row stays
                // untouched (the publication-gate idiom).
                <Tooltip
                  title={
                    sessionOpen
                      ? t('workbench.editors.mqtt.topics.subscribeLiveLabel')
                      : t('workbench.editors.mqtt.topics.subscribeLabel')
                  }
                >
                  <Switch
                    size="small"
                    style={{ marginLeft: 10 }}
                    checkedChildren={t('shared.settingsRows.enabled')}
                    unCheckedChildren={t('shared.settingsRows.disabled')}
                    checked={
                      sessionOpen
                        ? (liveSubs.get(row.uid)?.subscribed ?? row.subscribe !== false)
                        : row.subscribe !== false
                    }
                    onChange={(subscribe) => {
                      if (sessionOpen) {
                        onLiveToggle(row, subscribe);
                        return;
                      }
                      update({ ...row, subscribe });
                    }}
                    data-testid="mqtt-topic-subscribe"
                  />
                </Tooltip>
              ),
          },
        ]}
        renderDescriptionCell={(row, update, ctx) => (
          <TemplateInput
            variant="borderless"
            expandOnFocus
            expanded={ctx.expanded}
            value={row.description ?? ''}
            placeholder={t('workbench.editors.grid.description')}
            onChange={(description) => update({ ...row, description })}
            style={{
              ...cellFont,
              flex: 1,
              padding: `${CELL_VERTICAL_PADDING}px 6px`,
              color: ctx.dim ? token.colorTextQuaternary : token.colorText,
            }}
          />
        )}
      />
    </div>
  );
};

export default MqttTopicsTab;
