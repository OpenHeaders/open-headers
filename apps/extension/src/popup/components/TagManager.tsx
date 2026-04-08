import {
  CheckOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  PauseCircleOutlined,
  SortAscendingOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import { useKeyboardNav } from '@context/KeyboardNavContext';
import { useRules } from '@hooks/useRules';
import type { V5 } from '@openheaders/core/types';
import { App, Button, Dropdown, Empty, Input, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useRowActionRegistration } from '@/hooks/useRowActionRegistration';
import { useTablePagination } from '@/hooks/useTablePagination';
import type { PageInfo, RowActions } from '../utils/table-shared';
import { type ActionDetail, renderActionDetails, renderDomainTags } from './columns/sharedColumnRenderers';

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

const { Text } = Typography;

interface TagGroupRecord {
  key: string;
  groupKey: string;
  name: string;
  rules: V5.Rule[];
  totalCount: number;
  enabledCount: number;
  allEnabled: boolean;
  isGroupDisabled: boolean;
}

interface NestedRuleRecord {
  key: string;
  id: string;
  name: string;
  ruleType: string;
  actionDetail: ActionDetail;
  isEnabled: boolean;
  domains: string[];
  tag: string;
}

interface TagManagerProps {
  isActive?: boolean;
  focusedRowIndex?: number;
  pendingDeleteIndex?: number;
  onPageInfoChange?: (info: PageInfo) => void;
  onRowActionsChange?: (actions: RowActions) => void;
}

const TagManager: React.FC<TagManagerProps> = ({
  isActive = true,
  focusedRowIndex = -1,
  pendingDeleteIndex = -1,
  onPageInfoChange,
  onRowActionsChange,
}) => {
  const { rules, isConnected, disabledTagGroups, toggleTagGroup } = useRules();
  const { message } = App.useApp();
  const { expandedRowKey, setNestedRowCount, toggleExpandedRow, setFocusedRowIndex } = useKeyboardNav();
  const [searchText, setSearchText] = useState('');
  const [sortMode, setSortMode] = useState<'status' | 'manual'>('status');

  const groupedRules = useMemo((): TagGroupRecord[] => {
    const groups: Record<string, { name: string; rules: V5.Rule[] }> = {};
    groups.__no_tag__ = { name: 'Untagged Rules', rules: [] };

    for (const rule of rules) {
      const tag = rule.tags[0] || '__no_tag__';
      if (tag !== '__no_tag__' && !groups[tag]) {
        groups[tag] = { name: tag, rules: [] };
      }
      groups[tag].rules.push(rule);
    }

    for (const key of Object.keys(groups)) {
      if (groups[key].rules.length === 0) delete groups[key];
    }

    const sorted = Object.entries(groups).sort(([a], [b]) => {
      if (a === '__no_tag__') return 1;
      if (b === '__no_tag__') return -1;
      return a.localeCompare(b);
    });

    return sorted.map(([groupKey, groupData]) => {
      const enabled = groupData.rules.filter((r) => r.enabled).length;
      return {
        key: groupKey,
        groupKey,
        name: groupData.name,
        rules: groupData.rules,
        totalCount: groupData.rules.length,
        enabledCount: enabled,
        allEnabled: enabled === groupData.rules.length && groupData.rules.length > 0,
        isGroupDisabled: disabledTagGroups.has(groupKey),
      };
    });
  }, [rules, disabledTagGroups]);

  // Filter by search — track rule-level matches separately from group name matches
  const ruleMatchCountMap = useMemo(() => new Map<string, number>(), []);

  const filteredGroups = useMemo(() => {
    ruleMatchCountMap.clear();
    if (!searchText) return groupedRules;
    const q = searchText.toLowerCase();
    return groupedRules
      .map((group) => {
        const nameMatch = group.name.toLowerCase().includes(q);
        const matchingRules = group.rules.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.domains.some((d: string) => d.toLowerCase().includes(q)) ||
            (r.tags[0] ?? '').toLowerCase().includes(q),
        );
        if (matchingRules.length > 0) {
          ruleMatchCountMap.set(group.groupKey, matchingRules.length);
        }
        if (nameMatch) return group;
        if (matchingRules.length > 0) {
          const enabled = matchingRules.filter((r) => r.enabled).length;
          return {
            ...group,
            rules: matchingRules,
            totalCount: matchingRules.length,
            enabledCount: enabled,
            allEnabled: enabled === matchingRules.length && matchingRules.length > 0,
          };
        }
        return null;
      })
      .filter((g): g is TagGroupRecord => g !== null);
  }, [groupedRules, searchText, ruleMatchCountMap]);

  const sortedGroups = useMemo(() => {
    if (sortMode !== 'status') return filteredGroups;
    return [...filteredGroups].sort((a, b) => {
      const rankA = a.isGroupDisabled ? 1 : 0;
      const rankB = b.isGroupDisabled ? 1 : 0;
      return rankA - rankB || a.name.localeCompare(b.name);
    });
  }, [filteredGroups, sortMode]);

  const dataSourceRef = useRef<TagGroupRecord[]>([]);
  dataSourceRef.current = sortedGroups;

  const { paginationConfig } = useTablePagination({
    dataSource: sortedGroups,
    onPageInfoChange,
  });

  const handleGroupToggle = useCallback(
    (groupKey: string) => {
      toggleTagGroup(groupKey);
    },
    [toggleTagGroup],
  );

  // Row actions for keyboard navigation
  const handleToggleRow = useCallback(
    (index: number) => {
      const record = dataSourceRef.current[index];
      if (!record) return;
      handleGroupToggle(record.groupKey);
    },
    [handleGroupToggle],
  );

  useRowActionRegistration(onRowActionsChange, {
    onToggleRow: handleToggleRow,
  });

  const totalRules = rules.length;

  const columns: ColumnsType<TagGroupRecord> = [
    {
      title: 'Tag',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name: string, record: TagGroupRecord) => {
        const isExpanded = expandedRowKey === record.key;
        return (
          <Space>
            {isExpanded ? (
              <FolderOpenOutlined
                style={{ color: record.isGroupDisabled ? 'var(--ant-color-warning)' : 'var(--text-secondary)' }}
              />
            ) : (
              <FolderOutlined
                style={{ color: record.isGroupDisabled ? 'var(--ant-color-warning)' : 'var(--text-secondary)' }}
              />
            )}
            <Text strong style={{ fontSize: '13px', opacity: record.isGroupDisabled ? 0.6 : 1 }}>
              {name}
            </Text>
            {record.isGroupDisabled && (
              <PauseCircleOutlined style={{ fontSize: '12px', color: 'var(--ant-color-warning)' }} />
            )}
          </Space>
        );
      },
    },
    {
      title: 'Stats',
      key: 'stats',
      width: 140,
      render: (_: unknown, record: TagGroupRecord) => {
        if (record.isGroupDisabled) {
          return (
            <Text type="warning" style={{ fontSize: '12px' }}>
              Paused · {record.enabledCount} of {record.totalCount} enabled
            </Text>
          );
        }
        return (
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.enabledCount} of {record.totalCount} enabled
          </Text>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      align: 'center',
      fixed: 'right',
      render: (_: unknown, record: TagGroupRecord) => (
        // biome-ignore lint/a11y/useKeyWithClickEvents: stops row expand on switch click
        // biome-ignore lint/a11y/noStaticElementInteractions: stops row expand on switch click
        <span onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <Tooltip
            title={
              record.isGroupDisabled
                ? `Resume — all ${record.totalCount} rules in this group become active again`
                : `Pause — suspend all ${record.totalCount} rules without changing individual settings`
            }
          >
            <Switch
              checked={!record.isGroupDisabled}
              onChange={() => handleGroupToggle(record.groupKey)}
              checkedChildren="Active"
              unCheckedChildren="Paused"
            />
          </Tooltip>
        </span>
      ),
    },
  ];

  const nestedColumns: ColumnsType<NestedRuleRecord> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 130,
      render: (text: string) => (
        <Tooltip title={text.length > 16 ? text : undefined}>
          <Text style={{ fontSize: '13px' }}>
            {text.length > 16 ? `${text.substring(0, 10)}...${text.substring(text.length - 4)}` : text}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'Details',
      key: 'details',
      width: 150,
      render: (_: unknown, record: NestedRuleRecord) => renderActionDetails(record.actionDetail),
    },
    {
      title: 'Domains',
      dataIndex: 'domains',
      key: 'domains',
      width: 100,
      render: (domains: string[]) => renderDomainTags(domains, false),
    },
    {
      title: '',
      key: 'status',
      width: 50,
      align: 'center',
      render: (_: unknown, record: NestedRuleRecord) => {
        const isLocal = record.id.startsWith('local-');
        const canToggle = isLocal || isConnected;
        return (
          <Switch
            size="small"
            checked={record.isEnabled}
            disabled={!canToggle}
            onChange={async (checked) => {
              const { runtime } = await import('../../utils/browser-api');
              runtime.sendMessage({ type: 'toggleRule', ruleId: record.id, enabled: checked }, (response: unknown) => {
                if (!(response as { success?: boolean })?.success) message.error('Failed to toggle rule');
              });
            }}
          />
        );
      },
    },
  ];

  return (
    <div className="header-rules-section" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="table-toolbar">
        <div className="header-rules-title">
          <div>
            <Text style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Tags</Text>
            <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
              {filteredGroups.length} group{filteredGroups.length !== 1 ? 's' : ''}, {totalRules} rule
              {totalRules !== 1 ? 's' : ''}
            </Text>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', height: 36 }}>
              <Input.Search
                placeholder="Search anything..."
                allowClear
                size="small"
                style={{ width: 260 }}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && searchText) {
                    e.stopPropagation();
                    setSearchText('');
                  }
                }}
              />
              <Dropdown
                menu={{
                  items: [
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
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            minWidth: 220,
                          }}
                        >
                          <div>
                            <div>By status</div>
                            <Text type="secondary" style={{ fontSize: '11px' }}>
                              Active groups → Paused groups
                            </Text>
                          </div>
                          {sortMode === 'status' && <CheckOutlined style={{ color: '#1677ff' }} />}
                        </div>
                      ),
                      onClick: () => setSortMode('status'),
                    },
                    {
                      key: 'manual',
                      label: (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            minWidth: 220,
                          }}
                        >
                          <div>
                            <div>As created</div>
                            <Text type="secondary" style={{ fontSize: '11px' }}>
                              Original order, as in the workspace tree
                            </Text>
                          </div>
                          {sortMode === 'manual' && <CheckOutlined style={{ color: '#1677ff' }} />}
                        </div>
                      ),
                      onClick: () => setSortMode('manual'),
                    },
                  ],
                }}
                placement="bottomRight"
                trigger={['click']}
              >
                <Tooltip title="Sort order">
                  <Button type="text" size="small" icon={<SortAscendingOutlined />} />
                </Tooltip>
              </Dropdown>
            </div>
            <div style={{ textAlign: 'right', marginTop: 2 }}>
              <Text type="secondary" style={{ fontSize: '11px' }}>
                {(() => {
                  if (!searchText) return `${totalRules} rule${totalRules !== 1 ? 's' : ''}`;
                  const parts: string[] = [];
                  parts.push(
                    `${filteredGroups.length} of ${groupedRules.length} group${groupedRules.length !== 1 ? 's' : ''}`,
                  );
                  if (ruleMatchCountMap.size > 0) {
                    const matchedRules = Array.from(ruleMatchCountMap.values()).reduce((sum, c) => sum + c, 0);
                    parts.push(`${matchedRules} of ${totalRules} rule${totalRules !== 1 ? 's' : ''}`);
                  }
                  return `${parts.join(', ')} matched`;
                })()}
              </Text>
            </div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, paddingBottom: '8px' }}>
        <Table<TagGroupRecord>
          dataSource={sortedGroups}
          columns={columns}
          pagination={paginationConfig}
          size="small"
          scroll={{ x: 470, y: 290 }}
          onRow={(_record: TagGroupRecord, index) => ({
            onClick: () => {
              if (index !== undefined) {
                setFocusedRowIndex(index);
                (document.activeElement as HTMLElement)?.blur();
              }
            },
          })}
          rowClassName={(_record: TagGroupRecord, index: number) => {
            const classes: string[] = [];
            if (index === focusedRowIndex) classes.push('keyboard-focused-row');
            if (index === pendingDeleteIndex) classes.push('keyboard-pending-delete-row');
            return classes.join(' ');
          }}
          expandable={{
            columnWidth: 40,
            expandRowByClick: true,
            expandedRowKeys: isActive && expandedRowKey !== null ? [expandedRowKey] : [],
            expandIcon: ({ record, onExpand }) => {
              const badgeCount = record.totalCount;
              const hasRuleMatches = searchText && ruleMatchCountMap.has(record.groupKey);
              const bgColor = record.isGroupDisabled
                ? 'var(--ant-color-warning)'
                : hasRuleMatches
                  ? '#1677ff'
                  : badgeCount > 0
                    ? '#8c8c8c'
                    : '#d9d9d9';
              return (
                <Tooltip title={`${badgeCount} rule${badgeCount !== 1 ? 's' : ''} in this group — click to expand`}>
                  <span
                    style={{
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 20,
                      height: 18,
                      padding: '0 5px',
                      borderRadius: 5,
                      backgroundColor: bgColor,
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 600,
                      lineHeight: 1,
                    }}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => onExpand(record, e)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ')
                        onExpand(record, e as unknown as React.MouseEvent<HTMLElement>);
                    }}
                  >
                    {badgeCount}
                  </span>
                </Tooltip>
              );
            },
            onExpand: (_expanded: boolean, record: TagGroupRecord) => {
              const fullIndex = sortedGroups.findIndex((g) => g.key === record.key);
              const pageStart = (paginationConfig.current - 1) * paginationConfig.pageSize;
              const pageRelativeIndex = fullIndex - pageStart;
              toggleExpandedRow(record.key, pageRelativeIndex >= 0 ? pageRelativeIndex : undefined);
              (document.activeElement as HTMLElement)?.blur();
            },
            expandedRowRender: (record: TagGroupRecord) => {
              const nestedData: NestedRuleRecord[] = record.rules.map((rule) => ({
                key: rule.uid,
                id: rule.uid,
                name: rule.name,
                ruleType: rule.type,
                actionDetail: getActionDetail(rule),
                isEnabled: rule.enabled,
                domains: rule.domains,
                tag: rule.tags[0] ?? '',
              }));

              // Report nested row count to keyboard nav when this is the keyboard-expanded row
              if (record.key === expandedRowKey) {
                queueMicrotask(() => setNestedRowCount(nestedData.length));
              }

              if (nestedData.length === 0) {
                return (
                  <Text type="secondary" style={{ fontSize: '12px', fontStyle: 'italic' }}>
                    No rules in this group
                  </Text>
                );
              }

              return (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Text type={record.isGroupDisabled ? 'warning' : 'secondary'} style={{ fontSize: '11px' }}>
                      {record.isGroupDisabled ? 'Paused · ' : ''}
                      {record.enabledCount} of {record.totalCount} rule{record.totalCount !== 1 ? 's' : ''} individually
                      enabled
                    </Text>
                  </div>
                  <Table<NestedRuleRecord>
                    columns={nestedColumns}
                    dataSource={nestedData}
                    pagination={false}
                    size="small"
                    scroll={nestedData.length > 3 ? { y: 120 } : undefined}
                    showHeader={nestedData.length > 1}
                  />
                </div>
              );
            },
            rowExpandable: () => true,
          }}
          locale={{
            emptyText: (
              <Empty
                image={<TagsOutlined style={{ fontSize: 28, color: 'var(--text-tertiary)' }} />}
                description={
                  searchText ? (
                    <Text type="secondary">No matching tag groups found</Text>
                  ) : (
                    <Space orientation="vertical" size={4}>
                      <Text type="secondary">No tag groups</Text>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        Tag your rules for better organization
                      </Text>
                    </Space>
                  )
                }
                style={{ padding: '32px 0' }}
              />
            ),
          }}
          className="header-rules-table"
        />
      </div>
    </div>
  );
};

export default TagManager;
