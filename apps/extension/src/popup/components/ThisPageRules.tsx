import {
  CheckOutlined,
  CopyTwoTone,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  SortAscendingOutlined,
} from '@ant-design/icons';
import { useKeyboardNav } from '@context/KeyboardNavContext';
import { useRules } from '@hooks/useRules';
import { isPathPausedByAncestor } from '@openheaders/core/utils';
import {
  App,
  Badge,
  Button,
  Dropdown,
  Empty,
  Input,
  Popconfirm,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRowActionRegistration } from '@/hooks/useRowActionRegistration';
import { useTablePagination } from '@/hooks/useTablePagination';
import { getBrowserAPI } from '@/types/browser';
import { runtime } from '@utils/browser-api';
import { compareBySortMode, type PageInfo, type RowActions } from '../utils/table-shared';
import {
  renderActionDetails,
  renderTagOverflow,
  type TagDescriptor,
  truncateValue,
} from './columns/sharedColumnRenderers';
import DeleteConfirmOverlay from './DeleteConfirmOverlay';

declare const browser: typeof chrome | undefined;

const { Text } = Typography;

/** Open the full-page rules editor in a new tab. */
function openRulesPage(hash: string): void {
  const url = getBrowserAPI().runtime.getURL(`workspace.html#${hash}`);
  getBrowserAPI().tabs.create({ url });
}

const RULE_TYPE_LABEL: Record<string, string> = {
  header: 'Header',
  block: 'Block',
  redirect: 'Redirect',
  'query-param': 'Query Param',
  inject: 'Inject',
};

const RULE_TYPE_DESCRIPTION: Record<string, string> = {
  header: 'Modify HTTP headers',
  block: 'Block requests',
  redirect: 'Redirect requests',
  'query-param': 'Modify query parameters',
  inject: 'Inject scripts or CSS',
};

interface MatchedRequest {
  url: string;
  pattern: string;
  timestamp: number;
}

interface MatchedRequestRecord extends MatchedRequest {
  key: string;
  type: 'direct' | 'resource';
}

function formatTimestampShort(timestamp: number): React.ReactNode {
  const d = new Date(timestamp);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return (
    <>
      {h}:{m}:{s}
      <span style={{ fontSize: '9px', opacity: 0.6 }}>.{ms}</span>
    </>
  );
}

function formatTimestampFull(timestamp: number): React.ReactNode {
  const d = new Date(timestamp);
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return (
    <>
      {day} {month} {year} {h}:{m}:{s}
      <span style={{ fontSize: '9px', opacity: 0.6 }}>.{ms}</span>
    </>
  );
}

interface ActiveRule {
  id?: string;
  name: string;
  ruleType: string;
  summary: string;
  actionLabel?: string;
  actionOperation?: string;
  actionTooltip?: string;
  actionDirection?: string;
  actionValue?: string;
  isEnabled?: boolean;
  domains?: string[];
  path?: string;
  matchType?: string;
  matchedUrls?: MatchedRequest[];
}

interface CurrentTabInfo {
  id: number;
  url: string;
  domain: string;
  title: string;
}

interface TableRecord extends ActiveRule {
  key: string | number;
  statusRank: number;
}

/**
 * Renders a URL with the portion matching the pattern highlighted.
 * Strips wildcards from the pattern to find the core string in the URL.
 */
function renderHighlightedUrl(url: string, pattern: string): React.ReactNode {
  // Strip wildcard prefixes to get the matchable core: "*.example.com" → "example.com"
  const core = pattern.replace(/^\*\.?/, '').toLowerCase();
  if (!core || core === '*') {
    return <span style={{ wordBreak: 'break-all' }}>{url}</span>;
  }

  const lowerUrl = url.toLowerCase();
  const matchIndex = lowerUrl.indexOf(core);
  if (matchIndex === -1) {
    return <span style={{ wordBreak: 'break-all' }}>{url}</span>;
  }

  const before = url.substring(0, matchIndex);
  const matched = url.substring(matchIndex, matchIndex + core.length);
  const after = url.substring(matchIndex + core.length);

  return (
    <span style={{ wordBreak: 'break-all' }}>
      <span style={{ opacity: 0.6 }}>{before}</span>
      <span style={{ color: '#69b1ff', fontWeight: 600 }}>{matched}</span>
      <span style={{ opacity: 0.6 }}>{after}</span>
    </span>
  );
}

interface ThisPageRulesProps {
  isActive?: boolean;
  focusedRowIndex?: number;
  pendingDeleteIndex?: number;
  onPageInfoChange?: (info: PageInfo) => void;
  onRowActionsChange?: (actions: RowActions) => void;
}

const ThisPageRules: React.FC<ThisPageRulesProps> = ({
  isActive = true,
  focusedRowIndex = -1,
  pendingDeleteIndex = -1,
  onPageInfoChange,
  onRowActionsChange,
}) => {
  const { message } = App.useApp();
  const { isConnected, pausedGroups } = useRules();
  const {
    expandedRowKey,
    nestedFocusIndex,
    setNestedRowCount,
    toggleExpandedRow,
    setFocusedRowIndex,
    setNestedFocusIndex,
  } = useKeyboardNav();
  const nestedTableRef = useRef<{
    nativeElement: HTMLDivElement;
    scrollTo: (config: { index?: number; key?: React.Key; top?: number }) => void;
  } | null>(null);
  const [currentTab, setCurrentTab] = useState<CurrentTabInfo | null>(null);
  const [activeRules, setActiveRules] = useState<ActiveRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedRowId, setCopiedRowId] = useState<string | number | null>(null);
  const [uniqueRequestCount, setUniqueRequestCount] = useState(0);
  const expandCountRef = useRef(0);
  const [searchText, setSearchText] = useState('');
  const [sortMode, setSortMode] = useState<'status' | 'priority' | 'manual'>('status');
  const [filteredInfo, setFilteredInfo] = useState<Record<string, FilterValue | null>>({});
  const [sortedInfo, setSortedInfo] = useState<SorterResult<TableRecord>>({});

  useEffect(() => {
    const fetchActiveRules = async () => {
      try {
        const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
        const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
          const tab = tabs[0];
          const url = new URL(tab.url!);
          const response = await new Promise<{ activeRules?: ActiveRule[]; uniqueRequestCount?: number }>((resolve) => {
            runtime.sendMessage({ type: 'getActiveRulesForTab', tabId: tab.id, tabUrl: tab.url }, (resp) => {
              resolve((resp as { activeRules?: ActiveRule[]; uniqueRequestCount?: number }) || { activeRules: [] });
            });
          });
          setCurrentTab({ id: tab.id!, url: tab.url!, domain: url.hostname, title: tab.title || '' });
          setActiveRules(response.activeRules || []);
          setUniqueRequestCount(response.uniqueRequestCount || 0);
        }
      } catch (error) {
        console.error(new Date().toISOString(), 'ERROR', '[ThisPageRules]', 'Error getting active rules:', error);
        setActiveRules([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchActiveRules();

    const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
    const handleTabUpdate = (_tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => {
      if (changeInfo.status === 'complete' && tab.active) void fetchActiveRules();
    };
    browserAPI.tabs.onUpdated.addListener(handleTabUpdate);
    browserAPI.tabs.onActivated.addListener(fetchActiveRules);
    const handleStorageChange = () => {
      void fetchActiveRules();
    };
    browserAPI.storage.onChanged.addListener(handleStorageChange);

    // Listen for tracked URL changes pushed from the background
    // when the request monitor intercepts new requests.
    const handleRuntimeMessage = (msg: Record<string, unknown>) => {
      if (msg.type === 'trackedUrlsUpdated') {
        void fetchActiveRules();
      }
    };
    runtime.onMessage.addListener(handleRuntimeMessage as Parameters<typeof runtime.onMessage.addListener>[0]);

    return () => {
      browserAPI.tabs.onUpdated.removeListener(handleTabUpdate);
      browserAPI.tabs.onActivated.removeListener(fetchActiveRules);
      browserAPI.storage.onChanged.removeListener(handleStorageChange);
      runtime.onMessage.removeListener(handleRuntimeMessage as Parameters<typeof runtime.onMessage.removeListener>[0]);
    };
  }, []);

  // Scroll virtual nested table to focused row (also resets on expand)
  // biome-ignore lint/correctness/useExhaustiveDependencies: expandedRowKey intentionally resets scroll on re-expand
  useEffect(() => {
    if (nestedFocusIndex < 0) return;
    // Wait a frame for the new nested table to mount when switching rules
    const frame = requestAnimationFrame(() => {
      if (nestedTableRef.current) {
        nestedTableRef.current.scrollTo({ index: nestedFocusIndex });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [nestedFocusIndex, expandedRowKey]);

  const dataSourceRef = useRef<TableRecord[]>([]);

  // Track how each rule matches the search: by rule properties, by URL, or both
  const urlMatchCountMap = new Map<string, number>();
  const filteredRules = searchText
    ? activeRules.filter((r) => {
        const q = searchText.toLowerCase();
        const matchesByRule =
          r.name.toLowerCase().includes(q) ||
          (r.summary || '').toLowerCase().includes(q);
        const matchingUrlCount = (r.matchedUrls || []).filter((m) => m.url.toLowerCase().includes(q)).length;
        if (matchingUrlCount > 0 && r.id) urlMatchCountMap.set(r.id, matchingUrlCount);
        return matchesByRule || matchingUrlCount > 0;
      })
    : activeRules;

  // Sort: rules with URL matches first (most relevant), then by name
  const sortedFilteredRules = searchText
    ? [...filteredRules].sort((a, b) => {
        const aUrlMatches = urlMatchCountMap.get(a.id || '') || 0;
        const bUrlMatches = urlMatchCountMap.get(b.id || '') || 0;
        if (aUrlMatches > 0 && bUrlMatches === 0) return -1;
        if (aUrlMatches === 0 && bUrlMatches > 0) return 1;
        return 0;
      })
    : filteredRules;

  const dataSource: TableRecord[] = sortedFilteredRules
    .map((rule, index) => {
      const isEnabled = rule.isEnabled !== false;
      const groupPaused = isPathPausedByAncestor(rule.path ?? '', pausedGroups);
      const statusRank = isEnabled && !groupPaused ? 0 : isEnabled && groupPaused ? 1 : 2;
      return {
        ...rule,
        key: (rule.id || index) as string | number,
        statusRank,
      };
    })
    .sort((a, b) => compareBySortMode(a, b, sortMode));

  // Keep ref in sync for keyboard callbacks
  dataSourceRef.current = dataSource;

  const { paginationConfig } = useTablePagination({
    dataSource,
    onPageInfoChange,
  });

  // Register row actions for keyboard navigation
  const handleToggleRow = useCallback((index: number) => {
    const record = dataSourceRef.current[index];
    if (!record) return;
    const isEnabled = record.isEnabled !== false;
    setActiveRules((prev) => prev.map((r) => (r.id === record.id ? { ...r, isEnabled: !isEnabled } : r)));
    runtime.sendMessage({ type: 'toggleRule', ruleId: record.id, enabled: !isEnabled }, (response: unknown) => {
      const resp = response as { success?: boolean } | undefined;
      if (resp?.success) {
        runtime.sendMessage({ type: 'rulesUpdated' });
      } else {
        setActiveRules((prev) => prev.map((r) => (r.id === record.id ? { ...r, isEnabled } : r)));
      }
    });
  }, []);

  const handleEditRow = useCallback((index: number) => {
    const record = dataSourceRef.current[index];
    if (!record) return;
    openRulesPage(`/edit/${record.id}`);
  }, []);

  const handleCopyRow = useCallback((index: number) => {
    const record = dataSourceRef.current[index];
    if (!record?.summary) return;
    void navigator.clipboard.writeText(record.summary);
    setCopiedRowId(record.key);
    setTimeout(() => setCopiedRowId(null), 1000);
  }, []);

  const handleDeleteRow = useCallback(
    (index: number) => {
      const record = dataSourceRef.current[index];
      if (!record) return;
      setActiveRules((prev) => prev.filter((r) => r.id !== record.id));
      runtime.sendMessage({ type: 'deleteRule', ruleId: record.id }, (response: unknown) => {
        const resp = response as { success?: boolean } | undefined;
        if (resp?.success) {
          void message.success('Rule deleted');
        } else {
          void message.error('Failed to delete rule');
        }
      });
    },
    [message],
  );

  useRowActionRegistration(onRowActionsChange, {
    onToggleRow: handleToggleRow,
    onEditRow: handleEditRow,
    onCopyRow: handleCopyRow,
    onDeleteRow: handleDeleteRow,
  });

  const handleTableChange = (
    _pagination: unknown,
    filters: Record<string, FilterValue | null>,
    sorter: SorterResult<TableRecord> | SorterResult<TableRecord>[],
  ) => {
    setFilteredInfo(filters);
    const singleSorter = Array.isArray(sorter) ? sorter[0] : sorter;
    setSortedInfo(singleSorter);
    if (singleSorter.order) setSortMode('manual');
  };

  const handleSortModeChange = (mode: 'status' | 'priority' | 'manual') => {
    setSortMode(mode);
    setSortedInfo({});
  };

  const columns: ColumnsType<TableRecord> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 170,
      fixed: 'left',
      sorter: (a, b) => a.name.localeCompare(b.name),
      sortOrder: sortedInfo.columnKey === 'name' ? sortedInfo.order : null,
      filters: [...new Set(dataSource.map((item) => item.name))].map((name) => ({ text: name, value: name })),
      filteredValue: filteredInfo.name || null,
      filterSearch: true,
      onFilter: (value, record) => record.name === value,
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
      width: 240,
      render: (_: unknown, record: TableRecord) =>
        renderActionDetails(
          {
            ruleType: record.ruleType,
            direction: record.actionDirection as 'request' | 'response' | undefined,
            operation: record.actionOperation,
            label: record.actionLabel || '',
            value: record.actionValue || '',
            tooltip: record.actionTooltip || record.summary,
          },
          1,
          24,
        ),
    },
    {
      title: 'Match',
      key: 'match',
      width: 110,
      align: 'center',
      sorter: (a, b) => {
        const matchA = a.matchType ?? '';
        const matchB = b.matchType ?? '';
        return matchA.localeCompare(matchB);
      },
      sortOrder: sortedInfo.columnKey === 'match' ? sortedInfo.order : null,
      filters: [
        ...new Set([
          'Page',
          'Resource',
          'Paused',
          ...dataSource.map((item) => RULE_TYPE_LABEL[item.ruleType] ?? item.ruleType),
        ]),
      ].map((label) => ({ text: label, value: label })),
      filteredValue: filteredInfo.match || null,
      filterSearch: true,
      onFilter: (value, record) => {
        const urls = record.matchedUrls || [];
        const hasDirectMatch = urls.some((m) => m.url === currentTab?.url) || record.matchType === 'direct';
        const hasIndirectMatch = urls.some((m) => m.url !== currentTab?.url) || record.matchType === 'indirect';
        const labels = [
          ...(hasDirectMatch ? ['Page'] : []),
          ...(hasIndirectMatch ? ['Resource'] : []),
          ...(isPathPausedByAncestor(record.path ?? '', pausedGroups) ? ['Paused'] : []),
          RULE_TYPE_LABEL[record.ruleType] ?? record.ruleType,
        ];
        return labels.includes(value as string);
      },
      render: (_: unknown, record: TableRecord) => {
        const allTags: TagDescriptor[] = [];
        if (isPathPausedByAncestor(record.path ?? '', pausedGroups)) {
          allTags.push({
            label: 'Paused',
            color: 'default',
            tooltip: 'Collection or folder is paused — rule not applied',
          });
        }
        const urls = record.matchedUrls || [];
        const hasDirectMatch = urls.some((m) => m.url === currentTab?.url) || record.matchType === 'direct';
        const hasIndirectMatch = urls.some((m) => m.url !== currentTab?.url) || record.matchType === 'indirect';
        if (hasDirectMatch) {
          allTags.push({ label: 'Page', tooltip: 'Matches this page directly' });
        }
        if (hasIndirectMatch) {
          allTags.push({ label: 'Resource', tooltip: 'Applied to resources loaded by this page' });
        }
        allTags.push({
          label: RULE_TYPE_LABEL[record.ruleType] ?? record.ruleType,
          tooltip: RULE_TYPE_DESCRIPTION[record.ruleType] ?? record.ruleType,
        });
        const hasStatusTag =
          allTags[0]?.label === 'Paused' || allTags[0]?.label === 'Page' || allTags[0]?.label === 'Resource';
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
      sorter: (a, b) => Number(b.isEnabled !== false) - Number(a.isEnabled !== false),
      sortOrder: sortedInfo.columnKey === 'isEnabled' ? sortedInfo.order : null,
      render: (enabled: unknown, record: TableRecord) => {
        const isEnabled = enabled !== false;
        const isLocal = (record.id || '').startsWith('local-');
        const canToggle = isLocal || isConnected;
        return (
          <Switch
            checked={isEnabled}
            disabled={!canToggle}
            onChange={() => {
              setActiveRules((prev) => prev.map((r) => (r.id === record.id ? { ...r, isEnabled: !isEnabled } : r)));
              runtime.sendMessage(
                { type: 'toggleRule', ruleId: record.id, enabled: !isEnabled },
                (response: unknown) => {
                  const resp = response as { success?: boolean } | undefined;
                  if (resp?.success) {
                    runtime.sendMessage({ type: 'rulesUpdated' });
                  } else {
                    setActiveRules((prev) => prev.map((r) => (r.id === record.id ? { ...r, isEnabled } : r)));
                    void message.error('Failed to toggle rule');
                  }
                },
              );
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
        const isLocal = (record.id || '').startsWith('local-');
        const canAct = isLocal || isConnected;
        return (
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
              onConfirm={() => {
                setActiveRules((prev) => prev.filter((r) => r.id !== record.id));
                runtime.sendMessage({ type: 'deleteRule', ruleId: record.id }, (response: unknown) => {
                  const resp = response as { success?: boolean } | undefined;
                  if (resp?.success) {
                    void message.success('Rule deleted');
                  } else {
                    void message.error('Failed to delete rule');
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
        );
      },
    },
  ];

  if (loading)
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <Spin size="large" />
        <Text type="secondary" style={{ display: 'block', marginTop: '16px' }}>
          Loading current tab information...
        </Text>
      </div>
    );
  if (!currentTab)
    return (
      <Empty
        image={<ExclamationCircleOutlined style={{ fontSize: 32, color: 'var(--text-tertiary)' }} />}
        description="Unable to get current tab information"
        style={{ padding: '40px 0' }}
      />
    );
  const isSystemPage =
    !currentTab.domain ||
    /^(chrome|chrome-extension|edge|moz-extension|about|opera|vivaldi|brave):/.test(currentTab.url);

  const activeCount = activeRules.filter(
    (r) => r.isEnabled !== false && !isPathPausedByAncestor(r.path ?? '', pausedGroups),
  ).length;

  return (
    <div className="header-rules-section" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="table-toolbar">
        <div className="header-rules-title">
          <div>
            <Tooltip
              title={currentTab.domain.length > 30 ? currentTab.domain : undefined}
              styles={{ root: { maxWidth: 500 } }}
            >
              <Text style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {currentTab.domain.length > 30
                  ? `${currentTab.domain.substring(0, 20)}...${currentTab.domain.substring(currentTab.domain.length - 7)}`
                  : currentTab.domain}
              </Text>
            </Tooltip>
            <Space size={4} style={{ display: 'flex' }}>
              <Text type="secondary" style={{ fontSize: '11px' }}>
                {activeCount} of {activeRules.length} active
              </Text>
              {(() => {
                const pausedCount = activeRules.filter((r) =>
                  isPathPausedByAncestor(r.path ?? '', pausedGroups),
                ).length;
                return pausedCount > 0 ? (
                  <>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      ·
                    </Text>
                    <Text type="warning" style={{ fontSize: '11px' }}>
                      {pausedCount} rule{pausedCount !== 1 ? 's' : ''} paused by collection
                    </Text>
                  </>
                ) : null;
              })()}
            </Space>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36 }}>
              <Space size={6} align="center">
                <Badge status="processing" />
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  Live — monitoring requests
                </Text>
              </Space>
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
                              Active → Paused → Disabled · priority within each
                            </Text>
                          </div>
                          {sortMode === 'status' && !sortedInfo.order && (
                            <CheckOutlined style={{ color: '#1677ff' }} />
                          )}
                        </div>
                      ),
                      onClick: () => handleSortModeChange('status'),
                    },
                    {
                      key: 'priority',
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
                            <div>By priority</div>
                            <Text type="secondary" style={{ fontSize: '11px' }}>
                              Block → Redirect → Query → Header → Inject · A-Z within each
                            </Text>
                          </div>
                          {sortMode === 'priority' && !sortedInfo.order && (
                            <CheckOutlined style={{ color: '#1677ff' }} />
                          )}
                        </div>
                      ),
                      onClick: () => handleSortModeChange('priority'),
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
                            <div>Workspace order</div>
                            <Text type="secondary" style={{ fontSize: '11px' }}>
                              Matches the workspace sidebar tree order
                            </Text>
                          </div>
                          {sortMode === 'manual' && !sortedInfo.order && (
                            <CheckOutlined style={{ color: '#1677ff' }} />
                          )}
                        </div>
                      ),
                      onClick: () => handleSortModeChange('manual'),
                    },
                    ...(sortedInfo.order
                      ? [
                          { type: 'divider' as const, key: 'div' },
                          {
                            key: 'column-sort',
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
            <div
              className="value-cell"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 6,
                marginTop: 2,
              }}
            >
              <Text type="secondary" style={{ fontSize: '11px' }}>
                {(() => {
                  if (!searchText) {
                    return `${uniqueRequestCount} request${uniqueRequestCount !== 1 ? 's' : ''}`;
                  }
                  const q = searchText.toLowerCase();
                  const filteredRequests = new Set<string>();
                  for (const r of sortedFilteredRules) {
                    for (const m of r.matchedUrls || []) {
                      if (m.url.toLowerCase().includes(q)) filteredRequests.add(`${m.url}\0${m.timestamp}`);
                    }
                  }
                  const parts: string[] = [];
                  parts.push(
                    `${sortedFilteredRules.length} of ${activeRules.length} rule${activeRules.length !== 1 ? 's' : ''}`,
                  );
                  if (filteredRequests.size > 0) {
                    parts.push(
                      `${filteredRequests.size} of ${uniqueRequestCount} request${uniqueRequestCount !== 1 ? 's' : ''}`,
                    );
                  }
                  return `${parts.join(', ')} matched`;
                })()}
              </Text>
              {copiedRowId === '__stats__' ? (
                <CheckOutlined style={{ fontSize: '11px', color: '#52c41a', cursor: 'default' }} />
              ) : (
                <Tooltip title="Copy requests as TSV">
                  <CopyTwoTone
                    className="value-copy-icon"
                    style={{ fontSize: '11px', cursor: 'pointer' }}
                    onClick={() => {
                      const seen = new Set<string>();
                      const rows: string[] = [];
                      const q = searchText.toLowerCase();
                      const fmt = (ts: number) => {
                        const d = new Date(ts);
                        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
                      };
                      for (const r of sortedFilteredRules) {
                        for (const m of r.matchedUrls || []) {
                          if (q && !m.url.toLowerCase().includes(q)) continue;
                          const key = `${m.url}\0${m.timestamp}`;
                          if (seen.has(key)) continue;
                          seen.add(key);
                          const type = m.url === currentTab?.url ? 'Page' : 'Resource';
                          rows.push(`${fmt(m.timestamp)}\t${m.url}\t${type}\t${m.pattern}`);
                        }
                      }
                      rows.sort((a, b) => b.localeCompare(a));
                      void navigator.clipboard.writeText(`Time\tRequest URL\tType\tPattern\n${rows.join('\n')}`);
                      setCopiedRowId('__stats__');
                      setTimeout(() => setCopiedRowId(null), 1000);
                    }}
                  />
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, paddingBottom: '8px' }}>
        <Table
          dataSource={dataSource}
          columns={columns}
          onChange={handleTableChange}
          pagination={paginationConfig}
          size="small"
          scroll={{ x: 630, y: 290 }}
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
            if (isPathPausedByAncestor(record.path ?? '', pausedGroups)) classes.push('row-group-paused');
            else if (record.isEnabled === false) classes.push('row-disabled');
            if (index === focusedRowIndex) classes.push('keyboard-focused-row');
            if (index === pendingDeleteIndex) classes.push('keyboard-pending-delete-row');
            return classes.join(' ');
          }}
          expandable={{
            columnWidth: 40,
            expandRowByClick: false,
            expandedRowKeys: isActive && expandedRowKey !== null ? [expandedRowKey] : [],
            expandIcon: ({ record, onExpand }) => {
              const totalRequests = (record.matchedUrls || []).length;
              const searchUrlMatches = searchText && record.id ? urlMatchCountMap.get(record.id) || 0 : 0;
              const badgeCount = searchText ? searchUrlMatches : totalRequests;
              const bgColor = searchUrlMatches > 0 ? '#1677ff' : '#8c8c8c';
              const badgeTooltip =
                searchUrlMatches > 0
                  ? `${searchUrlMatches} of ${totalRequests} request${totalRequests !== 1 ? 's' : ''} match "${searchText}" — click to expand`
                  : badgeCount > 0
                    ? `${badgeCount} matched request${badgeCount !== 1 ? 's' : ''} — click to expand`
                    : 'No matched requests yet — click to expand';
              return (
                <Tooltip title={badgeTooltip}>
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
                      backgroundColor: badgeCount > 0 ? bgColor : '#d9d9d9',
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
            onExpand: (_expanded: boolean, record: TableRecord) => {
              expandCountRef.current += 1;
              const fullIndex = dataSource.findIndex((r) => r.key === record.key);
              const pageStart = (paginationConfig.current - 1) * paginationConfig.pageSize;
              const pageRelativeIndex = fullIndex - pageStart;
              toggleExpandedRow(record.key, pageRelativeIndex >= 0 ? pageRelativeIndex : undefined);
              (document.activeElement as HTMLElement)?.blur();
            },
            expandedRowRender: (record: TableRecord) => {
              // Only render content for the active expanded row — destroys stale virtual tables
              if (record.key !== expandedRowKey) return null;
              const allMatches = record.matchedUrls || [];
              // If this rule has URL matches for the search, filter to those URLs.
              // If the rule matched only by properties (name/value/domain/tag), show all URLs.
              const hasUrlMatches = searchText && record.id ? urlMatchCountMap.has(record.id) : false;
              const matches = hasUrlMatches
                ? allMatches.filter((m) => m.url.toLowerCase().includes(searchText.toLowerCase()))
                : allMatches;

              // Report nested row count to keyboard nav when this is the keyboard-expanded row
              if (record.key === expandedRowKey) {
                queueMicrotask(() => setNestedRowCount(matches.length));
              }

              if (matches.length === 0) {
                return (
                  <Text type="secondary" style={{ fontSize: '12px', fontStyle: 'italic' }}>
                    No matched requests yet — reload the page to capture
                  </Text>
                );
              }

              // Reverse for newest-first (Map insertion order = chronological)
              const reversed = [...matches].reverse();
              const matchedData: MatchedRequestRecord[] = reversed.map((m, i) => ({
                ...m,
                key: `${record.id}-match-${i}`,
                type: m.url === currentTab?.url ? ('direct' as const) : ('resource' as const),
              }));

              const matchedColumns: ColumnsType<MatchedRequestRecord> = [
                {
                  title: 'Time',
                  dataIndex: 'timestamp',
                  key: 'timestamp',
                  width: 100,
                  align: 'center',
                  sorter: (a, b) => a.timestamp - b.timestamp,
                  defaultSortOrder: 'descend',
                  render: (ts: number) => (
                    <Tooltip title={formatTimestampFull(ts)}>
                      <Text type="secondary" style={{ fontSize: '11px', fontFamily: 'monospace', cursor: 'default' }}>
                        {formatTimestampShort(ts)}
                      </Text>
                    </Tooltip>
                  ),
                },
                {
                  title: 'Request URL',
                  dataIndex: 'url',
                  key: 'url',
                  width: 380,
                  sorter: (a, b) => a.url.localeCompare(b.url),
                  render: (url: string, matchRecord: MatchedRequestRecord) => {
                    const display =
                      url.length > 50 ? `${url.substring(0, 30)}...${url.substring(url.length - 15)}` : url;
                    return (
                      <div
                        className="value-cell"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                        }}
                      >
                        <Tooltip
                          title={
                            <div style={{ fontSize: 12, fontFamily: 'monospace' }}>
                              <div style={{ marginBottom: 6 }}>
                                {renderHighlightedUrl(matchRecord.url, matchRecord.pattern)}
                              </div>
                              <div
                                style={{
                                  borderTop: '1px solid rgba(255,255,255,0.15)',
                                  paddingTop: 4,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                              >
                                <span style={{ opacity: 0.5, fontSize: 11 }}>matched by</span>
                                <span style={{ color: '#69b1ff', fontSize: 11 }}>{matchRecord.pattern}</span>
                              </div>
                            </div>
                          }
                          styles={{ root: { maxWidth: 500 } }}
                        >
                          <Text
                            style={{
                              fontSize: '12px',
                              fontFamily: 'monospace',
                              cursor: 'default',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {display}
                          </Text>
                        </Tooltip>
                        <span style={{ flex: 1 }} />
                        {copiedRowId === matchRecord.key ? (
                          <CheckOutlined
                            className="value-copy-icon"
                            style={{ fontSize: '11px', color: '#52c41a', flexShrink: 0, opacity: 1 }}
                          />
                        ) : (
                          <CopyTwoTone
                            className="value-copy-icon"
                            style={{ fontSize: '11px', cursor: 'pointer', flexShrink: 0, opacity: 0 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              void navigator.clipboard.writeText(url);
                              setCopiedRowId(matchRecord.key);
                              setTimeout(() => setCopiedRowId(null), 1000);
                            }}
                          />
                        )}
                      </div>
                    );
                  },
                },
                {
                  title: 'Type',
                  dataIndex: 'type',
                  key: 'type',
                  width: 80,
                  align: 'center',
                  sorter: (a, b) => a.type.localeCompare(b.type),
                  render: (type: string) => (
                    <Tag variant="outlined" style={{ margin: 0, fontSize: '11px' }}>
                      {type === 'direct' ? 'Page' : 'Resource'}
                    </Tag>
                  ),
                },
                {
                  title: 'Pattern',
                  dataIndex: 'pattern',
                  key: 'pattern',
                  width: 140,
                  sorter: (a, b) => a.pattern.localeCompare(b.pattern),
                  render: (pattern: string) => (
                    <Tooltip title={pattern}>
                      <Tag variant="outlined" style={{ margin: 0, fontSize: '11px' }}>
                        {pattern.length > 18
                          ? `${pattern.substring(0, 10)}...${pattern.substring(pattern.length - 5)}`
                          : pattern}
                      </Tag>
                    </Tooltip>
                  ),
                },
              ];

              const formatTimestamp = (ts: number) => {
                const d = new Date(ts);
                const hh = String(d.getHours()).padStart(2, '0');
                const mm = String(d.getMinutes()).padStart(2, '0');
                const ss = String(d.getSeconds()).padStart(2, '0');
                const ms = String(d.getMilliseconds()).padStart(3, '0');
                return `${hh}:${mm}:${ss}.${ms}`;
              };

              const copyAllRequests = () => {
                const header = 'Time\tRequest URL\tType\tPattern';
                const rows = matchedData.map(
                  (m) =>
                    `${formatTimestamp(m.timestamp)}\t${m.url}\t${m.type === 'direct' ? 'Page' : 'Resource'}\t${m.pattern}`,
                );
                void navigator.clipboard.writeText(`${header}\n${rows.join('\n')}`);
                setCopiedRowId('__all_requests__');
                setTimeout(() => setCopiedRowId(null), 1000);
              };

              return (
                <div>
                  <div
                    className="value-cell"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}
                  >
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      {hasUrlMatches
                        ? `${matches.length} of ${allMatches.length} request${allMatches.length !== 1 ? 's' : ''} matching "${searchText}"`
                        : `${matches.length} request${matches.length !== 1 ? 's' : ''} matched`}
                    </Text>
                    <Badge status="processing" />
                    {copiedRowId === '__all_requests__' ? (
                      <CheckOutlined style={{ fontSize: '11px', color: '#52c41a', cursor: 'default' }} />
                    ) : (
                      <Tooltip title="Copy requests as TSV">
                        <CopyTwoTone
                          className="value-copy-icon"
                          style={{ fontSize: '11px', cursor: 'pointer' }}
                          onClick={copyAllRequests}
                        />
                      </Tooltip>
                    )}
                  </div>
                  <Table<MatchedRequestRecord>
                    key={`${record.key}-${expandCountRef.current}`}
                    ref={nestedTableRef}
                    columns={matchedColumns}
                    dataSource={matchedData}
                    pagination={false}
                    size="small"
                    virtual
                    scroll={matches.length > 3 ? { y: 120 } : undefined}
                    showHeader={matches.length > 1}
                    rowClassName={(_record, index) => (index === nestedFocusIndex ? 'keyboard-focused-nested-row' : '')}
                    onRow={(_record, index) => ({
                      onClick: () => {
                        if (index !== undefined) {
                          setNestedFocusIndex(index);
                        }
                      },
                    })}
                  />
                </div>
              );
            },
            rowExpandable: () => true,
          }}
          locale={{
            emptyText: isSystemPage ? (
              <Empty
                image={<ExclamationCircleOutlined style={{ fontSize: 28, color: 'var(--text-tertiary)' }} />}
                description={
                  <Space orientation="vertical" size={4}>
                    <Text type="secondary">System Page</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Header rules do not apply to browser system pages
                    </Text>
                  </Space>
                }
                style={{ padding: '32px 0' }}
              />
            ) : (
              <Empty
                image={<FileTextOutlined style={{ fontSize: 28, color: 'var(--text-tertiary)' }} />}
                description={
                  <Space orientation="vertical" size={4}>
                    <Text type="secondary">No rules match this page</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      No rules are configured for this domain
                    </Text>
                  </Space>
                }
                style={{ padding: '32px 0' }}
              />
            ),
          }}
          className="header-rules-table"
        />
        <DeleteConfirmOverlay
          pendingDeleteIndex={pendingDeleteIndex}
          itemName={dataSource[pendingDeleteIndex]?.name ?? ''}
        />
      </div>
    </div>
  );
};

export default ThisPageRules;
