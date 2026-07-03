import { CheckOutlined, FolderTwoTone, SortAscendingOutlined } from '@ant-design/icons';
import type { FolderNode, TreeNode } from '@openheaders/core/types';
import { useRowActionRegistration } from '@openheaders/ui/shared/hooks/useRowActionRegistration';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/useRules';
import { useVariableResolver } from '@openheaders/ui/shared/hooks/useVariableResolver';
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
import TestRunModal, { type TestRunOwnerType } from './TestRunModal';

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
          if (!resp.ok) message.error('Failed to toggle rule');
        });
      } else {
        togglePause(record.path);
      }
    },
    [message, ruleMutator, togglePause],
  );

  const handleVisualize = useCallback(
    (record: CollectionTreeRecord) => {
      // Visualize the collection's rules as a flow diagram in the
      // workspace. `folder` records aren't supported as top-level
      // flow scopes today (the flow view expects a collection root);
      // the rule-flow view will scope to the collection ancestor if
      // a folder uid lands on this path — same fallback the workspace
      // already applies for tree-nodes above leaf rules.
      const scope = record.nodeType === 'folder' ? 'folder' : 'collection';
      void openWorkspace({ kind: 'open-rule-flow', scope, entityId: record.uid }, surface.mode);
    },
    [surface.mode],
  );

  // ── Test session launcher ──
  // Walks the collection/folder subtree and collects all rule uids under it,
  // then opens the TestRunModal scoped to that snapshot.
  const [testState, setTestState] = useState<{
    open: boolean;
    ownerType: TestRunOwnerType;
    ownerId: string;
    scopeLabel: string;
    ruleUids: string[];
  }>({ open: false, ownerType: 'collection', ownerId: '', scopeLabel: '', ruleUids: [] });

  const collectRuleUidsUnder = useCallback(
    (record: CollectionTreeRecord): string[] => {
      // Walk the live trees to find this node and collect every rule under it,
      // not the CollectionTreeRecord (which may be filtered by the search box).
      const uids: string[] = [];
      const walk = (nodes: TreeNode[]) => {
        for (const n of nodes) {
          if (n.type === 'rule') uids.push(n.uid);
          else if (n.type === 'folder') walk(n.children);
        }
      };
      for (const tree of localCollectionTrees) {
        if (tree.uid === record.uid) {
          walk(tree.tree);
          return uids;
        }
        // Recursively search for a folder with this uid
        const findFolder = (nodes: TreeNode[]): FolderNode | null => {
          for (const n of nodes) {
            if (n.type === 'folder') {
              if (n.uid === record.uid) return n;
              const found = findFolder(n.children);
              if (found) return found;
            }
          }
          return null;
        };
        const folder = findFolder(tree.tree);
        if (folder) {
          walk(folder.children);
          return uids;
        }
      }
      return uids;
    },
    [localCollectionTrees],
  );

  const handleTest = useCallback(
    (record: CollectionTreeRecord) => {
      // Per-rule rows test only that rule; folder/collection rows walk
      // the subtree and test every rule under them. Owner stamping
      // routes the resulting session into the right bucket so the
      // workspace bottom panel surfaces it under the matching entity.
      if (record.nodeType === 'rule') {
        setTestState({
          open: true,
          ownerType: 'rule',
          ownerId: record.uid,
          scopeLabel: record.name,
          ruleUids: [record.uid],
        });
        return;
      }
      const ruleUids = collectRuleUidsUnder(record);
      if (ruleUids.length === 0) {
        message.info('This group has no rules to test');
        return;
      }
      setTestState({
        open: true,
        ownerType: record.nodeType === 'collection' ? 'collection' : 'folder',
        ownerId: record.uid,
        scopeLabel: record.name,
        ruleUids,
      });
    },
    [collectRuleUidsUnder, message],
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
    handleTest,
    handleVisualize,
  });

  return (
    <div className="header-rules-section" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="table-toolbar">
        <div className="header-rules-title">
          <div>
            <Text style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Collections</Text>
            <Text className="oh-toolbar-status" type="secondary" style={{ fontSize: '11px', display: 'block' }}>
              {localCollectionTrees.length} collection{localCollectionTrees.length !== 1 ? 's' : ''}, {totalRules} rule
              {totalRules !== 1 ? 's' : ''}
            </Text>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', height: 36 }}>
              <Input.Search
                className="oh-search oh-toolbar-secondary"
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
                              Active → Paused · A-Z within each
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
                            <div>Workspace order</div>
                            <Text type="secondary" style={{ fontSize: '11px' }}>
                              Matches the workspace sidebar tree order
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
                  <Button className="oh-toolbar-secondary" type="text" size="small" icon={<SortAscendingOutlined />} />
                </Tooltip>
              </Dropdown>
            </div>
            <div className="oh-toolbar-secondary" style={{ textAlign: 'right', marginTop: 2 }}>
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
      <TestRunModal
        open={testState.open}
        onClose={() => setTestState((s) => ({ ...s, open: false }))}
        ownerType={testState.ownerType}
        ownerId={testState.ownerId}
        scopeLabel={testState.scopeLabel}
        ruleUids={testState.ruleUids}
        allRules={rules}
      />
    </div>
  );
};

export default CollectionManager;
