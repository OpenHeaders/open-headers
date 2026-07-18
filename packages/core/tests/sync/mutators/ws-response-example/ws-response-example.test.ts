import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { WsResponseExampleSchema } from '../../../../src/schemas';
import {
  createWsResponseExample,
  deleteWsResponseExample,
  type MutatorContext,
  setWsResponseExampleField,
  WS_RESPONSE_EXAMPLE_ENTITY_TYPE,
  WS_RESPONSE_EXAMPLE_MUTATOR_VERSION,
} from '../../../../src/sync';
import { buildRenameWsResponseExampleBatch } from '../../../../src/sync-builders/mutations/ws-response-example-mutations';
import {
  projectWsResponseExample,
  seedWsResponseExample,
} from '../../../../src/sync-builders/projections/ws-response-example-projection';
import type { WsResponseExample } from '../../../../src/types';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 2_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

const example = (overrides: Partial<WsResponseExample> = {}): WsResponseExample => ({
  schemaVersion: 5,
  uid: 'wex00001',
  path: 'requests/my-requests-col00001/echo-wsr00001/examples/echo-wex00001',
  websocketRequestUid: 'wsr00001',
  name: 'Echo',
  capturedAt: '2026-07-19T09:00:00.000Z',
  request: {
    url: 'wss://echo.openheaders.io/socket',
    flavor: 'raw',
    subprotocols: ['graphql-ws'],
    headers: [{ uid: 'hd000001', key: 'x-trace', value: 'abc', enabled: true }],
    params: [{ uid: 'pm000001', key: 'room', value: 'lobby' }],
    message: '{"hello":"world"}',
    sslVerification: true,
    timeoutMs: 30_000,
  },
  response: {
    protocol: 'graphql-ws',
    extensions: '',
    messages: [
      { direction: 'up', dataBase64: 'eyJoZWxsbyI6IndvcmxkIn0=', binary: false },
      { direction: 'down', dataBase64: 'eyJoZWxsbyI6IndvcmxkIn0=', binary: false },
    ],
    droppedMessages: 0,
    close: { code: 1000, reason: '', wasClean: true },
    durationMs: 42,
  },
  ...overrides,
});

describe('WsResponseExampleSchema', () => {
  it('accepts a full settled-session example', () => {
    expect(() => v.parse(WsResponseExampleSchema, example())).not.toThrow();
  });

  it('accepts a socketio capture with the compose fields', () => {
    const e = example();
    expect(() =>
      v.parse(WsResponseExampleSchema, {
        ...e,
        request: {
          ...e.request,
          flavor: 'socketio',
          namespace: '/probe',
          eventName: 'echo',
          ackEnabled: true,
          message: '["hello", 42]',
        },
      }),
    ).not.toThrow();
  });

  it('accepts a severed session — null close, stopped, dropped messages', () => {
    const e = example();
    expect(() =>
      v.parse(WsResponseExampleSchema, {
        ...e,
        response: { ...e.response, close: null, stopped: true, droppedMessages: 7 },
      }),
    ).not.toThrow();
  });

  it('rejects an unknown flavor', () => {
    const e = example();
    expect(() => v.parse(WsResponseExampleSchema, { ...e, request: { ...e.request, flavor: 'mqtt' } })).toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => v.parse(WsResponseExampleSchema, example({ name: '' }))).toThrow();
  });

  it('rejects a malformed parent uid', () => {
    expect(() => v.parse(WsResponseExampleSchema, example({ websocketRequestUid: 'nope' }))).toThrow();
  });

  it('strips volatile execution fields from the captured response', () => {
    const e = example();
    const parsed = v.parse(WsResponseExampleSchema, {
      ...e,
      response: { ...e.response, error: 'boom', executedOn: { kind: 'backend', name: 'dev' } },
    });
    expect('error' in parsed.response).toBe(false);
    expect('executedOn' in parsed.response).toBe(false);
  });
});

describe('createWsResponseExample', () => {
  it('mints a single create envelope carrying the full payload with no side effects', () => {
    const { uid: _uid, ...payload } = example();
    const intent = createWsResponseExample(ctx(), { wsResponseExampleUid: 'wex00001', payload });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].mutatorVersion).toBe(WS_RESPONSE_EXAMPLE_MUTATOR_VERSION);
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'create',
      type: WS_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: 'wex00001',
      payload,
    });
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('deleteWsResponseExample', () => {
  it('emits a single delete envelope with no side effects', () => {
    const intent = deleteWsResponseExample(ctx(), { wsResponseExampleUid: 'wex00001' });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'delete',
      type: WS_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: 'wex00001',
    });
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('setWsResponseExampleField', () => {
  it('emits a setField at the writable scalar path', () => {
    const intent = setWsResponseExampleField(ctx(), {
      wsResponseExampleUid: 'wex00001',
      path: 'name',
      value: 'renamed',
    });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'setField',
      type: WS_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: 'wex00001',
      path: 'name',
      value: 'renamed',
    });
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('buildRenameWsResponseExampleBatch', () => {
  it('emits one setField per defined key and skips undefined values', () => {
    const { batch, sideEffects } = buildRenameWsResponseExampleBatch(
      'wex00001',
      { name: 'renamed', path: undefined },
      ctx(),
    );
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toEqual({
      kind: 'setField',
      type: WS_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: 'wex00001',
      path: 'name',
      value: 'renamed',
    });
    expect(sideEffects).toEqual([]);
  });
});

describe('seedWsResponseExample / projectWsResponseExample', () => {
  it('round-trips through a create envelope + materialized shape', () => {
    const entity = example();
    const batch = seedWsResponseExample(entity, ctx());
    expect(batch.mutations).toHaveLength(1);
    const body = batch.mutations[0].body;
    expect(body).toMatchObject({ kind: 'create', type: WS_RESPONSE_EXAMPLE_ENTITY_TYPE, id: 'wex00001' });
    if (body.kind !== 'create') throw new Error('expected create body');
    const projected = projectWsResponseExample({
      type: WS_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: entity.uid,
      data: body.payload as Record<string, unknown>,
      fieldOrigins: {},
    });
    expect(projected).toEqual(entity);
  });

  it('returns null for a foreign entity type', () => {
    expect(projectWsResponseExample({ type: 'websocketRequest', id: 'r1', data: {}, fieldOrigins: {} })).toBeNull();
  });
});
