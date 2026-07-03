/**
 * RequestCollectionOverview — overview tab for an API-request collection.
 *
 * Mirrors {@link CollectionOverview}'s shape for the rule-collection
 * family, scoped to requests:
 *   - Stats: total request count + folder count.
 *   - Actions: Add Request (collection-scoped), Variables.
 *   - Contents: top-level children (folders + requests) with a method
 *     tag column instead of the rule type/status columns rules carry.
 *
 * Pre-session-50 there was no overview surface for request collections
 * at all — clicking a request collection in the sidebar only toggled
 * expansion. Sessions 48 + 49 shipped the request-collection variables
 * pipeline + Inspector polymorphism; this component surfaces the
 * Variables opener at a discoverable entry point matching the rule
 * collection precedent.
 */

import { CodeOutlined, FolderOutlined, PlusOutlined } from '@ant-design/icons';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import type { HttpMethod, TreeNode } from '@openheaders/core/types';
import { Button, Empty, Space, Table, Tag, Tooltip, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import CollectionOverviewShell from './CollectionOverviewShell';

interface RequestCollectionOverviewProps {
  collectionUid: string;
  onSelectRequest: (uid: string, name: string, method: HttpMethod) => void;
  onCreateRequest: (context: { collectionId: string; folderPath?: string }) => void;
  onOpenFolderOverview: (uid: string, name: string) => void;
  onOpenCollectionVariables?: (uid: string, name: string) => void;
}

interface ContentRow {
  key: string;
  uid: string;
  name: string;
  kind: 'folder' | 'request';
  method?: HttpMethod;
  childCount?: number;
}

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

const METHOD_COLOR: Record<string, string> = {
  GET: 'blue',
  POST: 'green',
  PUT: 'orange',
  PATCH: 'gold',
  DELETE: 'red',
  HEAD: 'default',
  OPTIONS: 'default',
};

const RequestCollectionOverview: React.FC<RequestCollectionOverviewProps> = ({
  collectionUid,
  onSelectRequest,
  onCreateRequest,
  onOpenFolderOverview,
  onOpenCollectionVariables,
}) => {
  const { token } = theme.useToken();
  const { collectionTrees } = useRequests();

  const collection = useMemo(
    () => collectionTrees.find((c) => c.uid === collectionUid),
    [collectionTrees, collectionUid],
  );

  const stats = useMemo(() => {
    if (!collection) return { requests: 0, folders: 0 };
    return {
      requests: countRequestsDeep(collection.tree),
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
          childCount: countRequestsDeep(node.children),
        };
      }
      // The tree only carries `request` nodes alongside folders for
      // a request collection; defensive fall-through if it doesn't.
      if (node.type !== 'request') return { key: node.uid, uid: node.uid, name: node.name, kind: 'folder' };
      return {
        key: node.uid,
        uid: node.uid,
        name: node.name,
        kind: 'request',
        method: node.method,
      };
    });
  }, [collection]);

  const handleRowClick = useCallback(
    (row: ContentRow) => {
      if (row.kind === 'request' && row.method) {
        onSelectRequest(row.uid, row.name, row.method);
      } else if (row.kind === 'folder') {
        onOpenFolderOverview(row.uid, row.name);
      }
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
                Folder · {row.childCount} request{row.childCount !== 1 ? 's' : ''}
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
    [token],
  );

  if (!collection) {
    return (
      <CollectionOverviewShell
        statsBar={null}
        actions={null}
        contents={null}
        notFound
        notFoundLabel="Request collection not found"
      />
    );
  }

  const statsBar = (
    <span style={{ fontSize: 13, color: token.colorTextSecondary }}>
      {stats.requests} request{stats.requests !== 1 ? 's' : ''}
      {stats.folders > 0 && (
        <>
          {' '}
          · {stats.folders} folder{stats.folders !== 1 ? 's' : ''}
        </>
      )}
    </span>
  );

  const actions = (
    <>
      <Button size="small" icon={<PlusOutlined />} onClick={() => onCreateRequest({ collectionId: collectionUid })}>
        Add Request
      </Button>
      {onOpenCollectionVariables && (
        <Tooltip title="Edit variables scoped to this request collection">
          <Button
            size="small"
            icon={<CodeOutlined />}
            onClick={() => onOpenCollectionVariables(collectionUid, collection.name)}
          >
            Variables
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
        onRow={(row) => ({
          onClick: () => handleRowClick(row),
          style: { cursor: 'pointer' },
        })}
      />
    ) : (
      <Empty description="No requests yet" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '24px 0' }}>
        <Button size="small" icon={<PlusOutlined />} onClick={() => onCreateRequest({ collectionId: collectionUid })}>
          Add Request
        </Button>
      </Empty>
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

export default RequestCollectionOverview;
