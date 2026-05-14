/**
 * TemplateFolderOverview — overview tab for a folder inside a template
 * collection. Companion to {@link TemplateCollectionOverview}; mirrors
 * the rule-family {@link FolderOverview} shape but scoped to templates.
 *
 *   - Stats: descendant template count + subfolder count.
 *   - Actions: none — templates are auto-created via "Save as template"
 *     from the rule editor. The empty-state copy explains the indirect
 *     creation path so users don't expect an Add button.
 *   - Contents: top-level children (folders + templates) with a
 *     `ruleType` tag column.
 */

import { FileTextOutlined, FolderOutlined } from '@ant-design/icons';
import { useRules } from '@openheaders/ui/shared/hooks/useRules';
import type { CollectionTree, FolderNode, RuleType, TreeNode } from '@openheaders/core/types';
import { Empty, Space, Table, Tag, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import CollectionOverviewShell from './CollectionOverviewShell';

interface TemplateFolderOverviewProps {
  folderUid: string;
  onSelectTemplate: (uid: string) => void;
  onOpenFolderOverview: (uid: string, name: string) => void;
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

function findFolder(trees: readonly CollectionTree[], uid: string): FolderNode | null {
  for (const col of trees) {
    const walk = (nodes: TreeNode[]): FolderNode | null => {
      for (const n of nodes) {
        if (n.type !== 'folder') continue;
        if (n.uid === uid) return n;
        const found = walk(n.children);
        if (found) return found;
      }
      return null;
    };
    const folder = walk(col.tree);
    if (folder) return folder;
  }
  return null;
}

const TemplateFolderOverview: React.FC<TemplateFolderOverviewProps> = ({
  folderUid,
  onSelectTemplate,
  onOpenFolderOverview,
}) => {
  const { token } = theme.useToken();
  const { templateCollectionTrees } = useRules();

  const folder = useMemo(() => findFolder(templateCollectionTrees, folderUid), [templateCollectionTrees, folderUid]);

  const stats = useMemo(() => {
    if (!folder) return { templates: 0, folders: 0 };
    return {
      templates: countTemplatesDeep(folder.children),
      folders: countFoldersDeep(folder.children),
    };
  }, [folder]);

  const rows = useMemo((): ContentRow[] => {
    if (!folder) return [];
    return folder.children.map((node): ContentRow => {
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
  }, [folder]);

  const handleRowClick = useCallback(
    (row: ContentRow) => {
      if (row.kind === 'template') onSelectTemplate(row.uid);
      else if (row.kind === 'folder') onOpenFolderOverview(row.uid, row.name);
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
            {row.kind === 'folder' ? (
              <FolderOutlined style={{ color: token.colorTextTertiary }} />
            ) : (
              <FileTextOutlined style={{ color: token.colorTextTertiary }} />
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
                Folder · {row.childCount} template{row.childCount !== 1 ? 's' : ''}
              </span>
            );
          }
          if (!row.ruleType) return null;
          return (
            <Tag style={{ fontSize: 11, margin: 0 }}>{row.ruleType}</Tag>
          );
        },
      },
    ],
    [token],
  );

  if (!folder) {
    return (
      <CollectionOverviewShell
        statsBar={null}
        actions={null}
        contents={null}
        notFound
        notFoundLabel="Folder not found"
      />
    );
  }

  const statsBar = (
    <span style={{ fontSize: 13, color: token.colorTextSecondary }}>
      {stats.templates} template{stats.templates !== 1 ? 's' : ''}
      {stats.folders > 0 && (
        <>
          {' '}
          · {stats.folders} subfolder{stats.folders !== 1 ? 's' : ''}
        </>
      )}
    </span>
  );

  const contents =
    rows.length > 0 ? (
      <Table<ContentRow>
        dataSource={rows}
        columns={columns}
        size="small"
        pagination={false}
        showHeader={false}
        onRow={(row) => ({ onClick: () => handleRowClick(row), style: { cursor: 'pointer' } })}
      />
    ) : (
      <Empty
        description="No templates yet — save a rule as a template from the rule editor to populate this folder."
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        style={{ margin: '24px 0' }}
      />
    );

  return <CollectionOverviewShell statsBar={statsBar} actions={<></>} contents={contents} />;
};

export default TemplateFolderOverview;
