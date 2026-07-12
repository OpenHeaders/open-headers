import { CheckOutlined, FolderTwoTone, SortAscendingOutlined } from '@ant-design/icons';
import type { FolderNode, TreeNode } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useRowActionRegistration } from '@openheaders/ui/shared/hooks/dom/useRowActionRegistration';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { useVariableResolver } from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import { useSurface } from '@openheaders/ui/shared/surface';
import type { PageInfo, RowActions } from '@openheaders/ui/shared/table-shared';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { App, Button, Dropdown, Empty, Input, Space, Table, Tooltip, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useKeyboardNav } from '../shortcuts/KeyboardNavContext';
import { usePopupShortcutLabel } from '../shortcuts/popup-shortcuts';
import { buildCollectionManagerColumns } from './collection-manager-columns';
import {
  collectAllKeys,
  type CollectionTreeRecord,
  collectionTreesToRecords,
  countAllRulesInRecords,
  filterTree,
  flattenVisible,
} from './collection-tree-records';

const { Text } = Typography;

// ── Component ───────────────────────────────────────────────────

interface CollectionManagerProps {
  isActive?: boolean;
  focusedRowIndex?: number;
  pendingDeleteIndex?: number;
  onPageInfoChange?: (info: PageInfo) => void;
  onRowActionsChange?: (actions: RowActions) => void;
}

const CollectionManager: React.FC<CollectionManagerProps> = ({
  focusedRowIndex = -1,
  pendingDeleteIndex = -1,
  onPageInfoChange,
  onRowActionsChange,
}) => {
  const { rules, activeWorkspaceId, localCollectionTrees, pauseMarkers, togglePause } = useRules();
  const ruleMutator = useRuleMutator({ workspaceId: activeWorkspaceId, surfaceId: 'popup' });
  const { message } = App.useApp();
  const t = useT();
  const surface = useSurface();
  const { setFocusedRowIndex } = useKeyboardNav();
  const togglePauseFocusedLabel = usePopupShortcutLabel('toggle-pause-focused');
  const [searchText, setSearchText] = useState('');
  const [sortMode, setSortMode] = useState<'status' | 'manual'>('status');
  const [expandedKeys, setExpandedKeys] = useState<readonly React.Key[]>([]);
  const expandInitialized = useRef(false);

  // Resolve `{{var}}` templates so the row's display reflects what
  // reaches the wire. The resolver instance from `useVariableResolver`
  // is memoized internally — only changes when variable scope changes.
  const resolver = useVariableResolver();

  // Build tree records
  const treeRecords = useMemo(
    () => collectionTreesToRecords(localCollectionTrees, rules, pauseMarkers, resolver),
    [localCollectionTrees, rules, pauseMarkers, resolver],
  );

  // Auto-expand all on first load
  useEffect(() => {
    if (!expandInitialized.current && treeRecords.length > 0) {
      expandInitialized.current = true;
      setExpandedKeys(collectAllKeys(treeRecords));
    }
  }, [treeRecords]);

  // Filter
  const filteredRecords = useMemo(() => {
    if (!searchText) return treeRecords;
    return filterTree(treeRecords, searchText);
  }, [treeRecords, searchText]);

  // Sort top-level
  const sortedRecords = useMemo(() => {
    if (sortMode !== 'status') return filteredRecords;
    return [...filteredRecords].sort((a, b) => {
      const rankA = a.effectivelyPaused ? 1 : 0;
      const rankB = b.effectivelyPaused ? 1 : 0;
      return rankA - rankB || a.name.localeCompare(b.name);
    });
  }, [filteredRecords, sortMode]);

  // Flatten visible rows (what Ant Design actually renders in the DOM)
  const expandedSet = useMemo(() => new Set(expandedKeys), [expandedKeys]);
  const flatRows = useMemo(() => flattenVisible(sortedRecords, expandedSet), [sortedRecords, expandedSet]);

  // Keep a ref for callbacks
  const flatRowsRef = useRef<CollectionTreeRecord[]>([]);
  flatRowsRef.current = flatRows;

  // Report flat visible rows to keyboard nav system
  useEffect(() => {
    if (!onPageInfoChange) return;
    onPageInfoChange({
      visibleRowCount: flatRows.length,
      visibleRowIds: flatRows.map((r) => r.key),
      hasNextPage: false,
      hasPrevPage: false,
    });
  }, [onPageInfoChange, flatRows]);

  const handleToggle = useCallback(
    (record: CollectionTreeRecord) => {
      if (record.nodeType === 'rule') {
        void ruleMutator.toggleRule(record.uid, !record.isEnabled).then((resp) => {
          if (!resp.ok) message.error(t('popup.rule.toggleFailed'));
        });
      } else {
        togglePause(record.path);
      }
    },
    [message, ruleMutator, togglePause, t],
  );

  // Keyboard row actions — index into the flat visible list
  const handleToggleRow = useCallback(
    (index: number) => {
      const record = flatRowsRef.current[index];
      if (!record) return;
      handleToggle(record);
    },
    [handleToggle],
  );

  // Row-scoped pause — keyed off the `toggle-pause-focused` shortcut
  // (default `p`). Only folder and collection rows have a pause state;
  // individual rule rows have an `enabled` flag instead and are
  // toggled via Space (`handleToggle`). Pressing `p` on a rule row is
  // an explicit no-op so the key never accidentally flips an
  // unrelated state. Global "pause every rule everywhere" lives on
  // the separate `shift+p` shortcut.
  const handlePauseRow = useCallback(
    (index: number) => {
      const record = flatRowsRef.current[index];
      if (!record) return;
      if (record.nodeType === 'rule') return;
      togglePause(record.path);
    },
    [togglePause],
  );

  const handleExpandRow = useCallback((index: number) => {
    const record = flatRowsRef.current[index];
    if (!record?.children) return;
    setExpandedKeys((prev) => {
      if (prev.includes(record.key)) return prev;
      return [...prev, record.key];
    });
  }, []);

  const handleCollapseRow = useCallback(
    (index: number) => {
      const record = flatRowsRef.current[index];
      if (!record) return;
      if (record.children && expandedKeys.includes(record.key)) {
        setExpandedKeys((prev) => prev.filter((k) => k !== record.key));
      } else {
        const flat = flatRowsRef.current;
        for (let i = index - 1; i >= 0; i--) {
          if (flat[i].children) {
            setFocusedRowIndex(i);
            break;
          }
        }
      }
    },
    [expandedKeys, setFocusedRowIndex],
  );

  useRowActionRegistration(onRowActionsChange, {
    onToggleRow: handleToggleRow,
    onExpandRow: handleExpandRow,
    onCollapseRow: handleCollapseRow,
    onPauseRow: handlePauseRow,
  });

  const totalRules = countAllRulesInRecords(treeRecords);

  const columns = buildCollectionManagerColumns({
    togglePauseFocusedLabel,
    handleToggle,
    t,
  });

  return (
    <div className="header-rules-section" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="table-toolbar">
        <div className="header-rules-title">
          <div>
            <Text style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {t('popup.collections.title')}
            </Text>
            <Text className="oh-toolbar-status" type="secondary" style={{ fontSize: '11px', display: 'block' }}>
              {t('popup.collections.summary', { collections: localCollectionTrees.length, rules: totalRules })}
            </Text>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', height: 36 }}>
              <Input.Search
                className="oh-search oh-toolbar-secondary"
                placeholder={t('popup.table.searchPlaceholder')}
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
                          {t('popup.table.sortOrderHeading')}
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
                            <div>{t('popup.table.sortByStatus')}</div>
                            <Text type="secondary" style={{ fontSize: '11px' }}>
                              {t('popup.table.sortByStatusHintCollections')}
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
                            <div>{t('popup.table.sortWorkspaceOrder')}</div>
                            <Text type="secondary" style={{ fontSize: '11px' }}>
                              {t('popup.table.sortWorkspaceOrderHint')}
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
                <Tooltip title={t('popup.table.sortOrder')}>
                  <Button className="oh-toolbar-secondary" type="text" size="small" icon={<SortAscendingOutlined />} />
                </Tooltip>
              </Dropdown>
            </div>
            <div className="oh-toolbar-secondary" style={{ textAlign: 'right', marginTop: 2 }}>
              <Text type="secondary" style={{ fontSize: '11px' }}>
                {searchText
                  ? t('popup.collections.matchedCount', { matched: filteredRecords.length, total: treeRecords.length })
                  : t('shared.count.rules', { count: totalRules })}
              </Text>
            </div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, paddingBottom: '8px' }}>
        <Table<CollectionTreeRecord>
          dataSource={sortedRecords}
          columns={columns}
          pagination={false}
          size="small"
          scroll={{ x: 570, y: 290 }}
          indentSize={16}
          expandable={{
            expandedRowKeys: expandedKeys as React.Key[],
            onExpandedRowsChange: (keys) => setExpandedKeys(keys as readonly React.Key[]),
          }}
          onRow={(record: CollectionTreeRecord) => ({
            onClick: () => {
              // Map record to flat index
              const flatIndex = flatRowsRef.current.findIndex((r) => r.key === record.key);
              if (flatIndex >= 0) {
                setFocusedRowIndex(flatIndex);
                (document.activeElement as HTMLElement)?.blur();
              }
            },
          })}
          rowClassName={(record: CollectionTreeRecord) => {
            const classes: string[] = [];
            const paused = record.effectivelyPaused;
            if (paused) classes.push('row-group-paused');
            if (record.nodeType === 'rule' && record.isDraft === true && !paused) classes.push('row-draft');
            if (record.nodeType === 'rule' && !record.isEnabled && record.isComplete && !paused)
              classes.push('row-disabled');
            // Find flat index for keyboard highlight
            const flatIndex = flatRowsRef.current.findIndex((r) => r.key === record.key);
            if (flatIndex === focusedRowIndex) classes.push('keyboard-focused-row');
            if (flatIndex === pendingDeleteIndex) classes.push('keyboard-pending-delete-row');
            return classes.join(' ');
          }}
          locale={{
            emptyText: (
              <Empty
                image={<FolderTwoTone style={{ fontSize: 28 }} />}
                description={
                  searchText ? (
                    <Text type="secondary">{t('popup.collections.emptyNoMatch')}</Text>
                  ) : (
                    <Space direction="vertical" size={4}>
                      <Text type="secondary">{t('popup.collections.emptyNone')}</Text>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {t('popup.collections.emptyHint')}
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

export default CollectionManager;
