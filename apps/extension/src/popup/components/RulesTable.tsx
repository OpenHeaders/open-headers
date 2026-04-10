import {
  CheckOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined,
  SortAscendingOutlined,
} from '@ant-design/icons';
import { useKeyboardNav } from '@context/KeyboardNavContext';
import { useRules } from '@hooks/useRules';
import type { V5 } from '@openheaders/core/types';
import { getActionDetail, isPathPausedByAncestor, isRuleComplete } from '@openheaders/core/utils';
import { App, Button, Dropdown, Empty, Input, Popconfirm, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRowActionRegistration } from '@/hooks/useRowActionRegistration';
import { useTablePagination } from '@/hooks/useTablePagination';
import { buildRuleTypeMenuItems } from '@/rules/rule-type-menu';
import { getBrowserAPI } from '@/types/browser';
import { compareBySortMode, type PageInfo, type RowActions, type SortMode } from '../utils/table-shared';
import {
  type ActionDetail,
  renderActionDetails,
  renderConditionsSummary,
  truncateValue,
} from './columns/sharedColumnRenderers';
import DeleteConfirmOverlay from './DeleteConfirmOverlay';

/** Open the full-page rules editor in a new tab. */
function openRulesPage(hash: string): void {
  const url = getBrowserAPI().runtime.getURL(`workspace.html#${hash}`);
  getBrowserAPI().tabs.create({ url });
}

const { Search } = Input;
const { Text } = Typography;

const RULE_TYPE_LABEL: Record<string, string> = {
  header: 'Header',
  block: 'Block',
  redirect: 'Redirect',
  'query-param': 'Query Param',
  inject: 'Inject',
  body: 'Body',
  delay: 'Delay',
  mock: 'Mock',
};

const RULE_TYPE_DESCRIPTION: Record<string, string> = {
  header: 'Modify HTTP headers',
  block: 'Block requests',
  redirect: 'Redirect requests',
  'query-param': 'Modify query parameters',
  inject: 'Inject scripts or CSS',
  body: 'Modify request/response body',
  delay: 'Delay response',
  mock: 'Mock response',
};

/** 0 = active, 1 = paused, 2 = disabled, 3 = draft */
type StatusRank = 0 | 1 | 2 | 3;

interface TableRecord {
  key: string;
  id: string;
  name: string;
  path: string;
  ruleType: V5.RuleType;
  actionDetail: ActionDetail;
  domains: string[];
  conditions: V5.RuleCondition[];
  isEnabled: boolean;
  isComplete: boolean;
  statusRank: StatusRank;
}

interface RulesTableProps {
  focusedRowIndex?: number;
  pendingDeleteIndex?: number;
  onPageInfoChange?: (info: PageInfo) => void;
  onRowActionsChange?: (actions: RowActions) => void;
}

const RulesTable: React.FC<RulesTableProps> = ({
  focusedRowIndex = -1,
  pendingDeleteIndex = -1,
  onPageInfoChange,
  onRowActionsChange,
}) => {
  const { message } = App.useApp();

  const { rules, isConnected, uiState, updateUiState, pausedGroups } = useRules();
  const { setFocusedRowIndex } = useKeyboardNav();

  const [searchText, setSearchText] = useState(uiState?.tableState?.searchText || '');
  const [sortMode, setSortMode] = useState<SortMode>((uiState?.tableState?.sortMode as SortMode) || 'status');
  const [filteredInfo, setFilteredInfo] = useState<Record<string, FilterValue | null>>(
    (uiState?.tableState?.filteredInfo as Record<string, FilterValue | null>) || {},
  );
  const [sortedInfo, setSortedInfo] = useState<SorterResult<TableRecord>>(
    (uiState?.tableState?.sortedInfo as SorterResult<TableRecord>) || {},
  );

  useEffect(() => {
    if (uiState?.tableState) {
      setSearchText((uiState.tableState.searchText as string) || '');
      setSortMode((uiState.tableState.sortMode as SortMode) || 'status');
      setFilteredInfo((uiState.tableState.filteredInfo as Record<string, FilterValue | null>) || {});
      setSortedInfo((uiState.tableState.sortedInfo as SorterResult<TableRecord>) || {});
    }
  }, [uiState?.tableState]);

  // Build table records from all V5 rules, sorted by status group then name
  const dataSource: TableRecord[] = rules
    .map((rule) => {
      const isEnabled = rule.enabled;
      const complete = isRuleComplete(rule);
      const groupPaused = isPathPausedByAncestor(rule.path, pausedGroups);

      let statusRank: StatusRank;
      if (isEnabled && complete && !groupPaused)
        statusRank = 0; // active
      else if (isEnabled && complete && groupPaused)
        statusRank = 1; // paused
      else if (complete && !isEnabled)
        statusRank = 2; // disabled
      else statusRank = 3; // draft

      return {
        key: rule.uid,
        id: rule.uid,
        name: rule.name,
        path: rule.path,
        ruleType: rule.type,
        actionDetail: getActionDetail(rule),
        domains: rule.conditions.filter((c) => c.type === 'request-domains').flatMap((c) => c.values),
        conditions: rule.conditions,
        isEnabled,
        isComplete: complete,
        statusRank,
      };
    })
    .sort((a, b) => compareBySortMode(a, b, sortMode));

  const dataSourceRef = useRef<TableRecord[]>([]);

  const filteredData = dataSource.filter(
    (item) =>
      item.name.toLowerCase().includes(searchText.toLowerCase()) ||
      item.domains.some((domain) => domain.toLowerCase().includes(searchText.toLowerCase())) ||
      item.actionDetail.value.toLowerCase().includes(searchText.toLowerCase()) ||
      item.ruleType.toLowerCase().includes(searchText.toLowerCase()),
  );

  // Keep ref in sync for keyboard callbacks
  dataSourceRef.current = filteredData;

  const activeCount = dataSource.filter(
    (item) => item.isEnabled && item.isComplete && !isPathPausedByAncestor(item.path, pausedGroups),
  ).length;
  const draftCount = dataSource.filter((item) => !item.isComplete).length;
  const pausedCount = dataSource.filter(
    (item) => item.isEnabled && item.isComplete && isPathPausedByAncestor(item.path, pausedGroups),
  ).length;
  const totalCount = dataSource.length;

  const { paginationConfig } = useTablePagination({
    dataSource: filteredData,
    onPageInfoChange,
  });

  // Register row actions for keyboard navigation
  const handleToggleRow = useCallback(
    async (index: number) => {
      const record = dataSourceRef.current[index];
      if (!record) return;
      if (!record.id.startsWith('local-') && !isConnected) return;
      const { runtime } = await import('../../utils/browser-api');
      runtime.sendMessage(
        { type: 'toggleRule', ruleId: record.id, enabled: !record.isEnabled },
        (response: unknown) => {
          const resp = response as { success?: boolean } | undefined;
          if (!resp?.success) {
            message.error('Failed to toggle rule');
          }
        },
      );
    },
    [isConnected, message],
  );

  const handleEditRow = useCallback((index: number) => {
    const record = dataSourceRef.current[index];
    if (!record) return;
    openRulesPage(`/edit/${record.id}`);
  }, []);

  const handleCopyRow = useCallback((index: number) => {
    const record = dataSourceRef.current[index];
    if (!record?.actionDetail.value) return;
    void navigator.clipboard.writeText(record.actionDetail.value);
  }, []);

  const handleDeleteRow = useCallback(
    async (index: number) => {
      const record = dataSourceRef.current[index];
      if (!record) return;
      if (!record.id.startsWith('local-') && !isConnected) return;
      const { runtime } = await import('../../utils/browser-api');
      runtime.sendMessage({ type: 'deleteRule', ruleId: record.id }, (response: unknown) => {
        const resp = response as { success?: boolean } | undefined;
        if (resp?.success) {
          message.success('Rule deleted');
        } else {
          message.error('Failed to delete rule');
        }
      });
    },
    [isConnected, message],
  );

  const handleAddRule = useCallback(() => {
    openRulesPage('/create/header');
  }, []);

  useRowActionRegistration(onRowActionsChange, {
    onToggleRow: handleToggleRow,
    onEditRow: handleEditRow,
    onCopyRow: handleCopyRow,
    onDeleteRow: handleDeleteRow,
    onAddRule: handleAddRule,
  });

  const handleChange = (
    _pagination: unknown,
    filters: Record<string, FilterValue | null>,
    sorter: SorterResult<TableRecord> | SorterResult<TableRecord>[],
  ) => {
    setFilteredInfo(filters);
    const singleSorter = Array.isArray(sorter) ? sorter[0] : sorter;
    setSortedInfo(singleSorter);
    // Column sort overrides dropdown sort
    if (singleSorter.order) {
      setSortMode('manual');
    }
    if (updateUiState) {
      updateUiState({
        tableState: {
          searchText,
          sortMode: singleSorter.order ? 'manual' : sortMode,
          filteredInfo: filters,
          sortedInfo: singleSorter as unknown as Record<string, unknown>,
        },
      });
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchText(value);
    if (updateUiState) {
      updateUiState({
        tableState: {
          searchText: value,
          sortMode,
          filteredInfo,
          sortedInfo: sortedInfo as unknown as Record<string, unknown>,
        },
      });
    }
  };

  const handleSortModeChange = (mode: SortMode) => {
    setSortMode(mode);
    // Dropdown sort clears column sort
    setSortedInfo({});
    if (updateUiState) {
      updateUiState({
        tableState: {
          searchText,
          sortMode: mode,
          filteredInfo,
          sortedInfo: {},
        },
      });
    }
  };

  const columns: ColumnsType<TableRecord> = [
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
      width: 180,
      render: (_: unknown, record: TableRecord) => renderActionDetails(record.actionDetail),
    },
    {
      title: 'Conditions',
      dataIndex: 'conditions',
      key: 'conditions',
      width: 120,
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
      title: 'Type',
      key: 'ruleType',
      width: 90,
      align: 'center',
      sorter: (a, b) => a.ruleType.localeCompare(b.ruleType),
      filters: [...new Set(dataSource.map((item) => RULE_TYPE_LABEL[item.ruleType] ?? item.ruleType))].map((label) => ({
        text: label,
        value: label,
      })),
      filteredValue: filteredInfo.ruleType || null,
      filterSearch: true,
      onFilter: (value, record) => (RULE_TYPE_LABEL[record.ruleType] ?? record.ruleType) === value,
      sortOrder: sortedInfo.columnKey === 'ruleType' ? sortedInfo.order : null,
      render: (_: unknown, record: TableRecord) => {
        const label = RULE_TYPE_LABEL[record.ruleType] ?? record.ruleType;
        const desc = RULE_TYPE_DESCRIPTION[record.ruleType] ?? record.ruleType;
        return (
          <Tooltip title={desc}>
            <Tag variant="outlined" style={{ margin: 0, fontSize: '11px', cursor: 'help' }}>
              {label}
            </Tag>
          </Tooltip>
        );
      },
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
        const isLocal = record.id.startsWith('local-');
        const canToggle = isLocal || isConnected;
        return (
          <Switch
            checked={enabled}
            disabled={!canToggle}
            onChange={async () => {
              const { runtime } = await import('../../utils/browser-api');
              runtime.sendMessage({ type: 'toggleRule', ruleId: record.id, enabled: !enabled }, (response: unknown) => {
                const resp = response as { success?: boolean } | undefined;
                if (!resp?.success) {
                  message.error('Failed to toggle rule');
                }
              });
            }}
            size="small"
          />
        );
      },
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      align: 'center',
      fixed: 'right',
      render: (_: unknown, record: TableRecord) => {
        const isLocal = record.id.startsWith('local-');
        const canAct = isLocal || isConnected;
        return (
          <Tooltip title={!canAct ? 'App not connected' : 'Edit or delete rule'}>
            <Space size={2}>
              <Button
                type="text"
                icon={<EditOutlined />}
                size="small"
                onClick={() => openRulesPage(`/edit/${record.id}`)}
              />
              <Popconfirm
                title="Delete rule"
                description={`Delete "${record.name}"?`}
                onConfirm={async () => {
                  const { runtime } = await import('../../utils/browser-api');
                  runtime.sendMessage({ type: 'deleteRule', ruleId: record.id }, (response: unknown) => {
                    const resp = response as { success?: boolean } | undefined;
                    if (resp?.success) {
                      message.success('Rule deleted');
                    } else {
                      message.error('Failed to delete rule');
                    }
                  });
                }}
                okText="Delete"
                okType="danger"
                cancelText="Cancel"
                disabled={!canAct}
              >
                <Button type="text" danger icon={<DeleteOutlined />} size="small" disabled={!canAct} />
              </Popconfirm>
            </Space>
          </Tooltip>
        );
      },
    },
  ];

  const addRuleMenuItems = buildRuleTypeMenuItems((type) => openRulesPage(`/create/${type}`));

  const hasColumnSort = !!sortedInfo.order;
  const sortMenuItems = [
    {
      key: 'label',
      label: (
        <Text type="secondary" style={{ fontSize: '11px', fontWeight: 600 }}>
          SORT ORDER
        </Text>
      ),
      disabled: true,
    },
    {
      key: 'status',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 220 }}>
          <div>
            <div>By status</div>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              Active → Paused → Disabled → Draft · priority within each
            </Text>
          </div>
          {sortMode === 'status' && !hasColumnSort && <CheckOutlined style={{ color: '#1677ff' }} />}
        </div>
      ),
      onClick: () => handleSortModeChange('status'),
    },
    {
      key: 'priority',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 220 }}>
          <div>
            <div>By priority</div>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              Block → Redirect → Query → Header → Inject · A-Z within each
            </Text>
          </div>
          {sortMode === 'priority' && !hasColumnSort && <CheckOutlined style={{ color: '#1677ff' }} />}
        </div>
      ),
      onClick: () => handleSortModeChange('priority'),
    },
    {
      key: 'manual',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 220 }}>
          <div>
            <div>Workspace order</div>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              Matches the workspace sidebar tree order
            </Text>
          </div>
          {sortMode === 'manual' && !hasColumnSort && <CheckOutlined style={{ color: '#1677ff' }} />}
        </div>
      ),
      onClick: () => handleSortModeChange('manual'),
    },
    ...(hasColumnSort
      ? [
          { type: 'divider' as const, key: 'div' },
          {
            key: 'column-sort',
            label: (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 220 }}>
                <div>
                  <div>By column</div>
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    Sorted by {String(sortedInfo.columnKey)} — click an option above to reset
                  </Text>
                </div>
                <CheckOutlined style={{ color: '#1677ff' }} />
              </div>
            ),
            disabled: true,
          },
        ]
      : []),
  ];

  return (
    <div className="header-rules-section">
      <div className="table-toolbar">
        <div className="header-rules-title">
          <div>
            <Text style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Rules</Text>
            {totalCount > 0 && (
              <Space size={4} style={{ display: 'flex' }}>
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  {activeCount} of {totalCount} active
                  {draftCount > 0 ? `, ${draftCount} draft` : ''}
                </Text>
                {pausedCount > 0 && (
                  <>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      ·
                    </Text>
                    <Text type="warning" style={{ fontSize: '11px' }}>
                      {pausedCount} paused by collection
                    </Text>
                  </>
                )}
              </Space>
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36 }}>
              <Dropdown menu={{ items: addRuleMenuItems }} placement="bottomRight" trigger={['click']}>
                <Button type="primary" size="middle" className="add-rule-button">
                  <Space>
                    <PlusOutlined />
                    Add Rule
                    <DownOutlined style={{ fontSize: '10px' }} />
                  </Space>
                </Button>
              </Dropdown>
              <Search
                placeholder="Search anything..."
                allowClear
                size="small"
                style={{ width: 260 }}
                value={searchText}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && searchText) {
                    e.stopPropagation();
                    handleSearchChange('');
                  }
                }}
              />
              <Dropdown menu={{ items: sortMenuItems }} placement="bottomRight" trigger={['click']}>
                <Tooltip title="Sort order">
                  <Button type="text" size="small" icon={<SortAscendingOutlined />} />
                </Tooltip>
              </Dropdown>
            </div>
            <div style={{ textAlign: 'right', marginTop: 2 }}>
              <Text type="secondary" style={{ fontSize: '11px' }}>
                {searchText
                  ? `${filteredData.length} of ${totalCount} rule${totalCount !== 1 ? 's' : ''} matched`
                  : `${totalCount} rule${totalCount !== 1 ? 's' : ''}`}
              </Text>
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, paddingBottom: '8px' }}>
        <Table
          dataSource={filteredData}
          columns={columns}
          pagination={paginationConfig}
          size="small"
          scroll={{ x: 680, y: 290 }}
          onChange={handleChange}
          onRow={(_record: TableRecord, index) => ({
            onClick: () => {
              if (index !== undefined) {
                setFocusedRowIndex(index);
                (document.activeElement as HTMLElement)?.blur();
              }
            },
          })}
          rowClassName={(record: TableRecord, index: number) => {
            const classes: string[] = [];
            if (!record.isComplete) classes.push('row-draft');
            else if (isPathPausedByAncestor(record.path, pausedGroups)) classes.push('row-group-paused');
            else if (!record.isEnabled) classes.push('row-disabled');
            if (index === focusedRowIndex) classes.push('keyboard-focused-row');
            if (index === pendingDeleteIndex) classes.push('keyboard-pending-delete-row');
            return classes.join(' ');
          }}
          locale={{
            emptyText: (
              <Empty
                image={<FileTextOutlined style={{ fontSize: 28, color: 'var(--text-tertiary)' }} />}
                description={
                  searchText ? (
                    <Text type="secondary">No matching rules found</Text>
                  ) : (
                    <Space orientation="vertical" size={4}>
                      <Text type="secondary">No rules yet</Text>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        Click "Add Rule" to create a local rule or use the desktop app
                      </Text>
                    </Space>
                  )
                }
                style={{ padding: '32px 0' }}
              />
            ),
          }}
          className="header-rules-table"
          style={{ width: '100%', flex: 1 }}
        />
        <DeleteConfirmOverlay
          pendingDeleteIndex={pendingDeleteIndex}
          itemName={filteredData[pendingDeleteIndex]?.name ?? ''}
        />
      </div>
    </div>
  );
};

export default RulesTable;
