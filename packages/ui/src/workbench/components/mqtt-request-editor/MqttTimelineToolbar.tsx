/**
 * MqttTimelineToolbar — the MQTT timeline's control strip: search, the
 * direction menu (all / sent / received), the message count and the
 * rolling-retention drop notice on the left; the TOPIC filter (several
 * topics at once, over every topic the log has seen), the sort menu
 * (writing the `requests.mqttMessagesNewestFirst` SETTING through the
 * orchestrator) and the display-only Clear on the right. Every trigger
 * carries icon + label (the direction trigger reads the filter in
 * force, Sort by stays a name) — one pattern across the strip; the two
 * menus are single choices on
 * antd's selection plane, painted by `.oh-choice-menu` (the Editor
 * menu's row anatomy: the mark in the gutter plus the active tint).
 * All controls are display-only over the capture — the orchestrator
 * owns the state; this strip just renders and reports it.
 */

import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  ClearOutlined,
  DownOutlined,
  SearchOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Input, Select, Tooltip, Typography, theme } from 'antd';
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
  /** Of those, the rows the filters let through. */
  messageShown: number;
  /** Any filter in force — the count reads "{shown} of {total}". */
  filtering: boolean;
  droppedMessages: number;
  /** Every distinct topic the log has seen, first-appearance order. */
  seenTopics: readonly string[];
  /** The topics shown — empty means every topic. */
  topicFilter: string[];
  onTopicFilterChange: (topics: string[]) => void;
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
  messageShown,
  filtering,
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
  const [directionMenuOpen, setDirectionMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  // The direction options — the menu rows and the trigger's label are
  // the same words, so the trigger reads the filter in force.
  const directionOptions: ReadonlyArray<{ value: MqttDirectionFilter; icon: React.ReactNode | null; label: string }> = [
    { value: 'all', icon: null, label: t('workbench.editors.mqtt.timeline.filterAllMessages') },
    { value: 'up', icon: <ArrowUpOutlined />, label: t('workbench.editors.mqtt.timeline.filterSent') },
    { value: 'down', icon: <ArrowDownOutlined />, label: t('workbench.editors.mqtt.timeline.filterReceived') },
  ];
  const activeDirection = directionOptions.find((option) => option.value === directionFilter) ?? directionOptions[0];

  const menuRow = (icon: React.ReactNode | null, label: string): React.ReactNode => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {icon}
      {label}
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
      <Dropdown
        trigger={['click']}
        placement="bottomLeft"
        open={directionMenuOpen}
        onOpenChange={(open, info) => {
          if (info.source === 'menu') return;
          setDirectionMenuOpen(open);
        }}
        menu={{
          rootClassName: 'oh-choice-menu',
          selectable: true,
          selectedKeys: [directionFilter],
          items: directionOptions.map((option) => ({
            key: option.value,
            label: menuRow(option.icon, option.label),
            onClick: () => {
              onDirectionFilterChange(option.value);
              setDirectionMenuOpen(false);
            },
          })),
        }}
      >
        <Tooltip
          title={t('workbench.editors.mqtt.timeline.directionFilter')}
          placement="bottom"
          open={directionMenuOpen ? false : undefined}
        >
          <Button
            size="small"
            type="text"
            data-testid="mqtt-timeline-direction-filter"
            aria-label={t('workbench.editors.mqtt.timeline.directionFilter')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {activeDirection.icon}
            {activeDirection.label}
            <DownOutlined style={{ fontSize: 10, color: token.colorTextTertiary }} />
          </Button>
        </Tooltip>
      </Dropdown>
      <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }} data-testid="mqtt-timeline-count">
        {filtering
          ? t('workbench.editors.mqtt.timeline.messageCountFiltered', { shown: messageShown, total: messageTotal })
          : t('workbench.editors.mqtt.timeline.messageCount', { count: messageTotal })}
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
          mode="multiple"
          allowClear
          maxTagCount="responsive"
          placeholder={t('workbench.editors.mqtt.timeline.topicFilterAll')}
          value={topicFilter}
          options={seenTopics.map((topic) => ({ value: topic, label: topic }))}
          onChange={(next: string[]) => onTopicFilterChange(next)}
          // Sized by its tags — never a reserved band; the cap collapses
          // the overflow into a count.
          style={{ width: 'auto', minWidth: 180, maxWidth: 340 }}
          data-testid="mqtt-timeline-topic-filter"
        />
      )}
      <Dropdown
        trigger={['click']}
        placement="bottomRight"
        open={sortMenuOpen}
        onOpenChange={(open, info) => {
          if (info.source === 'menu') return;
          setSortMenuOpen(open);
        }}
        menu={{
          rootClassName: 'oh-choice-menu',
          selectable: true,
          selectedKeys: [newestFirst ? 'newest' : 'oldest'],
          items: [
            {
              key: 'newest',
              label: t('workbench.editors.mqtt.timeline.newestFirst'),
              onClick: () => {
                onNewestFirstChange(true);
                setSortMenuOpen(false);
              },
            },
            {
              key: 'oldest',
              label: t('workbench.editors.mqtt.timeline.oldestFirst'),
              onClick: () => {
                onNewestFirstChange(false);
                setSortMenuOpen(false);
              },
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
            icon={newestFirst ? <SortDescendingOutlined /> : <SortAscendingOutlined />}
            data-testid="mqtt-timeline-sort"
            aria-label={t('workbench.editors.mqtt.timeline.sortOrder')}
          >
            {t('workbench.editors.mqtt.timeline.sortBy')}
          </Button>
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
        >
          {t('workbench.editors.mqtt.timeline.clear')}
        </Button>
      </Tooltip>
    </div>
  );
};

export default MqttTimelineToolbar;
