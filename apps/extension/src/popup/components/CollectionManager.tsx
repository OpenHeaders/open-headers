import {
  ApartmentOutlined,
  CheckOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  FolderTwoTone,
  PauseCircleOutlined,
  SortAscendingOutlined,
} from '@ant-design/icons';
import { useKeyboardNav } from '@context/KeyboardNavContext';
import { useRules } from '@hooks/useRules';
import type { V5 } from '@openheaders/core/types';
import { type ActionDetail, getActionDetail, isRuleComplete } from '@openheaders/core/utils';
import { App, Button, Dropdown, Empty, Input, Space, Switch, Table, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRowActionRegistration } from '@/hooks/useRowActionRegistration';
import { getBrowserAPI } from '@/types/browser';
import type { PageInfo, RowActions } from '../utils/table-shared';
import { renderActionDetails, renderDomainTags } from './columns/sharedColumnRenderers';

const { Text } = Typography;

// ── Tree table record ───────────────────────────────────────────

interface CollectionTreeRecord {
  key: string;
  uid: string;
  path: string;
  name: string;
  nodeType: 'collection' | 'folder' | 'rule';
  ruleType?: V5.RuleType;
  actionDetail?: ActionDetail;
  domains?: string[];
  isEnabled?: boolean;
  isComplete?: boolean;
  ruleCount?: number;
  enabledCount?: number;
  isPaused?: boolean;
  isAncestorPaused?: boolean;
  children?: CollectionTreeRecord[];
}

// ── Helpers ─────────────────────────────────────────────────────

function countRules(nodes: V5.TreeNode[]): { total: number; enabled: number } {
  let total = 0;
  let enabled = 0;
  for (const node of nodes) {
    if (node.type === 'rule') {
      total++;
      if (node.enabled) enabled++;
    } else if (node.type === 'folder') {
      const sub = countRules(node.children);
      total += sub.total;
      enabled += sub.enabled;
    }
  }
  return { total, enabled };
}

function treeNodesToRecords(
  nodes: V5.TreeNode[],
  rules: V5.Rule[],
  pausedGroups: ReadonlySet<string>,
  ancestorPaused: boolean,
): CollectionTreeRecord[] {
  return nodes.map((node) => {
    if (node.type === 'rule') {
      const rule = rules.find((r) => r.uid === node.uid);
      return {
        key: node.uid,
        uid: node.uid,
        path: node.path,
        name: node.name,
        nodeType: 'rule' as const,
        ruleType: node.ruleType,
        actionDetail: rule
          ? getActionDetail(rule)
          : { ruleType: node.ruleType, label: '', value: '', tooltip: '' },
        domains: rule?.domains ?? [],
        isEnabled: node.enabled,
        isComplete: rule ? isRuleComplete(rule) : true,
        isAncestorPaused: ancestorPaused,
      };
    }
    if (node.type === 'folder') {
      const { total, enabled } = countRules(node.children);
      const selfPaused = pausedGroups.has(node.path);
      const childrenPaused = ancestorPaused || selfPaused;
      const children = treeNodesToRecords(node.children, rules, pausedGroups, childrenPaused);
      return {
        key: node.uid,
        uid: node.uid,
        path: node.path,
        name: node.name,
        nodeType: 'folder' as const,
        ruleCount: total,
        enabledCount: enabled,
        isPaused: selfPaused,
        isAncestorPaused: ancestorPaused,
        children: children.length > 0 ? children : undefined,
      };
    }
    return {
      key: node.uid,
      uid: node.uid,
      path: node.path,
      name: node.name,
      nodeType: 'rule' as const,
      isAncestorPaused: ancestorPaused,
    };
  });
}

function collectionTreesToRecords(
  trees: V5.CollectionTree[],
  rules: V5.Rule[],
  pausedGroups: ReadonlySet<string>,
): CollectionTreeRecord[] {
  return trees.map((tree) => {
    const { total, enabled } = countRules(tree.tree);
    const selfPaused = pausedGroups.has(tree.path);
    const children = treeNodesToRecords(tree.tree, rules, pausedGroups, selfPaused);
    return {
      key: tree.uid,
      uid: tree.uid,
      path: tree.path,
      name: tree.name,
      nodeType: 'collection' as const,
      ruleCount: total,
      enabledCount: enabled,
      isPaused: selfPaused,
      isAncestorPaused: false,
      children: children.length > 0 ? children : undefined,
    };
  });
}

function filterTree(records: CollectionTreeRecord[], query: string): CollectionTreeRecord[] {
  const q = query.toLowerCase();
  return records
    .map((record) => {
      const nameMatch = record.name.toLowerCase().includes(q);
      if (record.children) {
        const filteredChildren = filterTree(record.children, query);
        if (nameMatch || filteredChildren.length > 0) {
          return { ...record, children: nameMatch ? record.children : filteredChildren };
        }
        return null;
      }
      if (nameMatch) return record;
      if (record.domains?.some((d) => d.toLowerCase().includes(q))) return record;
      if (record.ruleType?.toLowerCase().includes(q)) return record;
      return null;
    })
    .filter((r): r is CollectionTreeRecord => r !== null);
}

function countAllRulesInRecords(records: CollectionTreeRecord[]): number {
  let count = 0;
  for (const r of records) {
    if (r.nodeType === 'rule') count++;
    if (r.children) count += countAllRulesInRecords(r.children);
  }
  return count;
}

/** Collect all expandable keys from the tree. */
function collectAllKeys(records: CollectionTreeRecord[]): string[] {
  const keys: string[] = [];
  for (const r of records) {
    if (r.children) {
      keys.push(r.key);
      keys.push(...collectAllKeys(r.children));
    }
  }
  return keys;
}

/**
 * Flatten the tree into a list of all visible rows, respecting expanded state.
 * This matches exactly what Ant Design renders in the DOM.
 */
function flattenVisible(records: CollectionTreeRecord[], expandedSet: ReadonlySet<React.Key>): CollectionTreeRecord[] {
  const result: CollectionTreeRecord[] = [];
  for (const record of records) {
    result.push(record);
    if (record.children && expandedSet.has(record.key)) {
      result.push(...flattenVisible(record.children, expandedSet));
    }
  }
  return result;
}

function isEffectivelyPaused(record: CollectionTreeRecord): boolean {
  return !!(record.isPaused || record.isAncestorPaused);
}

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
  const { rules, isConnected, localCollectionTrees, pausedGroups, toggleGroupPause } = useRules();
  const { message } = App.useApp();
  const { setFocusedRowIndex } = useKeyboardNav();
  const [searchText, setSearchText] = useState('');
  const [sortMode, setSortMode] = useState<'status' | 'manual'>('status');
  const [expandedKeys, setExpandedKeys] = useState<readonly React.Key[]>([]);
  const expandInitialized = useRef(false);

  // Build tree records
  const treeRecords = useMemo(
    () => collectionTreesToRecords(localCollectionTrees, rules, pausedGroups),
    [localCollectionTrees, rules, pausedGroups],
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
      const rankA = a.isPaused ? 1 : 0;
      const rankB = b.isPaused ? 1 : 0;
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
        const isLocal = record.uid.startsWith('local-');
        const canToggle = isLocal || isConnected;
        if (!canToggle) return;
        import('../../utils/browser-api').then(({ runtime }) => {
          runtime.sendMessage(
            { type: 'toggleRule', ruleId: record.uid, enabled: !record.isEnabled },
            (response: unknown) => {
              if (!(response as { success?: boolean })?.success) message.error('Failed to toggle rule');
            },
          );
        });
      } else {
        toggleGroupPause(record.path);
      }
    },
    [isConnected, message, toggleGroupPause],
  );

  const handleVisualize = useCallback((record: CollectionTreeRecord) => {
    const url = getBrowserAPI().runtime.getURL(`workspace.html#/visualize/${record.uid}`);
    getBrowserAPI().tabs.create({ url });
  }, []);

  // Keyboard row actions — index into the flat visible list
  const handleToggleRow = useCallback(
    (index: number) => {
      const record = flatRowsRef.current[index];
      if (!record) return;
      handleToggle(record);
    },
    [handleToggle],
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
  });

  const totalRules = countAllRulesInRecords(treeRecords);

  const columns: ColumnsType<CollectionTreeRecord> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string, record: CollectionTreeRecord) => {
        const paused = isEffectivelyPaused(record);
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
          return renderActionDetails(record.actionDetail, isEffectivelyPaused(record) ? 0.5 : 1);
        }
        if (record.nodeType !== 'rule') {
          if (isEffectivelyPaused(record)) {
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
      title: 'Domains',
      key: 'domains',
      width: 100,
      render: (_: unknown, record: CollectionTreeRecord) => {
        if (record.nodeType === 'rule' && record.domains) {
          return renderDomainTags(record.domains, false);
        }
        return null;
      },
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      align: 'center',
      fixed: 'right',
      render: (_: unknown, record: CollectionTreeRecord) => {
        if (record.nodeType === 'rule') {
          const isLocal = record.uid.startsWith('local-');
          const canToggle = isLocal || isConnected;
          return (
            // biome-ignore lint/a11y/useKeyWithClickEvents: stops row expand on switch click
            // biome-ignore lint/a11y/noStaticElementInteractions: stops row expand on switch click
            <span onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <Switch
                size="small"
                checked={record.isEnabled}
                disabled={!canToggle}
                onChange={() => handleToggle(record)}
              />
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
                isEffectivelyPaused(record) && !record.isPaused
                  ? 'Parent is paused'
                  : record.isPaused
                    ? `Resume — all ${record.ruleCount} rules become active again`
                    : `Pause — suspend all ${record.ruleCount} rules without changing individual settings`
              }
            >
              <Switch
                checked={!isEffectivelyPaused(record)}
                disabled={record.isAncestorPaused && !record.isPaused}
                onChange={() => handleToggle(record)}
                checkedChildren="Active"
                unCheckedChildren="Paused"
              />
            </Tooltip>
            <Tooltip title="Visualize rules as flow">
              <Button
                type="text"
                size="small"
                icon={<ApartmentOutlined />}
                onClick={() => handleVisualize(record)}
                style={{ padding: '0 4px', height: 22, minWidth: 'auto' }}
              />
            </Tooltip>
          </span>
        );
      },
    },
  ];

  return (
    <div className="header-rules-section" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="table-toolbar">
        <div className="header-rules-title">
          <div>
            <Text style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Collections</Text>
            <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
              {localCollectionTrees.length} collection{localCollectionTrees.length !== 1 ? 's' : ''}, {totalRules} rule
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
                              Active collections → Paused collections
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
                              Original order
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
                {searchText
                  ? `${filteredRecords.length} of ${treeRecords.length} collection${treeRecords.length !== 1 ? 's' : ''} matched`
                  : `${totalRules} rule${totalRules !== 1 ? 's' : ''}`}
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
            const paused = isEffectivelyPaused(record);
            if (paused) classes.push('row-group-paused');
            if (record.nodeType === 'rule' && !record.isComplete && !paused) classes.push('row-draft');
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
                    <Text type="secondary">No matching collections found</Text>
                  ) : (
                    <Space direction="vertical" size={4}>
                      <Text type="secondary">No collections</Text>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        Create rules in the workspace editor to organize them into collections
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
