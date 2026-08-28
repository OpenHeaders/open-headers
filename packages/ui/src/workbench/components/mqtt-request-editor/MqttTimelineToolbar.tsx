/**
 * MqttTimelineToolbar — the MQTT timeline's control strip: search,
 * message count, the rolling-retention drop notice, the TOPIC filter
 * over every topic the log has seen, the direction Segmented, the
 * sort menu (writing the `requests.mqttMessagesNewestFirst` SETTING
 * through the orchestrator), wrap, and the display-only Clear. All
 * controls are display-only over the capture — the orchestrator owns
 * the state; this strip just renders and reports it.
 */

import { CheckOutlined, ClearOutlined, SearchOutlined, SortAscendingOutlined } from '@ant-design/icons';
import { Button, ConfigProvider, Dropdown, Input, Segmented, Select, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { MqttDirectionFilter } from './mqtt-timeline-model';

const { Text } = Typography;

interface MqttTimelineToolbarProps {
  search: string;
  onSearchChange: (search: string) => void;
  /** Message rows currently in the display window (cleared excluded). */
  messageTotal: number;
  droppedMessages: number;
  /** Every distinct topic the log has seen, first-appearance order. */
  seenTopics: readonly string[];
  topicFilter: string | null;
  onTopicFilterChange: (topic: string | null) => void;
  directionFilter: MqttDirectionFilter;
  onDirectionFilterChange: (filter: MqttDirectionFilter) => void;
  newestFirst: boolean;
  onNewestFirstChange: (newestFirst: boolean) => void;
  onClear: () => void;
}

const MqttTimelineToolbar: React.FC<MqttTimelineToolbarProps> = ({
  search,
  onSearchChange,
  messageTotal,
  droppedMessages,
  seenTopics,
  topicFilter,
  onTopicFilterChange,
  directionFilter,
  onDirectionFilterChange,
  newestFirst,
  onNewestFirstChange,
  onClear,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const menuOptionLabel = (label: string, checked: boolean): React.ReactNode => (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      {label}
      {checked && <CheckOutlined style={{ color: token.colorPrimary }} />}
    </span>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Input
        size="small"
        allowClear
        prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
        placeholder={t('workbench.editors.mqtt.timeline.searchMessages')}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        data-testid="mqtt-timeline-search"
        style={{ maxWidth: 220 }}
      />
      <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
        {t('workbench.editors.mqtt.timeline.messageCount', { count: messageTotal })}
      </Text>
      {droppedMessages > 0 && (
        <Text type="warning" style={{ fontSize: 11, whiteSpace: 'nowrap' }} data-testid="mqtt-timeline-dropped">
          {t('workbench.editors.mqtt.timeline.dropped', { count: droppedMessages })}
        </Text>
      )}
      <span style={{ marginLeft: 'auto' }} />
      {seenTopics.length > 0 && (
        <Select
          size="small"
          allowClear
          placeholder={t('workbench.editors.mqtt.timeline.topicFilterAll')}
          value={topicFilter}
          options={seenTopics.map((topic) => ({ value: topic, label: topic }))}
          onChange={(next: string | undefined) => onTopicFilterChange(next ?? null)}
          style={{ minWidth: 140, maxWidth: 220 }}
          data-testid="mqtt-timeline-topic-filter"
        />
      )}
      <ConfigProvider theme={{ token: { motion: false } }}>
        <Segmented
          size="small"
          value={directionFilter}
          onChange={(value) => onDirectionFilterChange(value as MqttDirectionFilter)}
          data-testid="mqtt-timeline-direction-filter"
          options={[
            { value: 'all', label: t('workbench.editors.mqtt.timeline.filterAll') },
            { value: 'up', label: `↑ ${t('workbench.editors.mqtt.timeline.filterSent')}` },
            { value: 'down', label: `↓ ${t('workbench.editors.mqtt.timeline.filterReceived')}` },
          ]}
        />
      </ConfigProvider>
      <Dropdown
        trigger={['click']}
        placement="bottomRight"
        open={sortMenuOpen}
        onOpenChange={(open, info) => {
          if (info.source === 'menu') return;
          setSortMenuOpen(open);
        }}
        menu={{
          items: [
            {
              key: 'newest',
              label: menuOptionLabel(t('workbench.editors.mqtt.timeline.newestFirst'), newestFirst),
              onClick: () => onNewestFirstChange(true),
            },
            {
              key: 'oldest',
              label: menuOptionLabel(t('workbench.editors.mqtt.timeline.oldestFirst'), !newestFirst),
              onClick: () => onNewestFirstChange(false),
            },
          ],
        }}
      >
        <Tooltip
          title={t('workbench.editors.mqtt.timeline.sortOrder')}
          placement="bottom"
          open={sortMenuOpen ? false : undefined}
        >
          <Button
            size="small"
            type="text"
            icon={<SortAscendingOutlined />}
            data-testid="mqtt-timeline-sort"
            aria-label={t('workbench.editors.mqtt.timeline.sortOrder')}
          />
        </Tooltip>
      </Dropdown>
      <Tooltip title={t('workbench.editors.mqtt.timeline.clearMessages')} placement="bottom">
        <Button
          size="small"
          type="text"
          icon={<ClearOutlined />}
          data-testid="mqtt-timeline-clear"
          onClick={onClear}
          aria-label={t('workbench.editors.mqtt.timeline.clearMessages')}
        />
      </Tooltip>
    </div>
  );
};

export default MqttTimelineToolbar;
