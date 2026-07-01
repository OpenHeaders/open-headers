/**
 * CollectionOverview — shown when a collection tab is active.
 *
 * Displays: description, stats bar (workbench/active/draft/paused counts),
 * contents table (direct children), and quick action buttons.
 */

import {
  ApartmentOutlined,
  CodeOutlined,
  ExperimentOutlined,
  FolderOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useRules } from '@openheaders/ui/shared/hooks/useRules';
import type { TreeNode } from '@openheaders/core/types';
import { isRuleComplete, isRuleDraft, resolvePauseState } from '@openheaders/core/utils';
import { Button, Dropdown, Empty, Space, Table, Tag, Tooltip, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import { buildRuleTypeMenuItems } from '../../rule-type-menu';
import { buildRuleIcon } from '../shared/rule-icon';

interface CollectionOverviewProps {
  collectionUid: string;
  onSelectRule: (uid: string) => void;
  onCreateRule: (type: string, context: { collectionId: string; folderPath?: string }) => void;
  onOpenFolderOverview: (uid: string, name: string) => void;
  onOpenRuleFlow?: (scope: 'collection' | 'folder', entityId: string, label: string) => void;
  /** Open the bottom panel and focus the Test Runs tab scoped to this collection. */
  onOpenTestRuns?: () => void;
  /** Open the collection-scoped variables editor tab. */
  onOpenCollectionVariables?: (uid: string, name: string) => void;
}

interface ContentRow {
  key: string;
  uid: string;
  name: string;
  kind: 'folder' | 'rule';
  ruleType?: string;
  enabled?: boolean;
  complete?: boolean;
  /** True for unpublished rules — derived from `isRuleDraft`. Drives
   *  the gray "Draft" status tag + `row-draft` styling (publication
   *  gate, distinct from `complete`'s data-shape signal). */
  draft?: boolean;
  childCount?: number;
  /** Effective pause state for this specific row, after marker resolution. */
  effectivelyPaused: boolean;
}

function countRulesDeep(nodes: TreeNode[]): number {
  let count = 0;
  for (const n of nodes) {
    if (n.type === 'rule') count++;
    else if (n.type === 'folder') count += countRulesDeep(n.children);
  }
  return count;
}

const CollectionOverview: React.FC<CollectionOverviewProps> = ({
  collectionUid,
  onSelectRule,
  onCreateRule,
  onOpenFolderOverview,
  onOpenRuleFlow,
  onOpenTestRuns,
  onOpenCollectionVariables,
}) => {
  const { token } = theme.useToken();
  const { rules, localCollectionTrees, pauseMarkers, togglePause } = useRules();

  const collection = useMemo(
    () => localCollectionTrees.find((c) => c.uid === collectionUid),
    [localCollectionTrees, collectionUid],
  );

  // ── Stats ──────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (!collection) return { total: 0, folders: 0, active: 0, disabled: 0, draft: 0, paused: 0 };
    let total = 0;
    let folders = 0;
    let active = 0;
    let disabled = 0;
    let draft = 0;

    const walk = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        if (n.type === 'folder') {
          folders++;
          walk(n.children);
        } else if (n.type === 'rule') {
          total++;
          const fullRule = rules.find((r) => r.uid === n.uid);
          if (fullRule && isRuleDraft(fullRule)) draft++;
          else if (fullRule && !isRuleComplete(fullRule)) draft++;
          else if (!n.enabled) disabled++;
          else active++;
        }
      }
    };
    walk(collection.tree);

    const isPaused = resolvePauseState(collection.path, pauseMarkers);
    return { total, folders, active, disabled, draft, paused: isPaused ? active : 0 };
  }, [collection, rules, pauseMarkers]);

  const isPaused = collection ? resolvePauseState(collection.path, pauseMarkers) : false;

  // ── Contents table ─────────────────────────────────────────────

  const rows = useMemo((): ContentRow[] => {
    if (!collection) return [];
    return collection.tree.map((node): ContentRow => {
      const rowPaused = resolvePauseState(node.path, pauseMarkers);
      if (node.type === 'folder') {
        return {
          key: node.uid,
          uid: node.uid,
          name: node.name,
          kind: 'folder',
          childCount: countRulesDeep(node.children),
          effectivelyPaused: rowPaused,
        };
      }
      const fullRule = rules.find((r) => r.uid === node.uid);
      return {
        key: node.uid,
        uid: node.uid,
        name: node.name,
        kind: 'rule',
        ruleType: node.type === 'rule' ? node.ruleType : undefined,
        enabled: node.type === 'rule' ? node.enabled : undefined,
        complete: fullRule ? isRuleComplete(fullRule) : true,
        draft: fullRule ? isRuleDraft(fullRule) : false,
        effectivelyPaused: rowPaused,
      };
    });
  }, [collection, rules, pauseMarkers]);

  const handleRowClick = useCallback(
    (row: ContentRow) => {
      if (row.kind === 'rule') onSelectRule(row.uid);
      else onOpenFolderOverview(row.uid, row.name);
    },
    [onSelectRule, onOpenFolderOverview],
  );

  const columns: ColumnsType<ContentRow> = useMemo(
    () => [
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        render: (_: unknown, row: ContentRow) => (
          <Space size={6}>
            {row.kind === 'folder' ? (
              <FolderOutlined
                style={{
                  color: row.effectivelyPaused ? 'var(--ant-color-warning, #faad14)' : token.colorTextTertiary,
                }}
              />
            ) : (
              buildRuleIcon({
                ruleType: row.ruleType ?? 'header',
                rule: rules.find((r) => r.uid === row.uid),
                isActive:
                  (row.enabled ?? false) && (row.complete ?? false) && !(row.draft ?? false) && !row.effectivelyPaused,
                paused: row.effectivelyPaused,
              })
            )}
            <span>{row.name}</span>
          </Space>
        ),
      },
      {
        title: 'Type',
        key: 'type',
        width: 120,
        render: (_: unknown, row: ContentRow) => {
          if (row.kind === 'folder') {
            return (
              <span style={{ color: token.colorTextTertiary, fontSize: 12 }}>
                Folder · {row.childCount} rule{row.childCount !== 1 ? 's' : ''}
              </span>
            );
          }
          return <Tag style={{ fontSize: 11, margin: 0 }}>{row.ruleType}</Tag>;
        },
      },
      {
        title: 'Status',
        key: 'status',
        width: 90,
        render: (_: unknown, row: ContentRow) => {
          if (row.kind === 'folder') return null;
          if (row.draft) return <Tag color="default">Draft</Tag>;
          if (!row.complete) return <Tag color="default">Incomplete</Tag>;
          if (!row.enabled) return <Tag color="default">Disabled</Tag>;
          if (row.effectivelyPaused) return <Tag color="warning">Paused</Tag>;
          return <Tag color="success">Active</Tag>;
        },
      },
    ],
    [token, rules],
  );

  const addRuleMenuItems = buildRuleTypeMenuItems((type) => onCreateRule(type, { collectionId: collectionUid }));

  if (!collection) {
    return (
      <div style={{ padding: '24px 32px' }}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Collection not found" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 720, overflowY: 'auto', height: '100%' }}>
      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: token.colorTextSecondary }}>
          {stats.total} rule{stats.total !== 1 ? 's' : ''}
          {stats.folders > 0 && (
            <>
              {' '}
              · {stats.folders} folder{stats.folders !== 1 ? 's' : ''}
            </>
          )}
        </span>
        {stats.active > 0 && <Tag color="success">{stats.active} active</Tag>}
        {stats.disabled > 0 && <Tag color="default">{stats.disabled} disabled</Tag>}
        {stats.draft > 0 && <Tag color="default">{stats.draft} draft</Tag>}
        {isPaused && <Tag color="warning">Paused</Tag>}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <Dropdown menu={{ items: addRuleMenuItems }} trigger={['click']}>
          <Button size="small" icon={<PlusOutlined />}>
            Add Rule
          </Button>
        </Dropdown>
        <Tooltip title={isPaused ? 'Resume all rules in this collection' : 'Pause all rules in this collection'}>
          <Button
            size="small"
            icon={isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
            onClick={() => togglePause(collection.path)}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </Button>
        </Tooltip>
        {onOpenRuleFlow && (
          <Button
            size="small"
            icon={<ApartmentOutlined />}
            onClick={() => onOpenRuleFlow('collection', collectionUid, collection.name)}
          >
            View Execution Flow
          </Button>
        )}
        {onOpenTestRuns && (
          <Tooltip title="Show past test runs captured for this collection in the bottom panel">
            <Button size="small" icon={<ExperimentOutlined />} onClick={onOpenTestRuns}>
              Test Runs
            </Button>
          </Tooltip>
        )}
        {onOpenCollectionVariables && (
          <Tooltip title="Edit variables scoped to this collection">
            <Button
              size="small"
              icon={<CodeOutlined />}
              onClick={() => onOpenCollectionVariables(collectionUid, collection.name)}
            >
              Variables
            </Button>
          </Tooltip>
        )}
      </div>

      {/* Description */}
      {collection.description && (
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: token.colorTextTertiary,
              marginBottom: 4,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Description
          </div>
          <div style={{ fontSize: 13, color: token.colorTextSecondary, lineHeight: 1.6 }}>{collection.description}</div>
        </div>
      )}

      {/* Contents */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: token.colorTextTertiary,
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        Contents
      </div>
      {rows.length > 0 ? (
        <Table<ContentRow>
          dataSource={rows}
          columns={columns}
          size="small"
          pagination={false}
          showHeader={false}
          onRow={(row) => ({
            onClick: () => handleRowClick(row),
            style: { cursor: 'pointer' },
          })}
          rowClassName={(row) => {
            if (row.kind === 'rule' && row.draft) return 'row-draft';
            if (row.kind === 'rule' && !row.enabled) return 'row-disabled';
            return '';
          }}
        />
      ) : (
        <Empty description="No items yet" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '24px 0' }}>
          <Dropdown menu={{ items: addRuleMenuItems }} trigger={['click']}>
            <Button size="small" icon={<PlusOutlined />}>
              Add Rule
            </Button>
          </Dropdown>
        </Empty>
      )}
    </div>
  );
};

export default CollectionOverview;
