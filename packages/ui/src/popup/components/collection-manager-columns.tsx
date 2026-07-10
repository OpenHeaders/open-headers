import {
  FolderOpenOutlined,
  FolderOutlined,
  PauseCircleOutlined,
} from '@ant-design/icons';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { Button, Space, Switch, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type React from 'react';
import type { CollectionTreeRecord } from './collection-tree-records';
import { renderActionDetails, renderConditionsSummary } from './columns/sharedColumnRenderers';

const { Text } = Typography;

export interface CollectionManagerColumnsOptions {
  togglePauseFocusedLabel: string;
  handleToggle: (record: CollectionTreeRecord) => void;
}

/**
 * Builds the collection tree-table columns. Rebuilt every render (as the
 * inline array was) so the row handlers stay current — no memoization is
 * required because no cell renderer closes over a value that must be
 * referentially stable.
 */
export function buildCollectionManagerColumns({
  togglePauseFocusedLabel,
  handleToggle,
}: CollectionManagerColumnsOptions): ColumnsType<CollectionTreeRecord> {
  return [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string, record: CollectionTreeRecord) => {
        const paused = record.effectivelyPaused;
        if (record.nodeType === 'rule') {
          return (
            <Tooltip title={name.length > 20 ? name : undefined}>
              <Text style={{ fontSize: '13px', opacity: paused ? 0.5 : 1 }}>
                {name.length > 20 ? `${name.substring(0, 14)}...${name.substring(name.length - 4)}` : name}
              </Text>
            </Tooltip>
          );
        }
        const color = paused ? 'var(--ant-color-warning)' : 'var(--text-secondary)';
        return (
          <Space>
            {record.nodeType === 'folder' ? (
              <FolderOutlined style={{ color }} />
            ) : (
              <FolderOpenOutlined style={{ color }} />
            )}
            <Text strong style={{ fontSize: '13px', opacity: paused ? 0.6 : 1 }}>
              {name}
            </Text>
            {paused && <PauseCircleOutlined style={{ fontSize: '12px', color: 'var(--ant-color-warning)' }} />}
          </Space>
        );
      },
    },
    {
      title: 'Details',
      key: 'details',
      width: 150,
      render: (_: unknown, record: CollectionTreeRecord) => {
        if (record.nodeType === 'rule' && record.actionDetail) {
          const active = (record.isEnabled ?? false) && (record.isComplete ?? false) && !record.effectivelyPaused;
          return renderActionDetails(record.actionDetail, record.effectivelyPaused ? 0.5 : 1, 28, active);
        }
        if (record.nodeType !== 'rule') {
          if (record.effectivelyPaused) {
            return (
              <Text type="warning" style={{ fontSize: '12px' }}>
                Paused · {record.enabledCount} of {record.ruleCount} enabled
              </Text>
            );
          }
          return (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.enabledCount} of {record.ruleCount} rule{record.ruleCount !== 1 ? 's' : ''} enabled
            </Text>
          );
        }
        return null;
      },
    },
    {
      title: 'Conditions',
      key: 'conditions',
      width: 110,
      render: (_: unknown, record: CollectionTreeRecord) => {
        if (record.nodeType === 'rule' && record.conditions) {
          return renderConditionsSummary(record.conditions, false);
        }
        return null;
      },
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      align: 'center',
      fixed: 'right',
      render: (_: unknown, record: CollectionTreeRecord) => {
        if (record.nodeType === 'rule') {
          return (
            // biome-ignore lint/a11y/useKeyWithClickEvents: stops row expand on switch click
            // biome-ignore lint/a11y/noStaticElementInteractions: stops row expand on switch click
            <span
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Switch size="small" checked={record.isEnabled} onChange={() => handleToggle(record)} />
            </span>
          );
        }
        return (
          // biome-ignore lint/a11y/useKeyWithClickEvents: stops row expand on switch click
          // biome-ignore lint/a11y/noStaticElementInteractions: stops row expand on switch click
          <span
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Tooltip
              title={
                <ShortcutHintTitle label={togglePauseFocusedLabel}>
                  {record.effectivelyPaused
                    ? `Resume — pin ${record.ruleCount} rules active (overrides parent if needed)`
                    : `Pause — suspend ${record.ruleCount} rules without changing individual settings`}
                </ShortcutHintTitle>
              }
            >
              <Switch
                checked={!record.effectivelyPaused}
                onChange={() => handleToggle(record)}
                checkedChildren="Active"
                unCheckedChildren="Paused"
              />
            </Tooltip>
          </span>
        );
      },
    },
  ];
}
