/**
 * RequestFolderOverview — overview tab for a folder inside an API-request
 * collection. Companion to {@link RequestCollectionOverview}; mirrors the
 * rule-family {@link FolderOverview} shape but scoped to requests.
 *
 *   - Stats: direct + descendant request counts, subfolder count.
 *   - Actions: Add Request (folder-scoped — Save flow lands the new
 *     request inside this folder).
 *   - Contents: top-level children (folders + requests) with a method
 *     tag column matching the collection-overview / sidebar precedent.
 *
 * Pre-this-session, clicking a folder inside a request collection
 * opened a `folder-overview` tab whose component (rule-family
 * `FolderOverview`) walked `localCollectionTrees` and rendered
 * "Folder not found" because the uid lives in a request tree.
 */

import { CodeOutlined, FolderOutlined, PlusOutlined } from '@ant-design/icons';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import type { CollectionTree, FolderNode, HttpMethod, TreeNode } from '@openheaders/core/types';
import { Button, Empty, Space, Table, Tag, Tooltip, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import CollectionOverviewShell from './CollectionOverviewShell';

interface RequestFolderOverviewProps {
  folderUid: string;
  onSelectRequest: (uid: string, name: string, method: HttpMethod) => void;
  onCreateRequest: (context: { collectionId: string; folderPath?: string }) => void;
  onOpenFolderOverview: (uid: string, name: string) => void;
  onOpenFolderScripts?: (uid: string, name: string) => void;
}

interface ContentRow {
  key: string;
  uid: string;
  name: string;
  kind: 'folder' | 'request';
  method?: HttpMethod;
  childCount?: number;
}

const METHOD_COLOR: Record<string, string> = {
  GET: 'blue',
  POST: 'green',
  PUT: 'orange',
  PATCH: 'gold',
  DELETE: 'red',
  HEAD: 'default',
  OPTIONS: 'default',
};

function countRequestsDeep(nodes: TreeNode[]): number {
  let count = 0;
  for (const n of nodes) {
    if (n.type === 'request') count++;
    else if (n.type === 'folder') count += countRequestsDeep(n.children);
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

function findFolder(
  trees: readonly CollectionTree[],
  uid: string,
): { folder: FolderNode; collectionUid: string } | null {
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
    if (folder) return { folder, collectionUid: col.uid };
  }
  return null;
}

const RequestFolderOverview: React.FC<RequestFolderOverviewProps> = ({
  folderUid,
  onSelectRequest,
  onCreateRequest,
  onOpenFolderOverview,
  onOpenFolderScripts,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const { collectionTrees } = useRequests();

  const found = useMemo(() => findFolder(collectionTrees, folderUid), [collectionTrees, folderUid]);
  const folder = found?.folder ?? null;
  const collectionUid = found?.collectionUid ?? '';
  const folderPath = folder?.path ?? '';

  const stats = useMemo(() => {
    if (!folder) return { requests: 0, folders: 0 };
    return {
      requests: countRequestsDeep(folder.children),
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
          childCount: countRequestsDeep(node.children),
        };
      }
      if (node.type !== 'request') return { key: node.uid, uid: node.uid, name: node.name, kind: 'folder' };
      return { key: node.uid, uid: node.uid, name: node.name, kind: 'request', method: node.method };
    });
  }, [folder]);

  const handleRowClick = useCallback(
    (row: ContentRow) => {
      if (row.kind === 'request' && row.method) onSelectRequest(row.uid, row.name, row.method);
      else if (row.kind === 'folder') onOpenFolderOverview(row.uid, row.name);
    },
    [onSelectRequest, onOpenFolderOverview],
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
                {t('workbench.overview.cell.folderRequests', { count: row.childCount ?? 0 })}
              </span>
            );
          }
          if (!row.method) return null;
          return (
            <Tag color={METHOD_COLOR[row.method] ?? 'default'} style={{ fontSize: 11, margin: 0 }}>
              {row.method}
            </Tag>
          );
        },
      },
    ],
    [token, t],
  );

  if (!folder) {
    return (
      <CollectionOverviewShell
        statsBar={null}
        actions={null}
        contents={null}
        notFound
        notFoundLabel={t('workbench.overview.empty.folderNotFound')}
      />
    );
  }

  const statsBar = (
    <span style={{ fontSize: 13, color: token.colorTextSecondary }}>
      {t('workbench.overview.stats.requests', { count: stats.requests })}
      {stats.folders > 0 && (
        <>
          {' '}
          {t('workbench.overview.stats.subfoldersSuffix', { count: stats.folders })}
        </>
      )}
    </span>
  );

  const actions = (
    <>
      <Button
        size="small"
        icon={<PlusOutlined />}
        onClick={() => onCreateRequest({ collectionId: collectionUid, folderPath })}
      >
        {t('workbench.overview.action.addRequest')}
      </Button>
      {onOpenFolderScripts && folder && (
        <Tooltip title={t('workbench.overview.action.scriptsTooltipFolder')}>
          <Button size="small" icon={<CodeOutlined />} onClick={() => onOpenFolderScripts(folderUid, folder.name)}>
            {t('workbench.overview.action.scripts')}
          </Button>
        </Tooltip>
      )}
    </>
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
        description={t('workbench.overview.empty.noItems')}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        style={{ margin: '24px 0' }}
      >
        <Button
          size="small"
          icon={<PlusOutlined />}
          onClick={() => onCreateRequest({ collectionId: collectionUid, folderPath })}
        >
          {t('workbench.overview.action.addRequest')}
        </Button>
      </Empty>
    );

  return <CollectionOverviewShell statsBar={statsBar} actions={actions} contents={contents} />;
};

export default RequestFolderOverview;
