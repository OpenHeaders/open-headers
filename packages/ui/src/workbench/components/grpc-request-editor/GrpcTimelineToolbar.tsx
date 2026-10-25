/**
 * GrpcTimelineToolbar — the gRPC timeline's strip (the MQTT / WS
 * timelines' anatomy): search, the direction menu reading the filter
 * in force, and the count on the left; Sort by, View (show types,
 * grouping axes, rows per group) and Clear on the right. Every trigger
 * is icon + label; the single-choice menus and the View menu ride
 * antd's selection plane under `.oh-choice-menu` / `.oh-view-menu`
 * (the Editor menu's row anatomy). Menu visibility is the strip's
 * own: a single choice closes on its pick, the View menu keeps open so
 * several knobs flip in one visit, and a trigger's tooltip suppresses
 * while its menu shows.
 */

import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  ControlOutlined,
  DeleteOutlined,
  DownOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
} from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Dropdown, Input, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import type { GrpcDirectionFilter } from './grpc-timeline-model';

const { Text } = Typography;

interface GrpcTimelineToolbarProps {
  search: string;
  onSearchChange: (search: string) => void;
  directionFilter: GrpcDirectionFilter;
  onDirectionFilterChange: (filter: GrpcDirectionFilter) => void;
  /** Message rows currently in the display window (cleared excluded). */
  messageTotal: number;
  /** Of those, the rows the filters let through. */
  messageShown: number;
  /** Any filter in force — the count reads "{shown} of {total}". */
  filtering: boolean;
  newestFirst: boolean;
  onNewestFirstChange: (newestFirst: boolean) => void;
  showTypes: boolean;
  onShowTypesChange: (show: boolean) => void;
  groupByType: boolean;
  onGroupByTypeChange: (group: boolean) => void;
  groupByDirection: boolean;
  onGroupByDirectionChange: (group: boolean) => void;
  groupRowLimit: number;
  onGroupRowLimitChange: (limit: number) => void;
  onClear: () => void;
}

const GrpcTimelineToolbar: React.FC<GrpcTimelineToolbarProps> = ({
  search,
  onSearchChange,
  directionFilter,
  onDirectionFilterChange,
  messageTotal,
  messageShown,
  filtering,
  newestFirst,
  onNewestFirstChange,
  showTypes,
  onShowTypesChange,
  groupByType,
  onGroupByTypeChange,
  groupByDirection,
  onGroupByDirectionChange,
  groupRowLimit,
  onGroupRowLimitChange,
  onClear,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const [directionMenuOpen, setDirectionMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);

  // The direction options — the menu rows and the trigger's label are
  // the same words, so the trigger reads the filter in force.
  const directionOptions: ReadonlyArray<{ value: GrpcDirectionFilter; icon: React.ReactNode | null; label: string }> =
    [
      { value: 'all', icon: null, label: t('workbench.editors.grpc.timeline.filterAllMessages') },
      { value: 'up', icon: <ArrowUpOutlined />, label: t('workbench.editors.grpc.timeline.filterSent') },
      { value: 'down', icon: <ArrowDownOutlined />, label: t('workbench.editors.grpc.timeline.filterReceived') },
      { value: 'lifecycle', icon: <InfoCircleOutlined />, label: t('workbench.editors.grpc.timeline.filterLifecycle') },
    ];
  const activeDirection = directionOptions.find((option) => option.value === directionFilter) ?? directionOptions[0];
  const menuRow = (icon: React.ReactNode | null, label: string): React.ReactNode => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {icon}
      {label}
    </span>
  );
  // The View menu's on-knobs ride antd's selection plane (several at
  // once); the Rows per group submenu is the one single choice.
  const viewSelectedKeys = [
    ...(showTypes ? ['show-types'] : []),
    ...(groupByType ? ['group'] : []),
    ...(groupByDirection ? ['group-direction'] : []),
    `group-limit-${groupRowLimit}`,
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Input
        size="small"
        allowClear
        prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
        placeholder={t('workbench.editors.grpc.timeline.searchMessages')}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        data-testid="grpc-timeline-search"
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
          title={t('workbench.editors.grpc.timeline.directionFilter')}
          placement="bottom"
          open={directionMenuOpen ? false : undefined}
        >
          <Button
            size="small"
            type="text"
            data-testid="grpc-timeline-direction-filter"
            aria-label={t('workbench.editors.grpc.timeline.directionFilter')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {activeDirection.icon}
            {activeDirection.label}
            <DownOutlined style={{ fontSize: 10, color: token.colorTextTertiary }} />
          </Button>
        </Tooltip>
      </Dropdown>
      <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }} data-testid="grpc-timeline-count">
        {filtering
          ? t('workbench.editors.grpc.timeline.messageCountFiltered', { shown: messageShown, total: messageTotal })
          : t('workbench.editors.grpc.timeline.messageCount', { count: messageTotal })}
      </Text>
      <span style={{ marginLeft: 'auto' }} />
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
              label: t('workbench.editors.grpc.timeline.newestFirst'),
              onClick: () => {
                onNewestFirstChange(true);
                setSortMenuOpen(false);
              },
            },
            {
              key: 'oldest',
              label: t('workbench.editors.grpc.timeline.oldestFirst'),
              onClick: () => {
                onNewestFirstChange(false);
                setSortMenuOpen(false);
              },
            },
          ],
        }}
      >
        <Tooltip
          title={t('workbench.editors.grpc.timeline.sortOrder')}
          placement="bottom"
          open={sortMenuOpen ? false : undefined}
        >
          <Button
            size="small"
            type="text"
            icon={newestFirst ? <SortDescendingOutlined /> : <SortAscendingOutlined />}
            data-testid="grpc-timeline-sort"
            aria-label={t('workbench.editors.grpc.timeline.sortOrder')}
          >
            {t('workbench.editors.grpc.timeline.sortBy')}
          </Button>
        </Tooltip>
      </Dropdown>
      <Dropdown
        trigger={['click']}
        placement="bottomRight"
        open={viewMenuOpen}
        onOpenChange={(open, info) => {
          // Menu-item clicks keep the popover open — several knobs
          // flip in one visit; only the trigger and outside clicks
          // change visibility.
          if (info.source === 'menu') return;
          setViewMenuOpen(open);
        }}
        menu={{
          rootClassName: 'oh-view-menu',
          selectable: true,
          multiple: true,
          selectedKeys: viewSelectedKeys,
          items: [
            {
              type: 'group',
              label: t('workbench.editors.grpc.timeline.viewShow'),
              children: [
                {
                  key: 'show-types',
                  label: t('workbench.editors.grpc.timeline.showTypes'),
                  onClick: () => onShowTypesChange(!showTypes),
                },
              ],
            },
            { type: 'divider' },
            {
              type: 'group',
              label: t('workbench.editors.grpc.timeline.viewGroup'),
              children: [
                {
                  key: 'group',
                  label: t('workbench.editors.grpc.timeline.groupByType'),
                  onClick: () => onGroupByTypeChange(!groupByType),
                },
                {
                  key: 'group-direction',
                  label: t('workbench.editors.grpc.timeline.groupByDirection'),
                  onClick: () => onGroupByDirectionChange(!groupByDirection),
                },
                {
                  key: 'group-limit',
                  label: t('workbench.editors.grpc.timeline.rowsPerGroup'),
                  disabled: !groupByType && !groupByDirection,
                  children: [0, 1, 3, 5, 10].map((n) => ({
                    key: `group-limit-${n}`,
                    label: n === 0 ? t('workbench.editors.grpc.timeline.noLimit') : String(n),
                    onClick: () => onGroupRowLimitChange(n),
                  })),
                },
              ],
            },
          ],
        }}
      >
        <Tooltip
          title={t('workbench.editors.grpc.timeline.viewTooltip')}
          placement="bottom"
          open={viewMenuOpen ? false : undefined}
        >
          <Button
            size="small"
            type="text"
            icon={<ControlOutlined />}
            data-testid="grpc-timeline-view"
            aria-label={t('workbench.editors.grpc.timeline.view')}
          >
            {t('workbench.editors.grpc.timeline.view')}
          </Button>
        </Tooltip>
      </Dropdown>
      <Tooltip title={t('workbench.editors.grpc.timeline.clearMessages')} placement="bottom">
        <Button
          size="small"
          type="text"
          icon={<DeleteOutlined />}
          data-testid="grpc-timeline-clear"
          onClick={onClear}
          aria-label={t('workbench.editors.grpc.timeline.clearMessages')}
        >
          {t('workbench.editors.grpc.timeline.clear')}
        </Button>
      </Tooltip>
    </div>
  );
};

export default GrpcTimelineToolbar;
