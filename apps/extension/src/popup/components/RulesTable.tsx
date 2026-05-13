import {
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  PlusOutlined,
  SortAscendingOutlined,
} from '@ant-design/icons';
import { useKeyboardNav } from '@context/KeyboardNavContext';
import { useRuleMutator } from '@hooks/useRuleMutator';
import { useRules } from '@hooks/useRules';
import { useVariableResolver } from '@hooks/useVariableResolver';
import type { ExtensionRuleType, RuleCondition, RuleType } from '@openheaders/core/types';
import { getActionDetail, isRuleComplete, isRuleDraft, resolvePauseState } from '@openheaders/core/utils';
import { resolveRule } from '@openheaders/core/variables';
import {
  App,
  Button,
  Dropdown,
  Empty,
  Grid,
  Input,
  Popconfirm,
  Space,
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
import { useSurface } from '@/shared/surface';
import { openWorkspace, type WorkspaceIntent } from '@/shared/workspace-intent';
import { compareBySortMode, type PageInfo, type RowActions, type SortMode } from '../utils/table-shared';
import { AddRulePalette } from './AddRulePalette';
import {
  type ActionDetail,
  renderActionDetails,
  renderConditionsSummary,
  truncateValue,
} from './columns/sharedColumnRenderers';
import DeleteConfirmOverlay from './DeleteConfirmOverlay';
import TestRunModal, { type TestRunOwnerType } from './TestRunModal';

const NOT_CONNECTED_TIP = (
  <>
    App not connected
    <div style={{ marginTop: 4 }}>
      <Tag color="blue" style={{ marginInlineEnd: 4 }}>
        v5
      </Tag>
      coming soon
    </div>
  </>
);

/** Open the full-page rules editor in a new tab. */
/**
 * Dispatch an intent to the workspace via the SW navigator. Captures
 * the caller surface so cross-window focus-steal rules apply.
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

const { Search } = Input;
const { Text } = Typography;

/** 0 = active, 1 = paused, 2 = disabled, 3 = draft */
type StatusRank = 0 | 1 | 2 | 3;

interface TableRecord {
  key: string;
  id: string;
  name: string;
  path: string;
  ruleType: RuleType;
  actionDetail: ActionDetail;
  domains: string[];
  conditions: RuleCondition[];
  isEnabled: boolean;
  isComplete: boolean;
  /** True for unpublished rules — derived from `isRuleDraft(rule)`.
   *  Drives the gray "draft" row styling (publication gate, distinct
   *  from completeness). */
  isDraft: boolean;
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

  const { rules, activeWorkspaceId, uiState, updateUiState, pauseMarkers } = useRules();
  const ruleMutator = useRuleMutator({ workspaceId: activeWorkspaceId, surfaceId: 'popup' });
  const { setFocusedRowIndex } = useKeyboardNav();
  const screens = Grid.useBreakpoint();
  const openRulesIntent = useOpenRulesIntent();
  // Resolve `{{var}}` templates in rule conditions + actions before
  // rendering the row. Without this the popup shows literal templates
  // (`Bearer {{vault.X}}`) instead of the values that actually flow
  // to the wire — and the user can't tell at a glance whether the rule
  // resolves cleanly. The resolver is memoized inside `useVariableResolver`
  // so recomputation only fires on variable-store changes.
  const resolver = useVariableResolver();

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

  // Per-rule test launcher state. The same TestRunModal that drives
  // collection/folder testing — opened with ownerType='rule' and the
  // single rule's uid as the owner, so the resulting session lands in
  // that rule's bucket.
  const [testState, setTestState] = useState<{
    open: boolean;
    ownerType: TestRunOwnerType;
    ownerId: string;
    scopeLabel: string;
    ruleUids: string[];
  }>({ open: false, ownerType: 'rule', ownerId: '', scopeLabel: '', ruleUids: [] });

  const handleTestRule = useCallback((record: TableRecord) => {
    setTestState({
      open: true,
      ownerType: 'rule',
      ownerId: record.id,
      scopeLabel: record.name,
      ruleUids: [record.id],
    });
  }, []);

  const handleTestAll = useCallback(() => {
    const allUids = rules.map((r) => r.uid);
    if (allUids.length === 0) {
      message.info('No rules to test');
      return;
    }
    setTestState({
      open: true,
      ownerType: 'workspace',
      ownerId: 'all',
      scopeLabel: 'All rules',
      ruleUids: allUids,
    });
  }, [rules, message]);

  // Build table records from all V5 rules, sorted by status group then name.
  // `actionDetail` and the displayed `conditions` flow from the RESOLVED
  // rule (templates substituted) so the row reflects what reaches the
  // wire — not the literal `{{ref}}` source. The original `rule` is
  // still used for the IS-COMPLETE / pause checks because completeness
  // is a structural property independent of variable values.
  const dataSource: TableRecord[] = rules
    .map((rule) => {
      const isEnabled = rule.enabled;
      const complete = isRuleComplete(rule);
      const draft = isRuleDraft(rule);
      const groupPaused = resolvePauseState(rule.path, pauseMarkers);
      const resolved = resolveRule(rule, resolver);

      // Status rank drives sort order: active first, then paused/disabled,
      // drafts last. Unpublished rules are treated as "draft" regardless
      // of completeness — they're not on the wire either way.
      let statusRank: StatusRank;
      if (draft)
        statusRank = 3; // draft
      else if (isEnabled && complete && !groupPaused)
        statusRank = 0; // active
      else if (isEnabled && complete && groupPaused)
        statusRank = 1; // paused
      else if (complete && !isEnabled)
        statusRank = 2; // disabled
      else statusRank = 3; // draft / incomplete

      return {
        key: rule.uid,
        id: rule.uid,
        name: rule.name,
        path: rule.path,
        ruleType: rule.type,
        actionDetail: getActionDetail(resolved),
        domains: resolved.conditions.filter((c) => c.type === 'request-domains').flatMap((c) => c.values),
        conditions: resolved.conditions,
        isEnabled,
        isComplete: complete,
        isDraft: draft,
        statusRank,
      };
    })
    .sort((a, b) => compareBySortMode(a, b, sortMode));

  const dataSourceRef = useRef<TableRecord[]>([]);

  const filteredData = dataSource.filter(
    (item) =>
      item.name.toLowerCase().includes(searchText.toLowerCase()) ||
      item.domains.some((domain) => domain.toLowerCase().includes(searchText.toLowerCase())) ||
      (item.actionDetail.value || '').toLowerCase().includes(searchText.toLowerCase()) ||
      item.ruleType.toLowerCase().includes(searchText.toLowerCase()),
  );

  // Keep ref in sync for keyboard callbacks
  dataSourceRef.current = filteredData;

  const activeCount = dataSource.filter(
    (item) => item.isEnabled && item.isComplete && !resolvePauseState(item.path, pauseMarkers),
  ).length;
  const draftCount = dataSource.filter((item) => !item.isComplete).length;
  const pausedCount = dataSource.filter(
    (item) => item.isEnabled && item.isComplete && resolvePauseState(item.path, pauseMarkers),
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
      const resp = await ruleMutator.toggleRule(record.id, !record.isEnabled);
      if (!resp.ok) {
        message.error('Failed to toggle rule');
      }
    },
    [message, ruleMutator],
  );

  const handleEditRow = useCallback(
    (index: number) => {
      const record = dataSourceRef.current[index];
      if (!record) return;
      openRulesIntent({ kind: 'edit-rule', uid: record.id });
    },
    [openRulesIntent],
  );

  const handleCopyRow = useCallback((index: number) => {
    const record = dataSourceRef.current[index];
    if (!record?.actionDetail.value) return;
    void navigator.clipboard.writeText(record.actionDetail.value);
  }, []);

  const handleDeleteRow = useCallback(
    async (index: number) => {
      const record = dataSourceRef.current[index];
      if (!record) return;
      const resp = await ruleMutator.deleteRule(record.id);
      if (resp.ok) {
        message.success('Rule deleted');
      } else {
        message.error('Failed to delete rule');
      }
    },
    [message, ruleMutator],
  );

  const [addRulePaletteOpen, setAddRulePaletteOpen] = useState(false);

  const handleAddRule = useCallback(() => {
    setAddRulePaletteOpen((prev) => !prev);
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

  const handlePaletteSelect = useCallback(
    (ruleType: ExtensionRuleType, templateKey?: string) => {
      openRulesIntent({ kind: 'create-rule', ruleType, templateKey });
    },
    [openRulesIntent],
  );

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

  // Compute the table's `scroll.x` from the columns Ant will actually
  // render at the current viewport. Hardcoding `scroll.x: 680` (the
  // full-width sum) leaves a phantom scroll area when `responsive`
  // hides Details / Conditions, which pushes the fixed-right Toggle
  // and Actions columns off the visible right edge — so the user sees
  // only the Name column with no actions. Sum the same widths Ant uses
  // for visibility (`responsive` matches Antd's `Grid.useBreakpoint`).
  const tableScrollX =
    170 + // Name (always)
    (screens.md ? 270 : 0) + // Details — responsive: ['md']
    (screens.sm ? 120 : 0) + // Conditions — responsive: ['sm']
    50 + // Toggle (always)
    88; // Actions (always)

  return (
    <div className="header-rules-section">
      <div className="table-toolbar">
        <div className="header-rules-title">
          <div>
            <Text style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Rules</Text>
            {totalCount > 0 && (
              <Space className="oh-toolbar-status" size={4} style={{ display: 'flex' }}>
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  {activeCount} of {totalCount} active
                  {draftCount > 0 ? `, ${draftCount} draft` : ''}
                </Text>
                {pausedCount > 0 && (
                  <span className="oh-status-detail" style={{ display: 'inline-flex', gap: 4 }}>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      ·
                    </Text>
                    <Text type="warning" style={{ fontSize: '11px' }}>
                      {pausedCount} paused by collection
                    </Text>
                  </span>
                )}
              </Space>
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36 }}>
              <Tooltip
                title="Test all workspace rules against a URL"
                placement="bottom"
                overlayStyle={{ maxWidth: 'none' }}
                overlayInnerStyle={{ whiteSpace: 'nowrap' }}
              >
                <Button
                  className="oh-toolbar-secondary"
                  size="middle"
                  icon={<ExperimentOutlined />}
                  onClick={handleTestAll}
                  disabled={rules.length === 0}
                  // Match the .add-rule-button height (36px hard-coded in
                  // popup.less) so both buttons sit on the same baseline.
                  // Square aspect since this is icon-only.
                  style={{
                    height: 36,
                    width: 36,
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
              </Tooltip>
              <Tooltip title="Add a rule — search across types and templates">
                <Button
                  type="primary"
                  size="middle"
                  className="add-rule-button"
                  onClick={() => setAddRulePaletteOpen(true)}
                >
                  <Space>
                    <PlusOutlined />
                    <span className="oh-collapse-label">Add Rule</span>
                  </Space>
                </Button>
              </Tooltip>
              <Search
                className="oh-search oh-toolbar-secondary"
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
                  <Button className="oh-toolbar-secondary" type="text" size="small" icon={<SortAscendingOutlined />} />
                </Tooltip>
              </Dropdown>
            </div>
            <div className="oh-toolbar-secondary" style={{ textAlign: 'right', marginTop: 2 }}>
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
          scroll={{ x: tableScrollX, y: 290 }}
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
            if (record.isDraft) classes.push('row-draft');
            else if (resolvePauseState(record.path, pauseMarkers)) classes.push('row-group-paused');
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
      <TestRunModal
        open={testState.open}
        onClose={() => setTestState((s) => ({ ...s, open: false }))}
        ownerType={testState.ownerType}
        ownerId={testState.ownerId}
        scopeLabel={testState.scopeLabel}
        ruleUids={testState.ruleUids}
        allRules={rules}
      />
      <AddRulePalette
        open={addRulePaletteOpen}
        onClose={() => setAddRulePaletteOpen(false)}
        onSelect={handlePaletteSelect}
      />
    </div>
  );
};

export default RulesTable;
