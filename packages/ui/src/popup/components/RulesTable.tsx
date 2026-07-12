import { PlusOutlined, SortAscendingOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { RequestRulesIcon } from '@openheaders/ui/shared/icons';
import type { ExtensionRuleType } from '@openheaders/core/types';
import { resolvePauseState } from '@openheaders/core/utils';
import { useRowActionRegistration } from '@openheaders/ui/shared/hooks/dom/useRowActionRegistration';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { useTablePagination } from '@openheaders/ui/shared/hooks/dom/useTablePagination';
import { useVariableResolver } from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import { useSurface } from '@openheaders/ui/shared/surface';
import type { PageInfo, RowActions, SortMode } from '@openheaders/ui/shared/table-shared';
import { openWorkspace, type WorkspaceIntent } from '@openheaders/ui/shared/workspace-intent';
import { App, Button, Dropdown, Empty, Grid, Input, Space, Table, Tooltip, Typography } from 'antd';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useKeyboardNav } from '../shortcuts/KeyboardNavContext';
import { AddRulePalette } from './AddRulePalette';
import DeleteConfirmOverlay from './DeleteConfirmOverlay';
import { buildRulesTableColumns } from './rules-table-columns';
import { rulesToRecords, type TableRecord } from './rules-table-records';
import { buildRulesTableSortMenu } from './rules-table-sort-menu';

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
  const t = useT();

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
  // Suppress the sort button's tooltip while its menu is open so the
  // two popups never overlap on the same trigger.
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
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

  const dataSource: TableRecord[] = rulesToRecords(rules, pauseMarkers, resolver, sortMode);

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
        message.error(t('popup.rule.toggleFailed'));
      }
    },
    [message, ruleMutator, t],
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
        message.success(t('popup.rule.deleted'));
      } else {
        message.error(t('popup.rule.deleteFailed'));
      }
    },
    [message, ruleMutator, t],
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

  const columns = buildRulesTableColumns({
    sortedInfo,
    filteredInfo,
    dataSource,
    ruleMutator,
    message,
    openRulesIntent,
    t,
  });

  const handlePaletteSelect = useCallback(
    (ruleType: ExtensionRuleType, templateKey?: string) => {
      openRulesIntent({ kind: 'create-rule', ruleType, templateKey });
    },
    [openRulesIntent],
  );

  const sortMenuItems = buildRulesTableSortMenu({ sortMode, sortedInfo, handleSortModeChange, t });

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
            <Text style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {t('popup.rules.title')}
            </Text>
            {totalCount > 0 && (
              <Space className="oh-toolbar-status" size={4} style={{ display: 'flex' }}>
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  {t('popup.rules.activeSummary', { active: activeCount, total: totalCount })}
                  {draftCount > 0 ? t('popup.rules.draftSuffix', { count: draftCount }) : ''}
                </Text>
                {pausedCount > 0 && (
                  <span className="oh-status-detail" style={{ display: 'inline-flex', gap: 4 }}>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      ·
                    </Text>
                    <Text type="warning" style={{ fontSize: '11px' }}>
                      {t('popup.rules.pausedByCollection', { count: pausedCount })}
                    </Text>
                  </span>
                )}
              </Space>
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36 }}>
              <Tooltip title={t('popup.rules.addRuleTooltip')}>
                <Button
                  type="primary"
                  size="middle"
                  className="add-rule-button"
                  onClick={() => setAddRulePaletteOpen(true)}
                >
                  <Space>
                    <PlusOutlined />
                    <span className="oh-collapse-label">{t('popup.rules.addRule')}</span>
                  </Space>
                </Button>
              </Tooltip>
              <Search
                className="oh-search oh-toolbar-secondary"
                placeholder={t('popup.table.searchPlaceholder')}
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
              <Dropdown
                menu={{ items: sortMenuItems }}
                placement="bottomRight"
                trigger={['click']}
                onOpenChange={setSortMenuOpen}
              >
                <Tooltip title={t('popup.table.sortOrder')} open={sortMenuOpen ? false : undefined}>
                  <Button className="oh-toolbar-secondary" type="text" size="small" icon={<SortAscendingOutlined />} />
                </Tooltip>
              </Dropdown>
            </div>
            <div className="oh-toolbar-secondary" style={{ textAlign: 'right', marginTop: 2 }}>
              <Text type="secondary" style={{ fontSize: '11px' }}>
                {searchText
                  ? t('popup.rules.matchedCount', { matched: filteredData.length, total: totalCount })
                  : t('shared.count.rules', { count: totalCount })}
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
                image={<RequestRulesIcon style={{ fontSize: 28, color: 'var(--text-tertiary)' }} />}
                description={
                  searchText ? (
                    <Text type="secondary">{t('popup.rules.emptyNoMatch')}</Text>
                  ) : (
                    <Space orientation="vertical" size={4}>
                      <Text type="secondary">{t('popup.rules.emptyNone')}</Text>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {t('popup.rules.emptyHint')}
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
      <AddRulePalette
        open={addRulePaletteOpen}
        onClose={() => setAddRulePaletteOpen(false)}
        onSelect={handlePaletteSelect}
      />
    </div>
  );
};

export default RulesTable;
