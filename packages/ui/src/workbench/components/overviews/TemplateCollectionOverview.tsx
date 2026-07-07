/**
 * TemplateCollectionOverview — overview tab for a template collection.
 *
 * Templates are the reusable rule scaffolds users save via "Save as
 * template" from the rule editor; they're not directly creatable from
 * an overview surface. This view therefore has no Add action — its
 * job is to surface the contents (so users can browse + open
 * templates) and the Variables opener (so per-collection template
 * variables can be edited matching session 48 + 49's pipeline).
 */

import { FolderOutlined } from '@ant-design/icons';
import { VariablesIcon } from '@openheaders/ui/shared/icons';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import type { RuleType, TreeNode } from '@openheaders/core/types';
import { Button, Empty, Space, Table, Tag, Tooltip, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import CollectionOverviewShell from './CollectionOverviewShell';

interface TemplateCollectionOverviewProps {
  collectionUid: string;
  onSelectTemplate: (uid: string) => void;
  onOpenFolderOverview: (uid: string, name: string) => void;
  onOpenCollectionVariables?: (uid: string, name: string) => void;
}

interface ContentRow {
  key: string;
  uid: string;
  name: string;
  kind: 'folder' | 'template';
  ruleType?: RuleType;
  childCount?: number;
}

function countTemplatesDeep(nodes: TreeNode[]): number {
  let count = 0;
  for (const n of nodes) {
    if (n.type === 'template') count++;
    else if (n.type === 'folder') count += countTemplatesDeep(n.children);
  }
  return count;
}

function countFoldersDeep(nodes: TreeNode[]): number {
  let count = 0;
  for (const n of nodes) {
    if (n.type === 'folder') {
      count++;
      count += countFoldersDeep(n.children);
    }
  }
  return count;
}

const TemplateCollectionOverview: React.FC<TemplateCollectionOverviewProps> = ({
  collectionUid,
  onSelectTemplate,
  onOpenFolderOverview,
  onOpenCollectionVariables,
}) => {
  const { token } = theme.useToken();
  const { templateCollectionTrees } = useRules();

  const collection = useMemo(
    () => templateCollectionTrees.find((c) => c.uid === collectionUid),
    [templateCollectionTrees, collectionUid],
  );

  const stats = useMemo(() => {
    if (!collection) return { templates: 0, folders: 0 };
    return {
      templates: countTemplatesDeep(collection.tree),
      folders: countFoldersDeep(collection.tree),
    };
  }, [collection]);

  const rows = useMemo((): ContentRow[] => {
    if (!collection) return [];
    return collection.tree.map((node): ContentRow => {
      if (node.type === 'folder') {
        return {
          key: node.uid,
          uid: node.uid,
          name: node.name,
          kind: 'folder',
          childCount: countTemplatesDeep(node.children),
        };
      }
      if (node.type !== 'template') return { key: node.uid, uid: node.uid, name: node.name, kind: 'folder' };
      return {
        key: node.uid,
        uid: node.uid,
        name: node.name,
        kind: 'template',
        ruleType: node.ruleType,
      };
    });
  }, [collection]);

  const handleRowClick = useCallback(
    (row: ContentRow) => {
      if (row.kind === 'template') onSelectTemplate(row.uid);
      else onOpenFolderOverview(row.uid, row.name);
    },
    [onSelectTemplate, onOpenFolderOverview],
  );

  const columns: ColumnsType<ContentRow> = useMemo(
    () => [
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        render: (_: unknown, row: ContentRow) => (
          <Space size={6}>
            {row.kind === 'folder' ? <FolderOutlined style={{ color: token.colorTextTertiary }} /> : null}
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
                Folder · {row.childCount} template{row.childCount !== 1 ? 's' : ''}
              </span>
            );
          }
          if (!row.ruleType) return null;
          return <Tag style={{ fontSize: 11, margin: 0 }}>{row.ruleType}</Tag>;
        },
      },
    ],
    [token],
  );

  if (!collection) {
    return (
      <CollectionOverviewShell
        statsBar={null}
        actions={null}
        contents={null}
        notFound
        notFoundLabel="Template collection not found"
      />
    );
  }

  const statsBar = (
    <span style={{ fontSize: 13, color: token.colorTextSecondary }}>
      {stats.templates} template{stats.templates !== 1 ? 's' : ''}
      {stats.folders > 0 && (
        <>
          {' '}
          · {stats.folders} folder{stats.folders !== 1 ? 's' : ''}
        </>
      )}
    </span>
  );

  const actions = onOpenCollectionVariables ? (
    <Tooltip title="Edit variables scoped to this template collection">
      <Button
        size="small"
        icon={<VariablesIcon />}
        onClick={() => onOpenCollectionVariables(collectionUid, collection.name)}
      >
        Variables
      </Button>
    </Tooltip>
  ) : null;

  const contents =
    rows.length > 0 ? (
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
      />
    ) : (
      <Empty
        description="No templates in this collection. Save a rule as a template to populate this collection."
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        style={{ margin: '24px 0' }}
      />
    );

  return (
    <CollectionOverviewShell
      statsBar={statsBar}
      actions={actions}
      description={collection.description ?? null}
      contents={contents}
    />
  );
};

export default TemplateCollectionOverview;
