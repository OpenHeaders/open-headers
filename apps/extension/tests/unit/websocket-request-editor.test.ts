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
  composeAsSavedMessage,
  draftFromWebSocketRequest,
  headersToRows,
  loadSavedMessageIntoCompose,
  mirrorComposeIntoSaved,
  nextSavedMessageName,
  paramsToRows,
  rowsToHeaders,
  rowsToParams,
  savedMessageFromFrame,
  savedRowMatchesCompose,
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

  it('splits a stored ?query off the URL into params ahead of the stored rows, deterministically', () => {
    const entity = websocketRequest({ url: 'wss://events.openheaders.io/live?room=a&empty=&flag' });
    const draft = draftFromWebSocketRequest(entity);
    expect(draft.url).toBe('wss://events.openheaders.io/live');
    expect(draft.params.map((r) => [r.key, r.value, r.hasEquals ?? false])).toEqual([
      ['room', 'a', false],
      ['empty', '', true],
      ['flag', '', false],
      ['tenant', 'openheaders', false],
    ]);
    expect(draftFromWebSocketRequest(entity).params.map((r) => r.uid)).toEqual(draft.params.map((r) => r.uid));
  });

  it('carries the hasEquals marker through the entity round trip', () => {
    const entity = websocketRequest({
      params: [{ uid: 'wspm0002', key: 'k', value: '', enabled: true, hasEquals: true }],
    });
    const updates = buildWebSocketRequestUpdates(draftFromWebSocketRequest(entity));
    expect(updates.params).toEqual([{ uid: 'wspm0002', key: 'k', value: '', enabled: true, hasEquals: true }]);
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

  it('carries the resilience policy through the round-trip and reads the switches off / backoff-on by default', () => {
    const tuned = websocketRequest({
      autoReconnect: true,
      reconnectPeriodMs: 2_000,
      reconnectMaxAttempts: 5,
      reconnectBackoff: false,
      idleTimeoutMs: 45_000,
      heartbeatMessage: '{"type":"ping"}',
      heartbeatIntervalMs: 15_000,
    });
    const updates = buildWebSocketRequestUpdates(draftFromWebSocketRequest(tuned));
    expect(updates).toEqual(canonicalWebSocketRequestProjection(tuned));
    expect(updates.autoReconnect).toBe(true);
    expect(updates.reconnectPeriodMs).toBe(2_000);
    expect(updates.reconnectMaxAttempts).toBe(5);
    expect(updates.reconnectBackoff).toBe(false);
    expect(updates.idleTimeoutMs).toBe(45_000);
    expect(updates.heartbeatMessage).toBe('{"type":"ping"}');
    expect(updates.heartbeatIntervalMs).toBe(15_000);
    const bare = buildWebSocketRequestUpdates(draftFromWebSocketRequest(websocketRequest()));
    expect(bare.autoReconnect).toBe(false);
    expect(bare.reconnectBackoff).toBe(true);
    expect(bare.idleTimeoutMs).toBeUndefined();
    expect(bare.heartbeatMessage).toBeUndefined();
  });

  it('never carries the flavor — creation fixes it, the editor cannot flip it', () => {
    const updates = buildWebSocketRequestUpdates(draftFromWebSocketRequest(websocketRequest({ flavor: 'socketio' })));
    expect('flavor' in updates).toBe(false);
  });

  it('reads an absent messageFormat as the text default', () => {
    const draft = draftFromWebSocketRequest(websocketRequest({ messageFormat: undefined }));
    expect(draft.messageFormat).toBe('text');
  });

  it('carries the binary encoding only while the format is binary, base64 by default', () => {
    const text = draftFromWebSocketRequest(websocketRequest({ messageFormat: 'text', binaryEncoding: 'hex' }));
    expect(text.binaryEncoding).toBe('hex');
    expect(buildWebSocketRequestUpdates(text).binaryEncoding).toBeUndefined();

    const binary = draftFromWebSocketRequest(websocketRequest({ messageFormat: 'binary' }));
    expect(binary.binaryEncoding).toBe('base64');
    expect(buildWebSocketRequestUpdates(binary).binaryEncoding).toBe('base64');
    expect(buildWebSocketRequestUpdates({ ...binary, binaryEncoding: 'hex' }).binaryEncoding).toBe('hex');
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

  it('keeps hasEquals identical on both sides so the fingerprint stays stable', () => {
    const entity = websocketRequest({
      params: [{ uid: 'wspm0002', key: 'flag', value: '', hasEquals: true }],
    });
    const viaForm = rowsToParams(paramsToRows(entity.params));
    const canonical = canonicalWebSocketRequestProjection(entity).params;
    expect(viaForm).toEqual(canonical);
    expect(canonical[0].hasEquals).toBe(true);
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

describe('saved-message compose binding', () => {
  const draft = draftFromWebSocketRequest(websocketRequest({ message: '{"op":"sub"}', messageFormat: 'json' }));

  it('captures the compose as a saved row with optional fields absent at defaults', () => {
    expect(composeAsSavedMessage(draft, 'wssm0001', 'Subscribe')).toEqual({
      uid: 'wssm0001',
      name: 'Subscribe',
      message: '{"op":"sub"}',
      messageFormat: 'json',
    });
    const text = { ...draft, messageFormat: 'text' as const, message: 'ping' };
    expect(composeAsSavedMessage(text, 'wssm0002', 'Ping')).toEqual({ uid: 'wssm0002', name: 'Ping', message: 'ping' });
    const hex = { ...draft, messageFormat: 'binary' as const, binaryEncoding: 'hex' as const, message: '68656c6c6f' };
    expect(composeAsSavedMessage(hex, 'wssm0003', 'Bytes')).toMatchObject({
      messageFormat: 'binary',
      binaryEncoding: 'hex',
    });
  });

  it('loads a row into the compose and recognizes the match; the mirror writes through identity-stably', () => {
    const row = { uid: 'wssm0001', name: 'Ping', message: 'ping' };
    const loaded = loadSavedMessageIntoCompose({ ...draft, savedMessages: [row] }, row);
    expect(loaded.message).toBe('ping');
    expect(loaded.messageFormat).toBe('text');
    expect(savedRowMatchesCompose(loaded, row)).toBe(true);
    expect(mirrorComposeIntoSaved(loaded, 'wssm0001')).toBe(loaded);
    const edited = { ...loaded, message: 'pong' };
    expect(mirrorComposeIntoSaved(edited, 'wssm0001').savedMessages[0].message).toBe('pong');
    expect(mirrorComposeIntoSaved(edited, null)).toBe(edited);
  });

  it('names the next row past the taken ones and captures a frame by its kind', () => {
    expect(nextSavedMessageName([{ uid: 'a', name: 'Message', message: '' }], 'Message')).toBe('Message (2)');
    expect(savedMessageFromFrame({ dataBase64: btoa('{"a":1}'), binary: false }, 'u1', 'M')).toEqual({
      uid: 'u1',
      name: 'M',
      message: '{"a":1}',
      messageFormat: 'json',
    });
    expect(savedMessageFromFrame({ dataBase64: btoa('hello'), binary: false }, 'u2', 'M')).toEqual({
      uid: 'u2',
      name: 'M',
      message: 'hello',
    });
    expect(savedMessageFromFrame({ dataBase64: 'AAEC', binary: true }, 'u3', 'M')).toEqual({
      uid: 'u3',
      name: 'M',
      message: 'AAEC',
      messageFormat: 'binary',
    });
  });
});

describe('websocket draft — script slots', () => {
  it("carries the request's own slots through the draft and emits the present ones alone", () => {
    const entity = websocketRequest({ scripts: { 'ws-before-connect': 'oh.setHeader("a", "1");' } });
    const draft = draftFromWebSocketRequest(entity);
    expect(draft.scripts).toEqual({ 'ws-before-connect': 'oh.setHeader("a", "1");' });
    const updates = buildWebSocketRequestUpdates({ ...draft, scripts: { ...draft.scripts, 'ws-on-message': '   ' } });
    expect(updates.scripts).toEqual({ 'ws-before-connect': 'oh.setHeader("a", "1");' });
  });

  it('an entity without scripts and a draft that emptied its slot both project to an empty record', () => {
    expect(buildWebSocketRequestUpdates(draftFromWebSocketRequest(websocketRequest())).scripts).toEqual({});
    const emptied = { ...draftFromWebSocketRequest(websocketRequest({ scripts: { 'ws-after-close': 'x();' } })) };
    emptied.scripts = { 'ws-after-close': '' };
    expect(buildWebSocketRequestUpdates(emptied).scripts).toEqual({});
    expect(canonicalWebSocketRequestProjection(websocketRequest()).scripts).toEqual({});
  });
});
