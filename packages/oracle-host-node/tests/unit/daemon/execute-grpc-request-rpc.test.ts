/**
 * Workbench `executeGrpcRequest` route — the node host's gRPC Invoke
 * over the REAL executor + resolver (entity-store leaves and the
 * storage slots mocked) with an injected fake transport. Pins the
 * handler contract (snapshot passthrough, uid-vs-draft precedence,
 * error mapping) and the executor's pre-wire gates: no method / no
 * spec / method drift / non-unary shape / unresolved variables /
 * malformed message JSON / encode mismatch — every one a structured
 * error snapshot naming the gap, never a throw. On the wire side it
 * pins the transport request shape (authority scheme-strip, TLS flag,
 * path, reserved-metadata filtering, deadline carry) and the response
 * mapping (frame unwrap, status extraction across normal and
 * trailers-only replies, missing-status honesty, Stop cancellation).
 */

import { buildRegistry, encodeMessage, parseProto, writeGrpcFrame } from '@openheaders/core/proto';
import type { Environment, GrpcRequest, Spec, Vault } from '@openheaders/core/types';
import type {
  GrpcTransport,
  GrpcTransportRequest,
  GrpcTransportResponse,
} from '@openheaders/oracle/live/grpc-exec/transport';
import { GrpcTransportError } from '@openheaders/oracle/live/grpc-exec/transport';
import { afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  vault: vi.fn((): Vault => ({ schemaVersion: 5, secrets: [] })),
  environments: vi.fn((): Environment[] => []),
  activeEnvironmentId: vi.fn((): string | null => null),
  storageSlots: new Map<string, unknown[]>(),
}));

vi.mock('@openheaders/oracle/entity/environment-store', () => ({
  getActiveEnvironmentId: () => h.activeEnvironmentId(),
  getDefaultEnvironmentId: () => null,
  getDefaultEnvironmentIdForWorkspace: async () => null,
  getEnvironments: () => h.environments(),
  getEnvironmentsForWorkspace: () => h.environments(),
  getVault: () => h.vault(),
  getVaultForWorkspace: () => h.vault(),
  getWorkspaceVariables: () => ({ schemaVersion: 5, variables: [] }),
  getWorkspaceVariablesForWorkspace: () => ({ schemaVersion: 5, variables: [] }),
}));
vi.mock('@openheaders/oracle/entity/request-store', () => ({
  getRequestCollections: () => [],
  getRequestCollectionsForWorkspace: () => [],
}));
vi.mock('@openheaders/oracle/entity/rule-store', () => ({
  getCollections: () => [],
  getCollectionsForWorkspace: () => [],
}));
vi.mock('@openheaders/oracle/entity/template-store', () => ({
  getTemplateCollections: () => [],
  getTemplateCollectionsForWorkspace: () => [],
}));
vi.mock('@openheaders/oracle/entity/files-store', () => ({
  listFiles: async () => [],
}));
vi.mock('@openheaders/oracle/rule-engine/variables-resolver', () => ({
  getLiveRegistrySnapshot: () => new Map(),
  getLiveRegistrySnapshotForWorkspace: () => new Map(),
}));
vi.mock('@openheaders/oracle/workspace/extension-workspace-store', () => ({
  getActiveWorkspaceId: () => 'ws-active',
}));
vi.mock('@openheaders/oracle/storage', () => ({
  wsKeys: (ws: string) => ({
    grpcRequests: { key: `oh.ws.${ws}.grpcRequests` },
    specs: { key: `oh.ws.${ws}.specs` },
  }),
  hostStorage: {
    getValidatedArray: async (spec: { key: string }) => h.storageSlots.get(spec.key) ?? [],
  },
}));

import { stopActiveSend } from '@openheaders/oracle/live/request-exec/send-stream';
import { handleExecuteGrpcRequestRpc } from '../../../src/daemon/execute-grpc-request-rpc';

const PROTO = `syntax = "proto3";
package library.v1;

service Library {
  rpc GetBook(GetBookRequest) returns (Book);
  rpc WatchBooks(GetBookRequest) returns (stream Book);
}

message GetBookRequest { string name = 1; }
message Book {
  string name = 1;
  string title = 2;
  int64 pages = 3;
}
`;

const REGISTRY = buildRegistry([{ path: 'index.proto', census: parseProto(PROTO) }]);

function makeSpec(overrides: Partial<Spec> = {}): Spec {
  return {
    schemaVersion: 5,
    uid: 'spec00001',
    path: 'specs/library-spec00001',
    name: 'Library API',
    format: 'protobuf',
    rootFileUid: 'file00001',
    files: [{ uid: 'file00001', fileName: 'index.proto', content: PROTO }],
    ...overrides,
  };
}

function makeGrpcRequest(overrides: Partial<GrpcRequest> = {}): GrpcRequest {
  return {
    schemaVersion: 5,
    uid: 'grpc0001',
    path: 'requests/default/get-book-grpc0001',
    name: 'Get Book',
    url: 'grpc.openheaders.io:443',
    tls: true,
    method: { service: 'library.v1.Library', rpc: 'GetBook' },
    message: '{"name": "books/1"}',
    metadata: [],
    specLink: { specUid: 'spec00001' },
    ...overrides,
  };
}

function bookReply(overrides: Partial<GrpcTransportResponse> = {}): GrpcTransportResponse {
  const encoded = encodeMessage(REGISTRY, 'library.v1.Book', {
    name: 'books/1',
    title: 'Wire Ceremony',
    pages: '412',
  });
  return {
    httpStatus: 200,
    headers: [{ key: 'content-type', value: 'application/grpc+proto' }],
    trailers: [
      { key: 'grpc-status', value: '0' },
      { key: 'grpc-message', value: 'OK' },
    ],
    body: writeGrpcFrame(encoded),
    bodyTruncated: false,
    ...overrides,
  };
}

function captureTransport(response: GrpcTransportResponse = bookReply()): {
  transport: GrpcTransport;
  sent: () => GrpcTransportRequest;
  calls: () => number;
} {
  let captured: GrpcTransportRequest | undefined;
  let n = 0;
  const transport: GrpcTransport = {
    async invoke(req): Promise<GrpcTransportResponse> {
      captured = req;
      n += 1;
      return response;
    },
  };
  return {
    transport,
    sent: () => {
      if (!captured) throw new Error('transport.invoke not called');
      return captured;
    },
    calls: () => n,
  };
}

function seedStorage(requests: GrpcRequest[], specs: Spec[], workspace = 'ws-active'): void {
  h.storageSlots.set(`oh.ws.${workspace}.grpcRequests`, requests);
  h.storageSlots.set(`oh.ws.${workspace}.specs`, specs);
}

afterEach(() => {
  h.storageSlots.clear();
  h.vault.mockReset();
  h.vault.mockImplementation(() => ({ schemaVersion: 5, secrets: [] }));
});

describe('handleExecuteGrpcRequestRpc — happy path', () => {
  it('invokes a stored request end to end and maps the reply', async () => {
    seedStorage([makeGrpcRequest()], [makeSpec()]);
    const { transport, sent } = captureTransport();
    const result = await handleExecuteGrpcRequestRpc({ grpcRequestUid: 'grpc0001' }, transport);
    expect(result.success).toBe(true);
    const snapshot = result.snapshot;
    if (!snapshot) throw new Error('no snapshot');
    expect(snapshot.error).toBeNull();
    expect(snapshot.httpStatus).toBe(200);
    expect(snapshot.grpcStatus).toBe(0);
    expect(snapshot.grpcMessage).toBe('OK');
    expect(snapshot.grpcStatusSource).toBe('trailers');
    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.messages[0].compressed).toBe(false);
    expect(snapshot.trailers).toEqual([
      { key: 'grpc-status', value: '0' },
      { key: 'grpc-message', value: 'OK' },
    ]);
    const wire = sent();
    expect(wire.authority).toBe('grpc.openheaders.io:443');
    expect(wire.tls).toBe(true);
    expect(wire.path).toBe('/library.v1.Library/GetBook');
    // The encoded message matches the codec's own encode of the text.
    expect([...wire.message]).toEqual([...encodeMessage(REGISTRY, 'library.v1.GetBookRequest', { name: 'books/1' })]);
  });

  it('prefers the stored request over a draft and a draft over nothing', async () => {
    seedStorage([makeGrpcRequest({ url: 'stored.openheaders.io' })], [makeSpec()]);
    const { transport, sent } = captureTransport();
    await handleExecuteGrpcRequestRpc(
      { grpcRequestUid: 'grpc0001', draft: makeGrpcRequest({ url: 'draft.openheaders.io' }) },
      transport,
    );
    expect(sent().authority).toBe('stored.openheaders.io');

    const draftLeg = captureTransport();
    await handleExecuteGrpcRequestRpc({ draft: makeGrpcRequest({ url: 'draft.openheaders.io' }) }, draftLeg.transport);
    expect(draftLeg.sent().authority).toBe('draft.openheaders.io');
  });

  it('strips a pasted scheme, honors the TLS-off flag, and carries the deadline', async () => {
    seedStorage([], [makeSpec()]);
    const { transport, sent } = captureTransport();
    await handleExecuteGrpcRequestRpc(
      { draft: makeGrpcRequest({ url: 'grpcs://draft.openheaders.io:8443/', tls: false, timeoutMs: 30000 }) },
      transport,
    );
    const wire = sent();
    expect(wire.authority).toBe('draft.openheaders.io:8443');
    expect(wire.tls).toBe(false);
    expect(wire.timeoutMs).toBe(30000);
  });

  it('sends enabled metadata rows and filters reserved / pseudo keys', async () => {
    seedStorage([], [makeSpec()]);
    const { transport, sent } = captureTransport();
    await handleExecuteGrpcRequestRpc(
      {
        draft: makeGrpcRequest({
          metadata: [
            { uid: 'm1', key: 'x-api-key', value: 'k-1' },
            { uid: 'm2', key: 'x-api-key', value: 'k-2' },
            { uid: 'm3', key: 'x-off', value: 'nope', enabled: false },
            { uid: 'm4', key: 'te', value: 'compress' },
            { uid: 'm5', key: ':authority', value: 'spoof' },
            { uid: 'm6', key: 'Content-Type', value: 'text/plain' },
          ],
        }),
      },
      transport,
    );
    expect(sent().metadata).toEqual([
      { key: 'x-api-key', value: 'k-1' },
      { key: 'x-api-key', value: 'k-2' },
    ]);
  });

  it('resolves {{ref}} templates in url, metadata, and message', async () => {
    h.vault.mockImplementation(() => ({
      schemaVersion: 5,
      secrets: [{ uid: 'vlt00001', kind: 'string', name: 'api_token', value: 'tok-123' }],
    }));
    seedStorage([], [makeSpec()]);
    const { transport, sent } = captureTransport();
    const result = await handleExecuteGrpcRequestRpc(
      {
        draft: makeGrpcRequest({
          url: '{{vault.api_token}}.openheaders.io',
          metadata: [{ uid: 'm1', key: 'authorization', value: 'Bearer {{vault.api_token}}' }],
          message: '{"name": "{{vault.api_token}}"}',
        }),
      },
      transport,
    );
    expect(result.snapshot?.error).toBeNull();
    const wire = sent();
    expect(wire.authority).toBe('tok-123.openheaders.io');
    expect(wire.metadata).toEqual([{ key: 'authorization', value: 'Bearer tok-123' }]);
    expect([...wire.message]).toEqual([...encodeMessage(REGISTRY, 'library.v1.GetBookRequest', { name: 'tok-123' })]);
  });

  it('treats an empty message text as the empty message', async () => {
    seedStorage([], [makeSpec()]);
    const { transport, sent } = captureTransport();
    const result = await handleExecuteGrpcRequestRpc({ draft: makeGrpcRequest({ message: '' }) }, transport);
    expect(result.snapshot?.error).toBeNull();
    expect(sent().message.byteLength).toBe(0);
  });
});

describe('handleExecuteGrpcRequestRpc — reply shapes', () => {
  it('maps a trailers-only error reply (status in the initial headers)', async () => {
    seedStorage([], [makeSpec()]);
    const { transport } = captureTransport(
      bookReply({
        headers: [
          { key: 'content-type', value: 'application/grpc+proto' },
          { key: 'grpc-status', value: '5' },
          { key: 'grpc-message', value: 'book%20not%20found' },
        ],
        trailers: [],
        body: new Uint8Array(),
      }),
    );
    const result = await handleExecuteGrpcRequestRpc({ draft: makeGrpcRequest() }, transport);
    const snapshot = result.snapshot;
    if (!snapshot) throw new Error('no snapshot');
    expect(snapshot.error).toBeNull();
    expect(snapshot.grpcStatus).toBe(5);
    expect(snapshot.grpcMessage).toBe('book not found');
    expect(snapshot.grpcStatusSource).toBe('headers');
    expect(snapshot.messages).toHaveLength(0);
  });

  it('surfaces a missing grpc-status as null, never a synthetic OK', async () => {
    seedStorage([], [makeSpec()]);
    const { transport } = captureTransport(bookReply({ trailers: [] }));
    const result = await handleExecuteGrpcRequestRpc({ draft: makeGrpcRequest() }, transport);
    expect(result.snapshot?.grpcStatus).toBeNull();
    expect(result.snapshot?.grpcStatusSource).toBeNull();
    expect(result.snapshot?.messages).toHaveLength(1);
  });

  it('marks a body cut mid-frame as an incomplete tail with prior frames kept', async () => {
    seedStorage([], [makeSpec()]);
    const whole = bookReply();
    const { transport } = captureTransport({
      ...whole,
      body: whole.body.subarray(0, whole.body.byteLength - 2),
      bodyTruncated: true,
    });
    const result = await handleExecuteGrpcRequestRpc({ draft: makeGrpcRequest() }, transport);
    expect(result.snapshot?.incompleteTail).toBe(true);
    expect(result.snapshot?.messages).toHaveLength(0);
    expect(result.snapshot?.bodyTruncated).toBe(true);
    expect(result.snapshot?.bodyCapBytes).toBeGreaterThan(0);
  });

  it('maps a transport failure onto an error snapshot, success stays true', async () => {
    seedStorage([], [makeSpec()]);
    const transport: GrpcTransport = {
      invoke: async () => {
        throw new GrpcTransportError('Connection refused by grpc.openheaders.io:443.');
      },
    };
    const result = await handleExecuteGrpcRequestRpc({ draft: makeGrpcRequest() }, transport);
    expect(result.success).toBe(true);
    expect(result.snapshot?.error).toBe('Connection refused by grpc.openheaders.io:443.');
    expect(result.snapshot?.httpStatus).toBe(0);
  });
});

describe('handleExecuteGrpcRequestRpc — pre-wire gates', () => {
  it('names a missing method', async () => {
    seedStorage([], [makeSpec()]);
    const { transport, calls } = captureTransport();
    const result = await handleExecuteGrpcRequestRpc({ draft: makeGrpcRequest({ method: undefined }) }, transport);
    expect(result.success).toBe(true);
    expect(result.snapshot?.error).toContain('No method selected');
    expect(calls()).toBe(0);
  });

  it('names a missing spec link and a dangling one distinctly', async () => {
    seedStorage([], []);
    const { transport } = captureTransport();
    const unlinked = await handleExecuteGrpcRequestRpc({ draft: makeGrpcRequest({ specLink: undefined }) }, transport);
    expect(unlinked.snapshot?.error).toContain('No Protobuf spec linked');
    const dangling = await handleExecuteGrpcRequestRpc({ draft: makeGrpcRequest() }, transport);
    expect(dangling.snapshot?.error).toContain('no longer exists');
  });

  it('names a method the spec no longer declares', async () => {
    seedStorage([], [makeSpec()]);
    const { transport } = captureTransport();
    const result = await handleExecuteGrpcRequestRpc(
      { draft: makeGrpcRequest({ method: { service: 'library.v1.Library', rpc: 'Vanished' } }) },
      transport,
    );
    expect(result.snapshot?.error).toContain('does not declare library.v1.Library/Vanished');
  });

  it('refuses a non-unary method by its shape name', async () => {
    seedStorage([], [makeSpec()]);
    const { transport } = captureTransport();
    const result = await handleExecuteGrpcRequestRpc(
      { draft: makeGrpcRequest({ method: { service: 'library.v1.Library', rpc: 'WatchBooks' } }) },
      transport,
    );
    expect(result.snapshot?.error).toContain('server-streaming');
  });

  it('refuses unresolved variables naming the refs', async () => {
    seedStorage([], [makeSpec()]);
    const { transport, calls } = captureTransport();
    const result = await handleExecuteGrpcRequestRpc(
      { draft: makeGrpcRequest({ url: '{{env.missing_host}}' }) },
      transport,
    );
    expect(result.snapshot?.error).toContain('env.missing_host');
    expect(calls()).toBe(0);
  });

  it('names malformed message JSON and an encode mismatch distinctly', async () => {
    seedStorage([], [makeSpec()]);
    const { transport } = captureTransport();
    const malformed = await handleExecuteGrpcRequestRpc(
      { draft: makeGrpcRequest({ message: '{not json' }) },
      transport,
    );
    expect(malformed.snapshot?.error).toContain('not valid JSON');
    const mismatch = await handleExecuteGrpcRequestRpc(
      { draft: makeGrpcRequest({ message: '{"nope": true}' }) },
      transport,
    );
    expect(mismatch.snapshot?.error).toContain('library.v1.GetBookRequest');
  });

  it('resolves success: false only for missing input', async () => {
    seedStorage([], [makeSpec()]);
    const { transport } = captureTransport();
    const result = await handleExecuteGrpcRequestRpc({}, transport);
    expect(result).toEqual({ success: false, error: 'No gRPC request or draft provided' });
  });

  it('answers a missing stored uid with an error snapshot', async () => {
    seedStorage([], [makeSpec()]);
    const { transport } = captureTransport();
    const result = await handleExecuteGrpcRequestRpc({ grpcRequestUid: 'gone1234' }, transport);
    expect(result.success).toBe(true);
    expect(result.snapshot?.error).toContain('gone1234 not found');
  });
});

describe('handleExecuteGrpcRequestRpc — streaming shapes', () => {
  it('runs a server-streaming invoke through the stream leg and emits live frames', async () => {
    seedStorage([], [makeSpec()]);
    const transport: GrpcTransport = {
      invoke: () => Promise.reject(new Error('unary invoke not expected')),
      openStream(_request, callbacks) {
        const sent: Uint8Array[] = [];
        queueMicrotask(() => {
          callbacks.onHead(200, [{ key: 'content-type', value: 'application/grpc+proto' }]);
          const reply = encodeMessage(REGISTRY, 'library.v1.Book', { name: 'books/1', title: 'One', pages: '1' });
          callbacks.onData(writeGrpcFrame(reply));
          callbacks.onTrailers([{ key: 'grpc-status', value: '0' }]);
          callbacks.onEnd();
        });
        return {
          sendMessage: (message) => sent.push(message),
          halfClose: () => {},
        };
      },
    };
    const events: Array<{ kind: string }> = [];
    const result = await handleExecuteGrpcRequestRpc(
      {
        draft: makeGrpcRequest({ method: { service: 'library.v1.Library', rpc: 'WatchBooks' } }),
        sendId: 'send-stream-1',
      },
      transport,
      (event) => events.push(event),
    );
    const snapshot = result.snapshot;
    if (!snapshot) throw new Error('no snapshot');
    expect(snapshot.error).toBeNull();
    expect(snapshot.grpcStatus).toBe(0);
    expect(snapshot.messages.map((m) => m.direction)).toEqual(['up', 'down']);
    expect(events.map((e) => e.kind)).toEqual(['head', 'messages', 'end']);
  });
});

describe('handleExecuteGrpcRequestRpc — sendId spine', () => {
  it('registers the send for Stop and maps the abort onto the snapshot', async () => {
    seedStorage([], [makeSpec()]);
    const transport: GrpcTransport = {
      invoke: (_req, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () =>
            reject(new GrpcTransportError('Call aborted before a response arrived.')),
          );
        }),
    };
    const pending = handleExecuteGrpcRequestRpc({ draft: makeGrpcRequest(), sendId: 'send-1' }, transport);
    await vi.waitFor(() => {
      expect(stopActiveSend('send-1')).toBe(true);
    });
    const result = await pending;
    expect(result.snapshot?.error).toBe('Call stopped before a response arrived.');
  });

  it('unregisters the send once settled', async () => {
    seedStorage([], [makeSpec()]);
    const { transport } = captureTransport();
    await handleExecuteGrpcRequestRpc({ draft: makeGrpcRequest(), sendId: 'send-2' }, transport);
    expect(stopActiveSend('send-2')).toBe(false);
  });
});
