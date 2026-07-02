import { DeleteOutlined, EditOutlined, ExperimentOutlined } from '@ant-design/icons';
import type { UseRuleMutatorApi } from '@openheaders/ui/shared/hooks/useRuleMutator';
import type { WorkspaceIntent } from '@openheaders/ui/shared/workspace-intent';
import { App, Button, Popconfirm, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import { renderActionDetails, renderConditionsSummary, truncateValue } from './columns/sharedColumnRenderers';
import type { TableRecord } from './rules-table-records';

const { Text } = Typography;

const NOT_CONNECTED_TIP = (
  <>
    App not connected
    <div style={{ marginTop: 4 }}>
      <Tag color="blue" style={{ marginInlineEnd: 4 }}>
        Desktop
      </Tag>
      coming soon
    </div>
  </>
);

/** Antd `message` API handed down from the popup's `App.useApp()` context. */
type RulesTableMessageApi = ReturnType<typeof App.useApp>['message'];

export interface RulesTableColumnsOptions {
  sortedInfo: SorterResult<TableRecord>;
  filteredInfo: Record<string, FilterValue | null>;
  dataSource: TableRecord[];
  ruleMutator: UseRuleMutatorApi;
  message: RulesTableMessageApi;
  openRulesIntent: (intent: WorkspaceIntent) => void;
  handleTestRule: (record: TableRecord) => void;
}

/**
 * Builds the all-rules table columns. Rebuilt every render (as the
 * inline array was) so sort/filter state and the mutation handlers stay
 * current — no memoization is required because no cell renderer closes
 * over a value that must be referentially stable.
 */
export function buildRulesTableColumns({
  sortedInfo,
  filteredInfo,
  dataSource,
  ruleMutator,
  message,
  openRulesIntent,
  handleTestRule,
}: RulesTableColumnsOptions): ColumnsType<TableRecord> {
  return [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 170,
      fixed: 'left',
      sorter: (a, b) => a.name.localeCompare(b.name),
      filters: [...new Set(dataSource.map((item) => item.name))].map((name) => ({ text: name, value: name })),
      filteredValue: filteredInfo.name || null,
      filterSearch: true,
      onFilter: (value, record) => record.name === value,
      sortOrder: sortedInfo.columnKey === 'name' ? sortedInfo.order : null,
      render: (text: string, _record: TableRecord) => {
        const displayName = truncateValue(text, 20);
        return (
          <Tooltip title={text.length > 20 ? text : undefined}>
            <Text strong style={{ fontSize: '13px' }}>
              {displayName}
            </Text>
          </Tooltip>
        );
      },
    },
    {
      title: 'Details',
      key: 'details',
      width: 270,
      // Hidden below 'md' (<768px viewport) — at narrow sidepanel widths
      // there isn't room for the 270px column. Action info is still
      // accessible via the row's expand/edit affordances.
      responsive: ['md'],
      render: (_: unknown, record: TableRecord) =>
        renderActionDetails(record.actionDetail, 1, 28, record.isEnabled && record.isComplete),
    },
    {
      title: 'Conditions',
      dataIndex: 'conditions',
      key: 'conditions',
      width: 120,
      // Hidden below 'sm' (<576px) — domains/scopes are visible from the
      // edit view and the rule name usually conveys scope at a glance.
      responsive: ['sm'],
      sorter: (a, b) => a.domains.join(',').localeCompare(b.domains.join(',')),
      filters: [...new Set(dataSource.flatMap((item) => item.domains))].map((domain) => ({
        text: domain,
        value: domain,
      })),
      filteredValue: filteredInfo.domains || null,
      filterSearch: true,
      onFilter: (value, record) => record.domains.includes(value as string),
      sortOrder: sortedInfo.columnKey === 'conditions' ? sortedInfo.order : null,
      render: (_: unknown, record: TableRecord) => renderConditionsSummary(record.conditions, false),
    },
    {
      title: '',
      dataIndex: 'isEnabled',
      key: 'isEnabled',
      width: 50,
      align: 'center',
      fixed: 'right',
      sorter: (a, b) => Number(b.isEnabled) - Number(a.isEnabled),
      sortOrder: sortedInfo.columnKey === 'isEnabled' ? sortedInfo.order : null,
      render: (enabled: boolean, record: TableRecord) => {
        return (
          <Switch
            checked={enabled}
            onChange={async () => {
              const resp = await ruleMutator.toggleRule(record.id, !enabled);
              if (!resp.ok) {
                message.error('Failed to toggle rule');
              }
            }}
            size="small"
          />
        );
      },
    },
    {
      title: '',
      key: 'actions',
      width: 88,
      align: 'center',
      fixed: 'right',
      render: (_: unknown, record: TableRecord) => {
        const canAct = true;
        return (
          <Space size={2}>
            <Tooltip title="Test this rule against a URL">
              <Button type="text" icon={<ExperimentOutlined />} size="small" onClick={() => handleTestRule(record)} />
            </Tooltip>
            <Tooltip title={!canAct ? NOT_CONNECTED_TIP : 'Edit rule'}>
              <Button
                type="text"
                icon={<EditOutlined />}
                size="small"
                disabled={!canAct}
                onClick={() => openRulesIntent({ kind: 'edit-rule', uid: record.id })}
              />
            </Tooltip>
            <Tooltip title={!canAct ? NOT_CONNECTED_TIP : 'Delete rule'}>
              <Popconfirm
                title="Delete rule"
                description={`Delete "${record.name}"?`}
                onConfirm={async () => {
                  const resp = await ruleMutator.deleteRule(record.id);
                  if (resp.ok) {
                    message.success('Rule deleted');
                  } else {
                    message.error('Failed to delete rule');
                  }
                }}
                okText="Delete"
                okType="danger"
                cancelText="Cancel"
                disabled={!canAct}
              >
                <Button type="text" danger icon={<DeleteOutlined />} size="small" disabled={!canAct} />
              </Popconfirm>
            </Tooltip>
          </Space>
        );
      },
    },
  ];
}
