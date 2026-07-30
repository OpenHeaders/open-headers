/**
 * Unit tests for the WebSocket editor's pure modules:
 *
 *   - `draft.ts` — draft ⇄ entity projections whose fingerprints drive
 *     derived dirty (form-vs-canonical equality), including the row
 *     conversions and the `hasEquals` normalization note (the URL
 *     round-trip marker joins with the URL⇄params sync phase).
 *   - `local-tree-builder.ts` — all three request kinds sharing the
 *     collection tree, WebSocket leaves carrying their flavor.
 */

import type { Collection, Request, WebSocketRequest } from '@openheaders/core/types';
import { buildRequestCollectionTrees } from '@openheaders/ui/shared/local-tree-builder';
import {
  buildWebSocketRequestUpdates,
  canonicalWebSocketRequestProjection,
  draftFromWebSocketRequest,
  headersToRows,
  paramsToRows,
  rowsToHeaders,
  rowsToParams,
} from '@openheaders/ui/workbench/components/websocket-request-editor/draft';
import { describe, expect, it } from 'vitest';

const websocketRequest = (overrides: Partial<WebSocketRequest> = {}): WebSocketRequest => ({
  schemaVersion: 5,
  uid: 'wsrq0001',
  path: 'requests/live-events-wsrq0001',
  name: 'Live Events',
  url: 'wss://events.openheaders.io/live',
  flavor: 'raw',
  subprotocols: ['graphql-ws'],
  headers: [{ uid: 'wshd0001', key: 'x-api-key', value: '{{vault.api_key}}', enabled: true }],
  params: [{ uid: 'wspm0001', key: 'tenant', value: 'openheaders', enabled: true }],
  message: '{"event": "subscribe"}',
  messageFormat: 'json',
  specLink: { specUid: 'spec0001' },
  timeoutMs: 30_000,
  ...overrides,
});

describe('websocket draft projections', () => {
  it('projects entity → draft → updates losslessly for the editable fields', () => {
    const entity = websocketRequest({ description: 'notes' });
    const updates = buildWebSocketRequestUpdates(draftFromWebSocketRequest(entity));
    expect(updates.description).toBe('notes');
    expect(updates.url).toBe(entity.url);
    expect(updates.subprotocols).toEqual(entity.subprotocols);
    expect(updates.headers).toEqual(entity.headers);
    expect(updates.params).toEqual(entity.params);
    expect(updates.message).toBe(entity.message);
    expect(updates.messageFormat).toBe('json');
    expect(updates.specLink).toEqual({ specUid: 'spec0001' });
    expect(updates.timeoutMs).toBe(30_000);
  });

  it('reads an absent sslVerification as verify-on and carries an explicit opt-out', () => {
    expect(buildWebSocketRequestUpdates(draftFromWebSocketRequest(websocketRequest())).sslVerification).toBe(true);
    expect(
      buildWebSocketRequestUpdates(draftFromWebSocketRequest(websocketRequest({ sslVerification: false })))
        .sslVerification,
    ).toBe(false);
  });

  it('round-trips the Unix-socket knob; absent stays undefined so the save patch skips it', () => {
    expect(buildWebSocketRequestUpdates(draftFromWebSocketRequest(websocketRequest())).unixSocketPath).toBeUndefined();
    const socketed = websocketRequest({ unixSocketPath: '/var/run/openheaders/ws.sock' });
    const updates = buildWebSocketRequestUpdates(draftFromWebSocketRequest(socketed));
    expect(updates).toEqual(canonicalWebSocketRequestProjection(socketed));
    expect(updates.unixSocketPath).toBe('/var/run/openheaders/ws.sock');
  });

  it('never carries the flavor — creation fixes it, the editor cannot flip it', () => {
    const updates = buildWebSocketRequestUpdates(draftFromWebSocketRequest(websocketRequest({ flavor: 'socketio' })));
    expect('flavor' in updates).toBe(false);
  });

  it('reads an absent messageFormat as the text default', () => {
    const draft = draftFromWebSocketRequest(websocketRequest({ messageFormat: undefined }));
    expect(draft.messageFormat).toBe('text');
  });

  it('matches the canonical projection for an untouched form (derived dirty baseline)', () => {
    const entity = websocketRequest();
    expect(buildWebSocketRequestUpdates(draftFromWebSocketRequest(entity))).toEqual(
      canonicalWebSocketRequestProjection(entity),
    );
  });

  it('drops blank-key rows on the way back to entity rows', () => {
    const rows = headersToRows([{ uid: 'wshd0001', key: 'x-api-key', value: 'v' }]);
    rows.push({ ...rows[0], uid: 'wshd0002', key: '   ' });
    expect(rowsToHeaders(rows).map((r) => r.uid)).toEqual(['wshd0001']);
  });

  it('normalizes hasEquals away on both sides so the fingerprint stays stable', () => {
    const entity = websocketRequest({
      params: [{ uid: 'wspm0002', key: 'flag', value: '', hasEquals: true }],
    });
    const viaForm = rowsToParams(paramsToRows(entity.params));
    const canonical = canonicalWebSocketRequestProjection(entity).params;
    expect(viaForm).toEqual(canonical);
    expect(canonical[0].hasEquals).toBeUndefined();
  });
});

describe('request collection tree with websocket leaves', () => {
  const collection: Collection = {
    schemaVersion: 5,
    uid: 'col00001',
    path: 'requests',
    name: 'API',
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };

  const httpRequest: Request = {
    schemaVersion: 5,
    uid: 'requ0001',
    path: 'requests/list-requ0001',
    name: 'List',
    method: 'GET',
    url: 'https://api.openheaders.io/list',
    headers: [],
    params: [],
    auth: { type: 'inherit' },
    body: { type: 'none' },
  };

  it('merges websocket leaves after HTTP + gRPC, carrying the flavor', () => {
    const trees = buildRequestCollectionTrees(
      [collection],
      [],
      [httpRequest],
      [],
      [
        websocketRequest({ path: 'requests/live-events-wsrq0001' }),
        websocketRequest({
          uid: 'wsrq0002',
          path: 'requests/chat-wsrq0002',
          name: 'Chat',
          flavor: 'socketio',
        }),
      ],
    );
    expect(trees[0].tree.map((n) => n.type)).toEqual(['request', 'websocket-request', 'websocket-request']);
    const wsNodes = trees[0].tree.filter((n) => n.type === 'websocket-request');
    expect(wsNodes.map((n) => (n.type === 'websocket-request' ? n.flavor : null))).toEqual(['raw', 'socketio']);
  });

  it('keeps websocket leaves under their folder parent', () => {
    const trees = buildRequestCollectionTrees(
      [collection],
      [{ schemaVersion: 5, uid: 'fold0001', path: 'requests/live', name: 'Live' }],
      [],
      [],
      [websocketRequest({ path: 'requests/live/events-wsrq0001' })],
    );
    const folder = trees[0].tree[0];
    expect(folder.type).toBe('folder');
    if (folder.type === 'folder') {
      expect(folder.children.map((n) => n.type)).toEqual(['websocket-request']);
    }
  });
});
