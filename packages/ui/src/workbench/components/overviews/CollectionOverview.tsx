/**
 * CollectionOverview — shown when a collection tab is active.
 *
 * Displays: description, stats bar (workbench/active/draft/paused counts),
 * contents table (direct children), and quick action buttons.
 */

import {
  FolderOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { VariablesIcon } from '@openheaders/ui/shared/icons';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import type { TreeNode } from '@openheaders/core/types';
import { isRuleComplete, isRuleDraft, resolvePauseState } from '@openheaders/core/utils';
import { Button, Dropdown, Empty, Space, Table, Tag, Tooltip, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { buildRuleTypeMenuItems } from '../../rule-type-menu';
import { buildRuleIcon } from '../shared/rule-icon';

interface CollectionOverviewProps {
  collectionUid: string;
  onSelectRule: (uid: string) => void;
  onCreateRule: (type: string, context: { collectionId: string; folderPath?: string }) => void;
  onOpenFolderOverview: (uid: string, name: string) => void;
  /** Open the bottom panel and focus the Test Runs tab scoped to this collection. */
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
  onOpenCollectionVariables,
}) => {
  const { token } = theme.useToken();
  const t = useT();
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
                {t('workbench.overview.cell.folderRules', { count: row.childCount ?? 0 })}
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
          if (row.draft) return <Tag color="default">{t('workbench.overview.status.draft')}</Tag>;
          if (!row.complete) return <Tag color="default">{t('workbench.overview.status.incomplete')}</Tag>;
          if (!row.enabled) return <Tag color="default">{t('workbench.overview.status.disabled')}</Tag>;
          if (row.effectivelyPaused) return <Tag color="warning">{t('workbench.overview.status.paused')}</Tag>;
          return <Tag color="success">{t('workbench.overview.status.active')}</Tag>;
        },
      },
    ],
    [token, rules, t],
  );

  const addRuleMenuItems = buildRuleTypeMenuItems((type) => onCreateRule(type, { collectionId: collectionUid }), t);

  if (!collection) {
    return (
      <div style={{ padding: '24px 32px' }}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('workbench.overview.empty.collectionNotFound')} />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 720, overflowY: 'auto', overscrollBehavior: 'none', height: '100%' }}>
      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: token.colorTextSecondary }}>
          {t('workbench.overview.stats.rules', { count: stats.total })}
          {stats.folders > 0 && (
            <>
              {' '}
              {t('workbench.overview.stats.foldersSuffix', { count: stats.folders })}
            </>
          )}
        </span>
        {stats.active > 0 && <Tag color="success">{t('workbench.overview.stats.activeTag', { count: stats.active })}</Tag>}
        {stats.disabled > 0 && (
          <Tag color="default">{t('workbench.overview.stats.disabledTag', { count: stats.disabled })}</Tag>
        )}
        {stats.draft > 0 && <Tag color="default">{t('workbench.overview.stats.draftTag', { count: stats.draft })}</Tag>}
        {isPaused && <Tag color="warning">{t('workbench.overview.stats.pausedTag')}</Tag>}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <Dropdown menu={{ items: addRuleMenuItems }} trigger={['click']}>
          <Button size="small" icon={<PlusOutlined />}>
            {t('workbench.overview.action.addRule')}
          </Button>
        </Dropdown>
        <Tooltip
          title={
            isPaused
              ? t('workbench.overview.action.resumeCollectionTooltip')
              : t('workbench.overview.action.pauseCollectionTooltip')
          }
        >
          <Button
            size="small"
            icon={isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
            onClick={() => togglePause(collection.path)}
          >
            {isPaused ? t('workbench.overview.action.resume') : t('workbench.overview.action.pause')}
          </Button>
        </Tooltip>
        {onOpenCollectionVariables && (
          <Tooltip title={t('workbench.overview.action.variablesTooltip')}>
            <Button
              size="small"
              icon={<VariablesIcon />}
              onClick={() => onOpenCollectionVariables(collectionUid, collection.name)}
            >
              {t('workbench.overview.action.variables')}
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
            {t('workbench.overview.caption.description')}
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
        {t('workbench.overview.caption.contents')}
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
        <Empty
          description={t('workbench.overview.empty.noItems')}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ margin: '24px 0' }}
        >
          <Dropdown menu={{ items: addRuleMenuItems }} trigger={['click']}>
            <Button size="small" icon={<PlusOutlined />}>
              {t('workbench.overview.action.addRule')}
            </Button>
          </Dropdown>
        </Empty>
      )}
    </div>
  );
};

export default CollectionOverview;
