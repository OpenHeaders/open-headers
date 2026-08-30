/**
 * RequestFolderOverview — overview tab for a folder inside an API-request
 * collection. Companion to {@link RequestCollectionOverview}; mirrors the
 * rule-family {@link FolderOverview} shape but scoped to requests.
 *
 *   - Stats: direct + descendant request counts (HTTP + gRPC),
 *     subfolder count.
 *   - Actions: Add Request (folder-scoped — Save flow lands the new
 *     request inside this folder).
 *   - Contents: top-level children (folders + HTTP/gRPC requests) with
 *     a method tag column matching the collection-overview / sidebar
 *     precedent.
 *
 * The Overview section of {@link RequestContainerEditor} — the
 * folder's scripts and authorization are that editor's other sections.
 */

import { FolderOutlined, PlusOutlined } from '@ant-design/icons';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import type { CollectionTree, FolderNode, HttpMethod, TreeNode } from '@openheaders/core/types';
import { Button, Dropdown, Empty, Space, Table, Tag, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { requestKindAddMenuItems } from '../../request-kind-menu';
import CollectionOverviewShell from './CollectionOverviewShell';
import { GrpcMark, MqttMark, WebSocketMark } from './RequestCollectionOverview';

interface RequestFolderOverviewProps {
  folderUid: string;
  onSelectRequest: (uid: string, name: string, method: HttpMethod) => void;
  onSelectGrpcRequest: (uid: string, name: string) => void;
  onSelectWebSocketRequest: (uid: string, name: string, flavor?: 'raw' | 'socketio') => void;
  onSelectMqttRequest: (uid: string, name: string) => void;
  onCreateRequest: (context: { collectionId: string; folderPath?: string }) => void;
  /** Sibling protocol creates — wired by hosts that author them, so
   *  "Add request" offers the same four kinds the sidebar's `+` does
   *  instead of silently minting HTTP. */
  onCreateGrpcRequest?: (context: { collectionId: string; folderPath?: string }) => void;
  onCreateWebSocketRequest?: (context: {
    collectionId: string;
    folderPath?: string;
    flavor: 'raw' | 'socketio';
  }) => void;
  onCreateMqttRequest?: (context: { collectionId: string; folderPath?: string }) => void;
  onOpenFolderOverview: (uid: string, name: string) => void;
}

interface ContentRow {
  key: string;
  uid: string;
  name: string;
  kind: 'folder' | 'request' | 'grpc-request' | 'websocket-request' | 'mqtt-request';
  method?: HttpMethod;
  flavor?: 'raw' | 'socketio';
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
    if (n.type === 'request' || n.type === 'grpc-request' || n.type === 'websocket-request' || n.type === 'mqtt-request')
      count++;
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
  onSelectGrpcRequest,
  onSelectWebSocketRequest,
  onSelectMqttRequest,
  onCreateRequest,
  onCreateGrpcRequest,
  onCreateWebSocketRequest,
  onCreateMqttRequest,
  onOpenFolderOverview,
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

  // "Add request" opens the protocol picker rather than acting — the
  // same four kinds the folder's row offers on its `+`.
  const addRequestMenuItems = useMemo(() => {
    const context = { collectionId: collectionUid, folderPath };
    return requestKindAddMenuItems(
      {
        onAddRequest: () => onCreateRequest(context),
        ...(onCreateGrpcRequest ? { onAddGrpcRequest: () => onCreateGrpcRequest(context) } : {}),
        ...(onCreateWebSocketRequest
          ? {
              onAddWebSocketRequest: () => onCreateWebSocketRequest({ ...context, flavor: 'raw' }),
              onAddSocketIoRequest: () => onCreateWebSocketRequest({ ...context, flavor: 'socketio' }),
            }
          : {}),
        ...(onCreateMqttRequest ? { onAddMqttRequest: () => onCreateMqttRequest(context) } : {}),
      },
      t,
    );
  }, [collectionUid, folderPath, onCreateRequest, onCreateGrpcRequest, onCreateWebSocketRequest, onCreateMqttRequest, t]);

  const addRequestButton = (
    <Dropdown menu={{ items: addRequestMenuItems }} trigger={['click']}>
      <Button size="small" icon={<PlusOutlined />}>
        {t('workbench.overview.action.addRequest')}
      </Button>
    </Dropdown>
  );

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
      if (node.type === 'grpc-request') {
        return { key: node.uid, uid: node.uid, name: node.name, kind: 'grpc-request' };
      }
      if (node.type === 'websocket-request') {
        return { key: node.uid, uid: node.uid, name: node.name, kind: 'websocket-request', flavor: node.flavor };
      }
      if (node.type === 'mqtt-request') {
        return { key: node.uid, uid: node.uid, name: node.name, kind: 'mqtt-request' };
      }
      if (node.type !== 'request') return { key: node.uid, uid: node.uid, name: node.name, kind: 'folder' };
      return { key: node.uid, uid: node.uid, name: node.name, kind: 'request', method: node.method };
    });
  }, [folder]);

  const handleRowClick = useCallback(
    (row: ContentRow) => {
      if (row.kind === 'request' && row.method) onSelectRequest(row.uid, row.name, row.method);
      else if (row.kind === 'grpc-request') onSelectGrpcRequest(row.uid, row.name);
      else if (row.kind === 'websocket-request') onSelectWebSocketRequest(row.uid, row.name, row.flavor);
      else if (row.kind === 'mqtt-request') onSelectMqttRequest(row.uid, row.name);
      else if (row.kind === 'folder') onOpenFolderOverview(row.uid, row.name);
    },
    [onSelectRequest, onSelectGrpcRequest, onSelectWebSocketRequest, onSelectMqttRequest, onOpenFolderOverview],
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
          if (row.kind === 'grpc-request') return <GrpcMark />;
          if (row.kind === 'websocket-request') return <WebSocketMark flavor={row.flavor} />;
          if (row.kind === 'mqtt-request') return <MqttMark />;
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

  // Scripts / Authorization are the container editor's own sections,
  // not actions — the overview's only action creates.
  const actions = addRequestButton;

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
        {addRequestButton}
      </Empty>
    );

  return <CollectionOverviewShell statsBar={statsBar} actions={actions} contents={contents} />;
};

export default RequestFolderOverview;
