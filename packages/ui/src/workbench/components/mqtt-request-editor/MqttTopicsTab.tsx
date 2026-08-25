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

/** Topics-grid row adapter — the topic filter rides the key track; the
 *  QoS / Subscribe / options cluster lives in the value cell. */
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
          value: t('workbench.editors.mqtt.topics.optionsLabel'),
        }}
        hideEnabled
        columnWidths={{ value: '210px' }}
        renderKeyCell={(row, update, ctx) => {
          const filterError = !ctx.isPlaceholder && row.topicFilter.trim() ? topicFilterError(row.topicFilter) : null;
          return (
            <Tooltip title={filterError ?? undefined} open={filterError ? undefined : false}>
              <Input
                size="small"
                variant="borderless"
                style={{ fontFamily: "'SF Mono', monospace", fontSize: 12 }}
                placeholder={t('workbench.editors.mqtt.topics.filterPlaceholder')}
                value={row.topicFilter}
                status={filterError ? 'error' : undefined}
                onChange={(e) => update({ ...row, topicFilter: e.target.value })}
                data-testid="mqtt-topic-filter-input"
              />
            </Tooltip>
          );
        }}
        renderValueCell={(row, update, ctx) =>
          ctx.isPlaceholder ? (
            <span />
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, paddingLeft: 4 }}>
              <Select
                size="small"
                style={{ width: 74 }}
                value={row.qos ?? 0}
                options={[
                  { value: 0, label: 'QoS 0' },
                  { value: 1, label: 'QoS 1' },
                  { value: 2, label: 'QoS 2' },
                ]}
                onChange={(qos: MqttRequestQos) => update({ ...row, qos })}
                data-testid="mqtt-topic-qos"
              />
              {/* While the session is open the switch is the LIVE
                toggle — it rides the rider and marks the row with the
                SUBACK grant; the stored draft row stays untouched (the
                publication-gate idiom). */}
              <Tooltip
                title={
                  sessionOpen
                    ? t('workbench.editors.mqtt.topics.subscribeLiveLabel')
                    : t('workbench.editors.mqtt.topics.subscribeLabel')
                }
              >
                <Switch
                  size="small"
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
              {sessionOpen &&
                (() => {
                  const grantCode = liveSubs.get(row.uid)?.grantCode;
                  if (grantCode === undefined || grantCode === null) return null;
                  return (
                    <Tag
                      color={grantCode <= 2 ? 'success' : 'error'}
                      style={{ marginInlineEnd: 0, fontSize: 10, lineHeight: '16px' }}
                      data-testid="mqtt-topic-grant"
                    >
                      {grantLabel(grantCode, t)}
                    </Tag>
                  );
                })()}
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
                <Button size="small" type="text" icon={<MoreOutlined />} data-testid="mqtt-topic-options" />
              </Popover>
            </span>
          )
        }
      />
    </div>
  );
};

export default MqttTopicsTab;
