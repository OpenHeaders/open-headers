import { ExclamationCircleOutlined, FileTextOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { resolvePauseState } from '@openheaders/core/utils';
import { scheduleFrame } from '@openheaders/ui/shared/frame-scheduler';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/useRules';
import { useTablePagination } from '@openheaders/ui/shared/hooks/useTablePagination';
import { useSurface } from '@openheaders/ui/shared/surface';
import type { PageInfo, RowActions } from '@openheaders/ui/shared/table-shared';
import { openWorkspace, type WorkspaceIntent } from '@openheaders/ui/shared/workspace-intent';
import { useSetting, useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import type { TrackedResourceType } from '@openheaders/ui/workbench/settings/schema/rules-engine';
import { App, Empty, Space, Spin, Table, Tag, Tooltip, Typography, theme } from 'antd';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useKeyboardNav } from '../shortcuts/KeyboardNavContext';
import DeleteConfirmOverlay from './DeleteConfirmOverlay';
import { buildThisPageRulesColumns } from './this-page-rules/columns';
import MatchedRequestsPanel from './this-page-rules/MatchedRequestsPanel';
import { buildThisPageRows } from './this-page-rules/rows';
import ThisPageToolbar from './this-page-rules/ThisPageToolbar';
import type { TableRecord } from './this-page-rules/types';
import { useThisPageRuleRowActions } from './this-page-rules/useThisPageRuleRowActions';
import { useThisPageRulesData } from './this-page-rules/useThisPageRulesData';

const { Text } = Typography;

/**
 * Hook helper — binds `openWorkspace` to the caller's surface so every
 * call site is a one-line `openRulesIntent({ kind: '…', … })`.
 */
function useOpenRulesIntent(): (intent: WorkspaceIntent) => void {
  const surface = useSurface();
  return useCallback(
    (intent: WorkspaceIntent) => {
      void openWorkspace(intent, surface.mode);
    },
    [surface.mode],
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
  const { token } = theme.useToken();
  const { pauseMarkers, activeWorkspaceId } = useRules();
  const ruleMutator = useRuleMutator({ workspaceId: activeWorkspaceId, surfaceId: 'popup' });
  const openRulesIntent = useOpenRulesIntent();
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
  const { currentTab, activeRules, setActiveRules, loading, snapshot } = useThisPageRulesData();
  const [copiedRowId, setCopiedRowId] = useState<string | number | null>(null);
  /**
   * Experimental shadow-detection setting — when true, rules whose records
   * have a `shadowedBy` attribution render with an amber warning tag and
   * the nested table's Evidence column calls out the shadower by name. The
   * data is always computed in the background; this flag just lights up
   * the UI for users who opt in. Off by default until we gather enough
   * real-world signal to default on.
   */
  const shadowDetection = useSettingValue('rulesEngine.showShadowWarnings');

  /**
   * Which resource types the user currently wants to see in this view.
   * Backed by the same `rulesEngine.visibleResourceTypes` setting as the
   * Settings page multi-select — the inline chip row below writes to it
   * and stays in perfect sync with the Settings UI. Collection in the
   * background is universal; this is pure display filtering.
   */
  const [visibleResourceTypes, setVisibleResourceTypes] = useSetting('rulesEngine.visibleResourceTypes');
  const visibleTypeSet = new Set<string>(visibleResourceTypes);
  const toggleResourceType = useCallback(
    (type: TrackedResourceType) => {
      const next = visibleTypeSet.has(type)
        ? (visibleResourceTypes.filter((t) => t !== type) as readonly TrackedResourceType[])
        : ([...visibleResourceTypes, type] as readonly TrackedResourceType[]);
      // Guard: never let the user empty the filter entirely — an empty
      // set would render nothing and there's no discoverable way back
      // short of opening the Settings page. One type must remain on.
      if (next.length === 0) return;
      setVisibleResourceTypes(next);
    },
    [visibleResourceTypes, visibleTypeSet, setVisibleResourceTypes],
  );

  const expandCountRef = useRef(0);
  const [searchText, setSearchText] = useState('');
  const [sortMode, setSortMode] = useState<'status' | 'priority' | 'manual'>('status');
  const [filteredInfo, setFilteredInfo] = useState<Record<string, FilterValue | null>>({});
  const [sortedInfo, setSortedInfo] = useState<SorterResult<TableRecord>>({});

  // Scroll virtual nested table to focused row (also resets on expand)
  // biome-ignore lint/correctness/useExhaustiveDependencies: expandedRowKey intentionally resets scroll on re-expand
  useEffect(() => {
    if (nestedFocusIndex < 0) return;
    // Wait a frame for the new nested table to mount when switching rules
    const cancel = scheduleFrame(() => {
      if (nestedTableRef.current) {
        nestedTableRef.current.scrollTo({ index: nestedFocusIndex });
      }
    });
    return cancel;
  }, [nestedFocusIndex, expandedRowKey]);

  const dataSourceRef = useRef<TableRecord[]>([]);

  const {
    recordsByRuleId,
    recordsFor,
    uniqueRequestCount,
    urlMatchCountMap,
    sortedFilteredRules,
    dataSource,
    activeCount,
    verdictCounts,
  } = buildThisPageRows({
    snapshot,
    activeRules,
    visibleTypeSet,
    pauseMarkers,
    sortMode,
    searchText,
  });

  // Keep ref in sync for keyboard callbacks
  dataSourceRef.current = dataSource;

  const { paginationConfig } = useTablePagination({
    dataSource,
    onPageInfoChange,
  });

  useThisPageRuleRowActions({
    dataSourceRef,
    setActiveRules,
    ruleMutator,
    openRulesIntent,
    setCopiedRowId,
    message,
    onRowActionsChange,
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

  const columns = buildThisPageRulesColumns({
    sortedInfo,
    filteredInfo,
    dataSource,
    pauseMarkers,
    shadowDetection,
    ruleMutator,
    message,
    setActiveRules,
    openRulesIntent,
  });

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

  return (
    <div className="header-rules-section" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ThisPageToolbar
        currentTab={currentTab}
        activeCount={activeCount}
        activeRules={activeRules}
        pauseMarkers={pauseMarkers}
        verdictCounts={verdictCounts}
        searchText={searchText}
        setSearchText={setSearchText}
        sortMode={sortMode}
        sortedInfo={sortedInfo}
        onSortModeChange={handleSortModeChange}
        token={token}
        visibleResourceTypes={visibleResourceTypes}
        visibleTypeSet={visibleTypeSet}
        setVisibleResourceTypes={setVisibleResourceTypes}
        toggleResourceType={toggleResourceType}
        openRulesIntent={openRulesIntent}
        copiedRowId={copiedRowId}
        setCopiedRowId={setCopiedRowId}
        recordsByRuleId={recordsByRuleId}
        recordsFor={recordsFor}
        sortedFilteredRules={sortedFilteredRules}
        uniqueRequestCount={uniqueRequestCount}
      />
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
            if (resolvePauseState(record.path ?? '', pauseMarkers)) classes.push('row-group-paused');
            else if (record.isEnabled === false) classes.push('row-disabled');
            if (index === focusedRowIndex) classes.push('keyboard-focused-row');
            if (index === pendingDeleteIndex) classes.push('keyboard-pending-delete-row');
            return classes.join(' ');
          }}
          expandable={{
            columnTitle: (
              <Tooltip
                styles={{ root: { maxWidth: 500 } }}
                title={
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr',
                      gap: '4px 6px',
                      alignItems: 'center',
                      fontSize: 12,
                    }}
                  >
                    <Tag
                      variant="outlined"
                      style={{ margin: 0, fontSize: 10, fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}
                    >
                      {uniqueRequestCount}
                    </Tag>
                    <span style={{ opacity: 0.7, whiteSpace: 'nowrap' }}>
                      Click badge on each row to see matched requests
                    </span>
                    <Tag
                      variant="outlined"
                      style={{ margin: 0, fontSize: 10, fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}
                    >
                      i
                    </Tag>
                    <span style={{ opacity: 0.7, whiteSpace: 'nowrap' }}>Click icon below to see documentation</span>
                  </div>
                }
              >
                <InfoCircleOutlined
                  style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
                  onClick={() => openRulesIntent({ kind: 'open-docs', section: 'request-tracking' })}
                />
              </Tooltip>
            ),
            columnWidth: 40,
            expandRowByClick: false,
            expandedRowKeys: isActive && expandedRowKey !== null ? [expandedRowKey] : [],
            expandIcon: ({ record, onExpand }) => {
              const totalRequests = record.records.length;
              const searchUrlMatches = searchText && record.id ? urlMatchCountMap.get(record.id) || 0 : 0;
              const badgeCount = searchText ? searchUrlMatches : totalRequests;
              const bgColor = searchUrlMatches > 0 ? '#1677ff' : '#8c8c8c';
              // Distinguish firing from silent in the expand-badge tooltip
              // so a user scanning a cached-heavy page sees "5 requests
              // (all silent — cached)" rather than an identical tooltip to
              // a 5-fire rule. Pure-silent counts use "silent", mixed
              // counts list both, and pure-fire counts read plain.
              const silentCount = record.records.filter((r) => r.evidence === 'silent').length;
              const firingCount = totalRequests - silentCount;
              const describeRequests = (n: number): string => `${n} matched request${n !== 1 ? 's' : ''}`;
              const expandHint = 'click to expand';
              const badgeTooltip =
                searchUrlMatches > 0
                  ? `${searchUrlMatches} of ${totalRequests} request${totalRequests !== 1 ? 's' : ''} match "${searchText}" — ${expandHint}`
                  : badgeCount === 0
                    ? 'No matched requests yet — click to expand'
                    : silentCount === totalRequests
                      ? `${describeRequests(totalRequests)}, all cache-served (silent) — ${expandHint}`
                      : silentCount > 0
                        ? `${describeRequests(firingCount)} fired + ${silentCount} silent (cached) — ${expandHint}`
                        : `${describeRequests(totalRequests)} — ${expandHint}`;
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
            expandedRowRender: (record: TableRecord) => (
              <MatchedRequestsPanel
                record={record}
                expandedRowKey={expandedRowKey}
                searchText={searchText}
                urlMatchCountMap={urlMatchCountMap}
                currentTab={currentTab}
                setNestedRowCount={setNestedRowCount}
                copiedRowId={copiedRowId}
                setCopiedRowId={setCopiedRowId}
                shadowDetection={shadowDetection}
                expandCountRef={expandCountRef}
                nestedTableRef={nestedTableRef}
                nestedFocusIndex={nestedFocusIndex}
                setNestedFocusIndex={setNestedFocusIndex}
              />
            ),
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
