/**
 * gRPC invoke executor — the inherited settings over the tree-slot
 * walk against a real oracle: a knob the request leaves absent reads
 * the nearest ancestor that sets it and reaches the transport (the
 * call deadline, the channel keepalive pair, TLS verification, the
 * response cap); the request's own knob shadows it; the snapshot
 * carries the ancestor-supplied knobs in the gRPC key order on the
 * reply AND the failure paths; a collection's HTTP-only knob never
 * reaches the call.
 */

import type { Collection, Folder, GrpcRequest, Spec } from '@openheaders/core/types';
import { executeGrpcInvoke } from '@openheaders/oracle/live/grpc-exec/execute';
import type {
  GrpcTransport,
  GrpcTransportRequest,
  GrpcTransportResponse,
} from '@openheaders/oracle/live/grpc-exec/transport';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntityOracle } from '../../../src/sync/oracle';
import { slotLeaf, treeOracleFrom } from '../request-exec/tree-oracle';

const requestCollections = vi.fn<() => Collection[]>(() => []);
const requestFolders = vi.fn<() => Folder[]>(() => []);
let oracle: EntityOracle | null = null;

vi.mock(import('../../../src/entity/request-store'), async (importOriginal) => ({
  ...(await importOriginal()),
  getRequestCollections: () => requestCollections(),
  getRequestCollectionsForWorkspace: () => requestCollections(),
  getRequestFolders: () => requestFolders(),
  getRequestFoldersForWorkspace: () => requestFolders(),
}));
vi.mock(import('../../../src/sync/service/accessors'), async (importOriginal) => ({
  ...(await importOriginal()),
  getOracleForCurrentWorkspace: () => oracle,
  getOracleForWorkspace: () => oracle,
}));

const PROTO = `syntax = "proto3";
package library.v1;

service Library {
  rpc GetNote(Note) returns (Note);
}

message Note { string text = 1; }
`;

const SPEC: Spec = {
  schemaVersion: 5,
  uid: 'spec0001',
  path: 'specs/library-spec0001',
  name: 'Library',
  format: 'protobuf',
  rootFileUid: 'file0001',
  files: [{ uid: 'file0001', fileName: 'index.proto', content: PROTO }],
};

function makeCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    schemaVersion: 5,
    uid: 'rcol0001',
    path: 'requests/api-rcol0001',
    name: 'API',
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
    ...overrides,
  };
}

function makeFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    schemaVersion: 5,
    uid: 'rfold001',
    path: 'requests/api-rcol0001/calls-rfold001',
    name: 'Calls',
    ...overrides,
  };
}

function makeGrpcRequest(overrides: Partial<GrpcRequest> = {}): GrpcRequest {
  return {
    schemaVersion: 5,
    uid: 'grpc0001',
    path: 'requests/api-rcol0001/calls-rfold001/note-grpc0001',
    name: 'GetNote',
    url: 'grpc.openheaders.io:443',
    tls: true,
    method: { service: 'library.v1.Library', rpc: 'GetNote' },
    message: '{"text":"hi"}',
    metadata: [],
    ...overrides,
  };
}

/** Seed the tree and slot the gRPC leaf under the folder — every leaf
 *  kind slots under the one request tree. */
function seedChain(collection: Collection, folder: Folder): void {
  requestCollections.mockReturnValue([collection]);
  requestFolders.mockReturnValue([folder]);
  const tree = treeOracleFrom([collection], [folder]);
  oracle = tree.oracle;
  slotLeaf(tree.store, 'grpc0001', { type: 'request-folder', uid: folder.uid });
}

const OK_REPLY: GrpcTransportResponse = {
  httpStatus: 200,
  headers: [],
  trailers: [{ key: 'grpc-status', value: '0' }],
  body: new Uint8Array(0),
  bodyTruncated: false,
};

function unaryTransport(reply: () => Promise<GrpcTransportResponse> = () => Promise.resolve(OK_REPLY)): {
  transport: GrpcTransport;
  wire: () => GrpcTransportRequest;
} {
  let seen: GrpcTransportRequest | null = null;
  return {
    transport: {
      invoke: (request) => {
        seen = request;
        return reply();
      },
    },
    wire: () => {
      if (seen === null) throw new Error('invoke never reached the transport');
      return seen;
    },
  };
}

const OPTIONS = { workspaceId: null, environmentId: undefined, spec: SPEC } as const;

beforeEach(() => {
  oracle = null;
  requestCollections.mockReturnValue([]);
  requestFolders.mockReturnValue([]);
});

describe('executeGrpcInvoke — inherited settings', () => {
  it("an ancestor's knob reaches the transport; the innermost level wins; an HTTP-only knob stays out; the reply attributes them in key order", async () => {
    seedChain(
      makeCollection({
        settings: {
          grpc: { timeoutMs: 8_000, keepaliveIntervalMs: 15_000, sslVerification: false },
          http: { httpVersion: '2', timeoutMs: 1_000 },
        },
      }),
      makeFolder({ settings: { grpc: { timeoutMs: 2_000 } } }),
    );
    const rig = unaryTransport();
    const snapshot = await executeGrpcInvoke(makeGrpcRequest({ maxResponseBytes: 512 }), {
      ...OPTIONS,
      transport: rig.transport,
    });
    const wire = rig.wire();
    expect(wire.timeoutMs).toBe(2_000);
    expect(wire.keepaliveIntervalMs).toBe(15_000);
    expect(wire.sslVerification).toBe(false);
    expect(wire.maxBodyBytes).toBe(512);
    expect('httpVersion' in wire).toBe(false);
    expect(snapshot.grpcStatus).toBe(0);
    expect(snapshot.inheritedSettings).toEqual([
      { key: 'sslVerification', level: 'collection', uid: 'rcol0001', name: 'API' },
      { key: 'timeoutMs', level: 'folder', uid: 'rfold001', name: 'Calls' },
      { key: 'keepaliveIntervalMs', level: 'collection', uid: 'rcol0001', name: 'API' },
    ]);
  });

  it("the request's own knob shadows the chain's and drops out of the attribution", async () => {
    seedChain(makeCollection({ settings: { grpc: { timeoutMs: 8_000, keepaliveTimeoutMs: 3_000 } } }), makeFolder());
    const rig = unaryTransport();
    const snapshot = await executeGrpcInvoke(makeGrpcRequest({ timeoutMs: 500 }), {
      ...OPTIONS,
      transport: rig.transport,
    });
    expect(rig.wire().timeoutMs).toBe(500);
    expect(rig.wire().keepaliveTimeoutMs).toBe(3_000);
    expect(snapshot.inheritedSettings).toEqual([
      { key: 'keepaliveTimeoutMs', level: 'collection', uid: 'rcol0001', name: 'API' },
    ]);
  });

  it('a transport failure stamps the attribution too; no ancestor knob = no attribution', async () => {
    seedChain(makeCollection({ settings: { grpc: { timeoutMs: 8_000 } } }), makeFolder());
    const failing = unaryTransport(() => Promise.reject(new Error('connection refused')));
    const failed = await executeGrpcInvoke(makeGrpcRequest(), { ...OPTIONS, transport: failing.transport });
    expect(failed.error).toBe('connection refused');
    expect(failed.inheritedSettings).toEqual([{ key: 'timeoutMs', level: 'collection', uid: 'rcol0001', name: 'API' }]);

    seedChain(makeCollection(), makeFolder());
    const rig = unaryTransport();
    const snapshot = await executeGrpcInvoke(makeGrpcRequest(), { ...OPTIONS, transport: rig.transport });
    expect(rig.wire().timeoutMs).toBeUndefined();
    expect(snapshot.inheritedSettings).toBeUndefined();
  });
});
