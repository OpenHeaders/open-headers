/**
 * RequestCollectionOverview — overview tab for an API-request collection.
 *
 * Mirrors {@link CollectionOverview}'s shape for the rule-collection
 * family, scoped to requests:
 *   - Stats: total request count (HTTP + gRPC) + folder count.
 *   - Actions: Add Request (collection-scoped).
 *   - Contents: top-level children (folders + HTTP/gRPC requests) with
 *     a method tag column instead of the rule type/status columns
 *     rules carry; gRPC rows carry the sidebar's monospace gRPC mark.
 *
 * The Overview section of {@link RequestContainerEditor} — the
 * collection's variables, scripts and authorization are that editor's
 * other sections, never buttons here.
 */

import { FolderOutlined, PlusOutlined } from '@ant-design/icons';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import type { HttpMethod, TreeNode } from '@openheaders/core/types';
import { Button, Dropdown, Empty, Space, Table, Tag, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { requestKindAddMenuItems } from '../../request-kind-menu';
import CollectionOverviewShell from './CollectionOverviewShell';

interface RequestCollectionOverviewProps {
  collectionUid: string;
  onSelectRequest: (uid: string, name: string, method: HttpMethod) => void;
  onSelectGrpcRequest: (uid: string, name: string) => void;
  onSelectWebSocketRequest: (uid: string, name: string, flavor?: 'raw' | 'socketio') => void;
  onSelectMqttRequest: (uid: string, name: string) => void;
  onSelectGraphqlRequest: (uid: string, name: string) => void;
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
  onCreateGraphqlRequest?: (context: { collectionId: string; folderPath?: string }) => void;
  onOpenFolderOverview: (uid: string, name: string) => void;
}

interface ContentRow {
  key: string;
  uid: string;
  name: string;
  kind: 'folder' | 'request' | 'grpc-request' | 'websocket-request' | 'mqtt-request' | 'graphql-request';
  method?: HttpMethod;
  flavor?: 'raw' | 'socketio';
  childCount?: number;
}

function countRequestsDeep(nodes: TreeNode[]): number {
  let count = 0;
  for (const n of nodes) {
    if (
      n.type === 'request' ||
      n.type === 'grpc-request' ||
      n.type === 'websocket-request' ||
      n.type === 'mqtt-request' ||
      n.type === 'graphql-request'
    )
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

const METHOD_COLOR: Record<string, string> = {
  GET: 'blue',
  POST: 'green',
  PUT: 'orange',
  PATCH: 'gold',
  DELETE: 'red',
  HEAD: 'default',
  OPTIONS: 'default',
};

/** The sidebar leaf's monospace gRPC mark, at the method-tag column's
 *  footprint — the two surfaces must read the same. */
export const GrpcMark: React.FC = () => (
  <span
    style={{
      fontSize: 9,
      fontWeight: 700,
      color: 'var(--oh-method-grpc, #0b5cad)',
      fontFamily: "'SF Mono', monospace",
    }}
  >
    gRPC
  </span>
);

/** The sidebar leaf's monospace MQTT mark, same footprint as {@link GrpcMark}. */
export const MqttMark: React.FC = () => (
  <span
    style={{
      fontSize: 9,
      fontWeight: 700,
      color: 'var(--oh-method-mqtt, #7c3aed)',
      fontFamily: "'SF Mono', monospace",
    }}
  >
    MQTT
  </span>
);

/** The sidebar leaf's monospace GraphQL mark, same footprint as {@link GrpcMark}. */
export const GraphqlMark: React.FC = () => (
  <span
    style={{
      fontSize: 9,
      fontWeight: 700,
      color: 'var(--oh-method-graphql, #e10098)',
      fontFamily: "'SF Mono', monospace",
    }}
  >
    GQL
  </span>
);

/** The sidebar leaf's monospace WebSocket mark — flavor-labelled
 *  (WS / S.IO), same footprint as {@link GrpcMark}. */
export const WebSocketMark: React.FC<{ flavor?: 'raw' | 'socketio' }> = ({ flavor }) => (
  <span
    style={{
      fontSize: 9,
      fontWeight: 700,
      color: 'var(--oh-method-ws, #c2410c)',
      fontFamily: "'SF Mono', monospace",
    }}
  >
    {flavor === 'socketio' ? 'S.IO' : 'WS'}
  </span>
);

const RequestCollectionOverview: React.FC<RequestCollectionOverviewProps> = ({
  collectionUid,
  onSelectRequest,
  onSelectGrpcRequest,
  onSelectWebSocketRequest,
  onSelectMqttRequest,
  onSelectGraphqlRequest,
  onCreateRequest,
  onCreateGrpcRequest,
  onCreateWebSocketRequest,
  onCreateMqttRequest,
  onCreateGraphqlRequest,
  onOpenFolderOverview,
}) => {
  const { token } = theme.useToken();
  const t = useT();
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

  // "Add request" opens the protocol picker rather than acting — the
  // same four kinds the collection's row offers on its `+`.
  const addRequestMenuItems = useMemo(
    () =>
      requestKindAddMenuItems(
        {
          onAddRequest: () => onCreateRequest({ collectionId: collectionUid }),
          ...(onCreateGrpcRequest ? { onAddGrpcRequest: () => onCreateGrpcRequest({ collectionId: collectionUid }) } : {}),
          ...(onCreateWebSocketRequest
            ? {
                onAddWebSocketRequest: () => onCreateWebSocketRequest({ collectionId: collectionUid, flavor: 'raw' }),
                onAddSocketIoRequest: () =>
                  onCreateWebSocketRequest({ collectionId: collectionUid, flavor: 'socketio' }),
              }
            : {}),
          ...(onCreateMqttRequest ? { onAddMqttRequest: () => onCreateMqttRequest({ collectionId: collectionUid }) } : {}),
          ...(onCreateGraphqlRequest
            ? { onAddGraphqlRequest: () => onCreateGraphqlRequest({ collectionId: collectionUid }) }
            : {}),
        },
        t,
      ),
    [
      collectionUid,
      onCreateRequest,
      onCreateGrpcRequest,
      onCreateWebSocketRequest,
      onCreateMqttRequest,
      onCreateGraphqlRequest,
      t,
    ],
  );

  const addRequestButton = (
    <Dropdown menu={{ items: addRequestMenuItems }} trigger={['click']}>
      <Button size="small" icon={<PlusOutlined />}>
        {t('workbench.overview.action.addRequest')}
      </Button>
    </Dropdown>
  );

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
      if (node.type === 'grpc-request') {
        return { key: node.uid, uid: node.uid, name: node.name, kind: 'grpc-request' };
      }
      if (node.type === 'websocket-request') {
        return { key: node.uid, uid: node.uid, name: node.name, kind: 'websocket-request', flavor: node.flavor };
      }
      if (node.type === 'mqtt-request') {
        return { key: node.uid, uid: node.uid, name: node.name, kind: 'mqtt-request' };
      }
      if (node.type === 'graphql-request') {
        return { key: node.uid, uid: node.uid, name: node.name, kind: 'graphql-request' };
      }
      // The tree only carries request-family nodes alongside folders
      // for a request collection; defensive fall-through if it doesn't.
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
      } else if (row.kind === 'grpc-request') {
        onSelectGrpcRequest(row.uid, row.name);
      } else if (row.kind === 'websocket-request') {
        onSelectWebSocketRequest(row.uid, row.name, row.flavor);
      } else if (row.kind === 'mqtt-request') {
        onSelectMqttRequest(row.uid, row.name);
      } else if (row.kind === 'graphql-request') {
        onSelectGraphqlRequest(row.uid, row.name);
      } else if (row.kind === 'folder') {
        onOpenFolderOverview(row.uid, row.name);
      }
    },
    [
      onSelectRequest,
      onSelectGrpcRequest,
      onSelectWebSocketRequest,
      onSelectMqttRequest,
      onSelectGraphqlRequest,
      onOpenFolderOverview,
    ],
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
          if (row.kind === 'graphql-request') return <GraphqlMark />;
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

  if (!collection) {
    return (
      <CollectionOverviewShell
        statsBar={null}
        actions={null}
        contents={null}
        notFound
        notFoundLabel={t('workbench.overview.empty.requestCollectionNotFound')}
      />
    );
  }

  const statsBar = (
    <span style={{ fontSize: 13, color: token.colorTextSecondary }}>
      {t('workbench.overview.stats.requests', { count: stats.requests })}
      {stats.folders > 0 && (
        <>
          {' '}
          {t('workbench.overview.stats.foldersSuffix', { count: stats.folders })}
        </>
      )}
    </span>
  );

  // Variables / Scripts / Authorization are the container editor's own
  // sections, not actions — the overview's only action creates.
  const actions = addRequestButton;

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
        description={t('workbench.overview.empty.noRequests')}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        style={{ margin: '24px 0' }}
      >
        {addRequestButton}
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
