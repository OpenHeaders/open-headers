import {
  ApiOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  FileTextOutlined,
  LinkOutlined,
  PlusOutlined,
  SendOutlined,
  SortAscendingOutlined,
  StopOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { useKeyboardNav } from '@context/KeyboardNavContext';
import { useRules } from '@hooks/useRules';
import type { V5 } from '@openheaders/core/types';
import { isRuleComplete } from '@openheaders/core/utils';
import { App, Button, Dropdown, Empty, Input, Popconfirm, Space, Switch, Table, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRowActionRegistration } from '@/hooks/useRowActionRegistration';
import { useTablePagination } from '@/hooks/useTablePagination';
import { getBrowserAPI } from '@/types/browser';
import { getTagColor, type PageInfo, type RowActions } from '../utils/table-shared';
import {
  type ActionDetail,
  renderActionDetails,
  renderDomainTags,
  renderTagOverflow,
  type TagDescriptor,
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

/** Structured action detail for the Details column. */
const HEADER_OP_TOOLTIP: Record<string, string> = {
  override: 'Replaces existing header value',
  add: 'Adds header if not present',
  remove: 'Removes header entirely',
};

function getActionDetail(rule: V5.Rule): ActionDetail {
  switch (rule.type) {
    case 'header': {
      const { operation, headerName, isResponse } = rule.action;
      const dir = isResponse ? ' ↓' : ' ↑';
      const opMap: Record<string, string> = { override: 'OVERRIDE', add: 'ADD', remove: 'REMOVE' };
      const tag = `${opMap[operation] ?? operation.toUpperCase()}${dir}`;
      const tooltip = HEADER_OP_TOOLTIP[operation] ?? operation;
      const direction = isResponse ? '↓ Incoming response' : '↑ Outgoing request';
      if (operation === 'remove') return { tag, tooltip, direction, value: headerName || '' };
      const value = headerName ? `${headerName}: ${rule.staticValue || ''}` : rule.staticValue || '';
      return { tag, tooltip, direction, value };
    }
    case 'block':
      return { tag: 'BLOCK', tooltip: 'Prevents request from completing', value: '' };
    case 'redirect':
      return { tag: 'REDIRECT', tooltip: 'Redirects to a different URL', value: rule.action.redirectTo || '' };
    case 'query-param': {
      const count = rule.action.params.length;
      return {
        tag: 'QUERY',
        tooltip: 'Modifies URL query parameters',
        value: `${count} param${count !== 1 ? 's' : ''}`,
      };
    }
    case 'inject':
      return {
        tag: rule.action.injectType === 'css' ? 'CSS' : 'JS',
        tooltip: rule.action.injectType === 'css' ? 'Injects stylesheet into page' : 'Injects JavaScript into page',
        value: rule.action.position,
      };
    default:
      return { tag: rule.type.toUpperCase(), tooltip: rule.type, value: '' };
  }
}

/** 0 = active, 1 = paused, 2 = disabled, 3 = draft */
type StatusRank = 0 | 1 | 2 | 3;

/** DNR priority by rule type — higher number = higher priority in Chrome's declarativeNetRequest. */
const DNR_PRIORITY: Record<string, number> = {
  header: 100,
  'query-param': 150,
  redirect: 150,
  block: 200,
  inject: 50,
};

type SortMode = 'status' | 'priority' | 'manual';

interface TableRecord {
  key: string;
  id: string;
  name: string;
  ruleType: V5.RuleType;
  actionDetail: ActionDetail;
  domains: string[];
  isEnabled: boolean;
  isComplete: boolean;
  tag: string;
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

  const { rules, isConnected, uiState, updateUiState, disabledTagGroups } = useRules();
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
      const tag = rule.tags[0] ?? '';
      const groupPaused = disabledTagGroups.has(tag || '__no_tag__');

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
        ruleType: rule.type,
        actionDetail: getActionDetail(rule),
        domains: rule.domains,
        isEnabled,
        isComplete: complete,
        tag,
        statusRank,
      };
    })
    .sort((a, b) => {
      if (sortMode === 'status') return a.statusRank - b.statusRank || a.name.localeCompare(b.name);
      if (sortMode === 'priority') {
        const pa = DNR_PRIORITY[a.ruleType] ?? 0;
        const pb = DNR_PRIORITY[b.ruleType] ?? 0;
        return pb - pa || a.name.localeCompare(b.name);
      }
      return 0; // manual — preserve original order
    });

  const dataSourceRef = useRef<TableRecord[]>([]);

  const filteredData = dataSource.filter(
    (item) =>
      item.name.toLowerCase().includes(searchText.toLowerCase()) ||
      item.domains.some((domain) => domain.toLowerCase().includes(searchText.toLowerCase())) ||
      item.actionDetail.value.toLowerCase().includes(searchText.toLowerCase()) ||
      item.tag.toLowerCase().includes(searchText.toLowerCase()) ||
      item.ruleType.toLowerCase().includes(searchText.toLowerCase()),
  );

  // Keep ref in sync for keyboard callbacks
  dataSourceRef.current = filteredData;

  const activeCount = dataSource.filter(
    (item) => item.isEnabled && item.isComplete && !disabledTagGroups.has(item.tag || '__no_tag__'),
  ).length;
  const draftCount = dataSource.filter((item) => !item.isComplete).length;
  const pausedCount = dataSource.filter(
    (item) => item.isEnabled && item.isComplete && disabledTagGroups.has(item.tag || '__no_tag__'),
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
    if (updateUiState) {
      updateUiState({
        tableState: {
          searchText,
          sortMode,
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
    if (updateUiState) {
      updateUiState({
        tableState: {
          searchText,
          sortMode: mode,
          filteredInfo,
          sortedInfo: sortedInfo as unknown as Record<string, unknown>,
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
      render: (text: string, record: TableRecord) => {
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
      sorter: (a, b) => a.actionDetail.value.localeCompare(b.actionDetail.value),
      sortOrder: sortedInfo.columnKey === 'details' ? sortedInfo.order : null,
      render: (_: unknown, record: TableRecord) => renderActionDetails(record.actionDetail),
    },
    {
      title: 'Domains',
      dataIndex: 'domains',
      key: 'domains',
      width: 110,
      sorter: (a, b) => a.domains.join(',').localeCompare(b.domains.join(',')),
      filters: [...new Set(dataSource.flatMap((item) => item.domains))].map((domain) => ({
        text: domain,
        value: domain,
      })),
      filteredValue: filteredInfo.domains || null,
      filterSearch: true,
      onFilter: (value, record) => record.domains.includes(value as string),
      sortOrder: sortedInfo.columnKey === 'domains' ? sortedInfo.order : null,
      render: (domains: string[]) => renderDomainTags(domains, false),
    },
    {
      title: 'Tags',
      key: 'tags',
      width: 110,
      align: 'center',
      sorter: (a, b) => {
        const tagA = `${a.ruleType}${a.tag ? `-${a.tag}` : ''}`;
        const tagB = `${b.ruleType}${b.tag ? `-${b.tag}` : ''}`;
        return tagA.localeCompare(tagB);
      },
      filters: [
        ...new Set([
          ...dataSource.map((item) => RULE_TYPE_LABEL[item.ruleType] ?? item.ruleType),
          ...dataSource.filter((item) => item.tag).map((item) => item.tag),
          ...dataSource.filter((item) => !item.isComplete).map(() => 'Draft'),
          ...dataSource.filter((item) => disabledTagGroups.has(item.tag || '__no_tag__')).map(() => 'Paused'),
        ]),
      ].map((tag) => ({ text: tag, value: tag })),
      filteredValue: filteredInfo.tags || null,
      filterSearch: true,
      onFilter: (value, record) => {
        const tags = [
          RULE_TYPE_LABEL[record.ruleType] ?? record.ruleType,
          ...(record.tag ? [record.tag] : []),
          ...(!record.isComplete ? ['Draft'] : []),
          ...(disabledTagGroups.has(record.tag || '__no_tag__') ? ['Paused'] : []),
        ];
        return tags.includes(value as string);
      },
      sortOrder: sortedInfo.columnKey === 'tags' ? sortedInfo.order : null,
      render: (_: unknown, record: TableRecord) => {
        const allTags: TagDescriptor[] = [];
        const tagGroup = record.tag || '__no_tag__';
        if (!record.isComplete) {
          allTags.push({
            label: 'Draft',
            color: 'default',
            tooltip: 'Incomplete — missing required fields',
          });
        } else if (disabledTagGroups.has(tagGroup)) {
          allTags.push({
            label: 'Paused',
            color: 'default',
            tooltip: `Tag group "${record.tag || 'Untagged'}" is paused — rule not applied`,
          });
        }
        if (record.tag) {
          allTags.push({
            label: record.tag,
            color: getTagColor(record.tag),
            tooltip: 'Tag group — manage in Tags tab',
          });
        }
        allTags.push({
          label: RULE_TYPE_LABEL[record.ruleType] ?? record.ruleType,
          tooltip: RULE_TYPE_DESCRIPTION[record.ruleType] ?? record.ruleType,
        });

        const hasStatusTag = allTags[0]?.label === 'Draft' || allTags[0]?.label === 'Paused';
        return renderTagOverflow(allTags, hasStatusTag ? 1 : 2);
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

  const addRuleMenuItems = [
    { key: 'header', icon: <SwapOutlined />, label: 'Modify Headers', onClick: () => openRulesPage('/create/header') },
    { key: 'block', icon: <StopOutlined />, label: 'Block Requests', onClick: () => openRulesPage('/create/block') },
    {
      key: 'redirect',
      icon: <SendOutlined />,
      label: 'Redirect Requests',
      onClick: () => openRulesPage('/create/redirect'),
    },
    {
      key: 'query-param',
      icon: <LinkOutlined />,
      label: 'Modify Query Params',
      onClick: () => openRulesPage('/create/query-param'),
    },
    {
      key: 'inject',
      icon: <CodeOutlined />,
      label: 'Inject Scripts/CSS',
      onClick: () => openRulesPage('/create/inject'),
    },
    { type: 'divider' as const },
    {
      key: 'body',
      icon: <ApiOutlined />,
      label: (
        <Tooltip title="Requires desktop app — needs HTTP proxy" placement="right">
          <span>Modify Payload</span>
        </Tooltip>
      ),
      disabled: true,
    },
    {
      key: 'delay',
      icon: <ClockCircleOutlined />,
      label: (
        <Tooltip title="Requires desktop app" placement="right">
          <span>Delay Response</span>
        </Tooltip>
      ),
      disabled: true,
    },
    {
      key: 'mock',
      icon: <DatabaseOutlined />,
      label: (
        <Tooltip title="Requires desktop app" placement="right">
          <span>Mock Response</span>
        </Tooltip>
      ),
      disabled: true,
    },
  ];

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
              Active → Paused → Disabled → Draft
            </Text>
          </div>
          {sortMode === 'status' && <CheckOutlined style={{ color: '#1677ff' }} />}
        </div>
      ),
      onClick: () => handleSortModeChange('status'),
    },
    {
      key: 'priority',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 220 }}>
          <div>
            <div>By browser priority</div>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              Block → Redirect/Query → Header → Inject
            </Text>
          </div>
          {sortMode === 'priority' && <CheckOutlined style={{ color: '#1677ff' }} />}
        </div>
      ),
      onClick: () => handleSortModeChange('priority'),
    },
    {
      key: 'manual',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 220 }}>
          <div>
            <div>As created</div>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              Original order, as in the workspace tree
            </Text>
          </div>
          {sortMode === 'manual' && <CheckOutlined style={{ color: '#1677ff' }} />}
        </div>
      ),
      onClick: () => handleSortModeChange('manual'),
    },
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
                      {pausedCount} paused by tag group
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
            else if (disabledTagGroups.has(record.tag || '__no_tag__')) classes.push('row-group-paused');
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
