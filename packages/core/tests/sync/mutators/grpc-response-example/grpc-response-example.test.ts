import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { GrpcResponseExampleSchema } from '../../../../src/schemas';
import {
  createGrpcResponseExample,
  deleteGrpcResponseExample,
  GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
  GRPC_RESPONSE_EXAMPLE_MUTATOR_VERSION,
  type MutatorContext,
  setGrpcResponseExampleField,
} from '../../../../src/sync';
import { buildRenameGrpcResponseExampleBatch } from '../../../../src/sync-builders/mutations/grpc-response-example-mutations';
import {
  projectGrpcResponseExample,
  seedGrpcResponseExample,
} from '../../../../src/sync-builders/projections/grpc-response-example-projection';
import type { GrpcResponseExample } from '../../../../src/types';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 2_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

const example = (overrides: Partial<GrpcResponseExample> = {}): GrpcResponseExample => ({
  schemaVersion: 5,
  uid: 'gex00001',
  path: 'requests/my-requests-col00001/get-book-grq00001/examples/get-book-gex00001',
  grpcRequestUid: 'grq00001',
  name: 'GetBook',
  capturedAt: '2026-07-17T09:00:00.000Z',
  request: {
    url: 'grpc.openheaders.io:443',
    tls: true,
    sslVerification: true,
    method: { service: 'library.v1.Library', rpc: 'GetBook' },
    metadata: [{ uid: 'md000001', key: 'x-trace', value: 'abc', enabled: true }],
    message: '{"name":"books/1"}',
    timeoutMs: 30_000,
  },
  response: {
    grpcStatus: 0,
    statusSource: 'trailers',
    metadata: [{ key: 'content-type', value: 'application/grpc+proto' }],
    trailers: [{ key: 'x-books-checksum', value: 'c1' }],
    messages: [{ dataBase64: 'Cgdib29rcy8x', compressed: false }],
    bodyTruncated: false,
    bodyBytes: 14,
    durationMs: 42,
  },
  ...overrides,
});

describe('GrpcResponseExampleSchema', () => {
  it('accepts a full unary example', () => {
    expect(() => v.parse(GrpcResponseExampleSchema, example())).not.toThrow();
  });

  it('accepts a streamed capture with direction tags + stopped', () => {
    const e = example();
    expect(() =>
      v.parse(GrpcResponseExampleSchema, {
        ...e,
        response: {
          ...e.response,
          grpcStatus: null,
          statusSource: null,
          messages: [
            { dataBase64: 'CgE=', compressed: false, direction: 'up' },
            { dataBase64: 'CgI=', compressed: false, direction: 'down' },
          ],
          headAtMessage: 1,
          stopped: true,
        },
      }),
    ).not.toThrow();
  });

  it('rejects a negative head position', () => {
    const e = example();
    expect(() =>
      v.parse(GrpcResponseExampleSchema, { ...e, response: { ...e.response, headAtMessage: -1 } }),
    ).toThrow();
  });

  it('accepts a truncated body with its cap recorded', () => {
    const e = example();
    expect(() =>
      v.parse(GrpcResponseExampleSchema, {
        ...e,
        response: { ...e.response, bodyTruncated: true, bodyCapBytes: 1_048_576, bodyBytes: 2_000_000 },
      }),
    ).not.toThrow();
  });

  it('accepts a method-less capture', () => {
    const e = example();
    const { method: _method, ...request } = e.request;
    expect(() => v.parse(GrpcResponseExampleSchema, { ...e, request })).not.toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => v.parse(GrpcResponseExampleSchema, example({ name: '' }))).toThrow();
  });

  it('rejects a malformed parent uid', () => {
    expect(() => v.parse(GrpcResponseExampleSchema, example({ grpcRequestUid: 'nope' }))).toThrow();
  });

  it('strips an auth field from the captured request (secrets law)', () => {
    const e = example();
    const parsed = v.parse(GrpcResponseExampleSchema, {
      ...e,
      request: { ...e.request, auth: { type: 'bearer', token: 'secret' } },
    });
    expect('auth' in parsed.request).toBe(false);
  });
});

describe('createGrpcResponseExample', () => {
  it('mints a single create envelope carrying the full payload with no side effects', () => {
    const { uid: _uid, ...payload } = example();
    const intent = createGrpcResponseExample(ctx(), { grpcResponseExampleUid: 'gex00001', payload });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].mutatorVersion).toBe(GRPC_RESPONSE_EXAMPLE_MUTATOR_VERSION);
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'create',
      type: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: 'gex00001',
      payload,
    });
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('deleteGrpcResponseExample', () => {
  it('emits a single delete envelope with no side effects', () => {
    const intent = deleteGrpcResponseExample(ctx(), { grpcResponseExampleUid: 'gex00001' });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'delete',
      type: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: 'gex00001',
    });
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('setGrpcResponseExampleField', () => {
  it('emits a setField at the writable scalar path', () => {
    const intent = setGrpcResponseExampleField(ctx(), {
      grpcResponseExampleUid: 'gex00001',
      path: 'name',
      value: 'renamed',
    });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'setField',
      type: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: 'gex00001',
      path: 'name',
      value: 'renamed',
    });
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('buildRenameGrpcResponseExampleBatch', () => {
  it('emits one setField per defined key and skips undefined values', () => {
    const { batch, sideEffects } = buildRenameGrpcResponseExampleBatch(
      'gex00001',
      { name: 'renamed', path: undefined },
      ctx(),
    );
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toEqual({
      kind: 'setField',
      type: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: 'gex00001',
      path: 'name',
      value: 'renamed',
    });
    expect(sideEffects).toEqual([]);
  });
});

describe('seedGrpcResponseExample / projectGrpcResponseExample', () => {
  it('round-trips through a create envelope + materialized shape', () => {
    const entity = example();
    const batch = seedGrpcResponseExample(entity, ctx());
    expect(batch.mutations).toHaveLength(1);
    const body = batch.mutations[0].body;
    expect(body).toMatchObject({ kind: 'create', type: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE, id: 'gex00001' });
    if (body.kind !== 'create') throw new Error('expected create body');
    const projected = projectGrpcResponseExample({
      type: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: entity.uid,
      data: body.payload as Record<string, unknown>,
      fieldOrigins: {},
    });
    expect(projected).toEqual(entity);
  });

  it('returns null for a foreign entity type', () => {
    expect(projectGrpcResponseExample({ type: 'grpcRequest', id: 'r1', data: {}, fieldOrigins: {} })).toBeNull();
  });
});
