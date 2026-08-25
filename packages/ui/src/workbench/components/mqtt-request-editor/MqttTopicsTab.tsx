/**
 * MqttTopicsTab — the subscription table. The stored table is the
 * DRAFT the session subscribes from at open; while the session is open
 * the Subscribe switch is the LIVE toggle — it rides the
 * `setMqttSubscription` rider and marks the row with its SUBACK grant
 * (QoS downgrades honest), never editing the stored row (the ratified
 * publication-gate idiom). The per-row "⋯" popover carries the 5.0
 * subscription options, disabled-honest on 3.1.1.
 */

import { MoreOutlined } from '@ant-design/icons';
import { topicFilterError } from '@openheaders/core/mqtt';
import type { MqttRequestQos, MqttRetainHandling, MqttTopicRow } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Input, InputNumber, Popover, Select, Switch, Tag, Tooltip, Typography } from 'antd';
import type React from 'react';
import { EditableGridTable } from '../request-editor/EditableGridTable';
import type { EditableRowAdapter } from '../request-editor/editable-grid-types';
import { grantLabel } from './session-display';
import type { LiveSubscriptionMark } from './useMqttSessionPlane';

const { Text } = Typography;

/** Topics-grid row adapter — the topic filter rides the key track
 *  (with the ⋯ options trigger at its right edge); QoS and Subscribe
 *  each own a column (value + aux tracks). */
const TOPIC_ROW_ADAPTER: EditableRowAdapter<MqttTopicRow> = {
  getId: (r) => r.uid,
  getEnabled: () => true,
  setEnabled: (r) => r,
  getKey: (r) => r.topicFilter,
  setKey: (r, v) => ({ ...r, topicFilter: v }),
  getDescription: (r) => r.description ?? '',
  setDescription: (r, v) => ({ ...r, description: v }),
  makeEmpty: () => ({ uid: generateUid(), topicFilter: '' }),
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
          return (
            <>
              <Tooltip title={filterError ?? undefined} open={filterError ? undefined : false}>
                <Input
                  variant="borderless"
                  style={{ fontFamily: "'SF Mono', monospace", fontSize: 12, padding: '4px 10px', flex: 1, minWidth: 0 }}
                  placeholder={t('workbench.editors.mqtt.topics.filterPlaceholder')}
                  value={row.topicFilter}
                  status={filterError ? 'error' : undefined}
                  onChange={(e) => update({ ...row, topicFilter: e.target.value })}
                  data-testid="mqtt-topic-filter-input"
                />
              </Tooltip>
              {/* The SUBACK grant mark rides the row's filter — the
                fixed QoS/Subscribe tracks have no room for it. */}
              {grantCode !== undefined && grantCode !== null && (
                <Tag
                  color={grantCode <= 2 ? 'success' : 'error'}
                  style={{ marginInlineEnd: 0, fontSize: 10, lineHeight: '16px', flexShrink: 0 }}
                  data-testid="mqtt-topic-grant"
                >
                  {grantLabel(grantCode, t)}
                </Tag>
              )}
              {!ctx.isPlaceholder && (
                <Popover
                  trigger="click"
                  placement="left"
                  content={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 280 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {v5 ? t('workbench.editors.mqtt.topics.optionsHint') : t('workbench.editors.mqtt.props.v311')}
                      </Text>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Switch
                          size="small"
                          disabled={!v5}
                          checked={row.noLocal === true}
                          onChange={(noLocal) => update({ ...row, noLocal })}
                          data-testid="mqtt-topic-nolocal"
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {t('workbench.editors.mqtt.topics.noLocal')}
                        </Text>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Switch
                          size="small"
                          disabled={!v5}
                          checked={row.retainAsPublished === true}
                          onChange={(retainAsPublished) => update({ ...row, retainAsPublished })}
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {t('workbench.editors.mqtt.topics.retainAsPublished')}
                        </Text>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                          {t('workbench.editors.mqtt.topics.retainHandling')}
                        </Text>
                        <Select
                          size="small"
                          style={{ flex: 1 }}
                          disabled={!v5}
                          value={row.retainHandling ?? 0}
                          options={[
                            { value: 0, label: t('workbench.editors.mqtt.topics.retainHandling0') },
                            { value: 1, label: t('workbench.editors.mqtt.topics.retainHandling1') },
                            { value: 2, label: t('workbench.editors.mqtt.topics.retainHandling2') },
                          ]}
                          onChange={(retainHandling: MqttRetainHandling) => update({ ...row, retainHandling })}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                          {t('workbench.editors.mqtt.topics.subscriptionId')}
                        </Text>
                        <InputNumber
                          size="small"
                          min={1}
                          max={268_435_455}
                          disabled={!v5}
                          value={row.subscriptionId}
                          onChange={(next) => update({ ...row, subscriptionId: next ?? undefined })}
                          style={{ width: 120 }}
                        />
                      </div>
                    </div>
                  }
                >
                  <Button
                    size="small"
                    type="text"
                    icon={<MoreOutlined />}
                    style={{ flexShrink: 0 }}
                    data-testid="mqtt-topic-options"
                  />
                </Popover>
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
            onChange={(qos: MqttRequestQos) => update({ ...row, qos })}
            data-testid="mqtt-topic-qos"
          />
        )}
        auxColumn={{
          label: t('workbench.editors.mqtt.topics.subscribeColLabel'),
          width: '96px',
          render: (row, update, ctx) =>
            ctx.isPlaceholder ? (
              <Switch size="small" disabled checked={false} style={{ marginLeft: 6 }} />
            ) : (
              // While the session is open the switch is the LIVE
              // toggle — it rides the rider and marks the row with the
              // SUBACK grant; the stored draft row stays untouched
              // (the publication-gate idiom).
              <Tooltip
                title={
                  sessionOpen
                    ? t('workbench.editors.mqtt.topics.subscribeLiveLabel')
                    : t('workbench.editors.mqtt.topics.subscribeLabel')
                }
              >
                <Switch
                  size="small"
                  style={{ marginLeft: 6 }}
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
        }}
      />
    </div>
  );
};

export default MqttTopicsTab;
