/**
 * gRPC invoke executor — the session credential leg: an own bearer,
 * and an INHERITED credential resolved over the ancestor pool chain
 * (the tree-slot walk against a real oracle), composed onto the
 * `authorization` metadata pair (an api-key rides its own key) at the
 * same resolve pass user rows ride; an explicit user row with the
 * same key wins; a resolved type outside the gRPC mask fails the
 * invoke by NAME before the wire; the settled snapshot carries the
 * attribution.
 */

import type { AuthPoolEntry, Collection, Folder, GrpcRequest, Spec } from '@openheaders/core/types';
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

function unaryTransport(): { transport: GrpcTransport; wire: () => GrpcTransportRequest; calls: () => number } {
  let seen: GrpcTransportRequest | null = null;
  let calls = 0;
  return {
    transport: {
      invoke: (request) => {
        seen = request;
        calls += 1;
        return Promise.resolve(OK_REPLY);
      },
    },
    wire: () => {
      if (seen === null) throw new Error('invoke never reached the transport');
      return seen;
    },
    calls: () => calls,
  };
}

const BEARER: AuthPoolEntry = { uid: 'admin001', name: 'Admin token', config: { type: 'bearer', token: 'tok-col' } };
const BASIC: AuthPoolEntry = {
  uid: 'basic001',
  name: 'Service',
  config: { type: 'basic', username: 'u', password: 'p' },
};
const OAUTH: AuthPoolEntry = {
  uid: 'oauth001',
  name: 'Corp SSO',
  config: {
    type: 'oauth2',
    credentialRef: 'oauth2-cred-abc12345',
    flow: 'authorization-code-pkce',
    tokenEndpoint: '',
    clientId: '',
    scopes: [],
  },
};

beforeEach(() => {
  oracle = null;
  requestCollections.mockReturnValue([]);
  requestFolders.mockReturnValue([]);
});

describe('executeGrpcInvoke — session credential', () => {
  it("the request's own bearer injects the authorization pair, attributed to the request", async () => {
    seedChain(makeCollection(), makeFolder());
    const rig = unaryTransport();
    const snapshot = await executeGrpcInvoke(makeGrpcRequest({ auth: { type: 'bearer', token: 'mine' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      spec: SPEC,
    });
    expect(rig.wire().metadata).toEqual([{ key: 'authorization', value: 'Bearer mine' }]);
    expect(snapshot.auth).toEqual({ type: 'bearer', source: { level: 'request' } });
    expect(snapshot.grpcStatus).toBe(0);
  });

  it("Inherit resolves the collection pool's default over the slot walk and stamps the attribution", async () => {
    seedChain(makeCollection({ auths: [BEARER] }), makeFolder());
    const rig = unaryTransport();
    const snapshot = await executeGrpcInvoke(makeGrpcRequest({ auth: { type: 'inherit' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      spec: SPEC,
    });
    expect(rig.wire().metadata).toEqual([{ key: 'authorization', value: 'Bearer tok-col' }]);
    expect(snapshot.auth).toEqual({
      type: 'bearer',
      source: { level: 'collection', uid: 'rcol0001', name: 'API', entryUid: 'admin001', entryName: 'Admin token' },
    });
  });

  it('an inherited Basic pair composes the RFC 7617 authorization pair; a user row with the key wins', async () => {
    seedChain(makeCollection({ auths: [BASIC] }), makeFolder());
    const rig = unaryTransport();
    await executeGrpcInvoke(makeGrpcRequest({ auth: { type: 'inherit' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      spec: SPEC,
    });
    expect(rig.wire().metadata).toEqual([{ key: 'authorization', value: 'Basic dTpw' }]);

    const rowRig = unaryTransport();
    await executeGrpcInvoke(
      makeGrpcRequest({
        auth: { type: 'inherit' },
        metadata: [{ uid: 'm1', key: 'Authorization', value: 'Bearer own-row' }],
      }),
      { workspaceId: null, environmentId: undefined, transport: rowRig.transport, spec: SPEC },
    );
    expect(rowRig.wire().metadata).toEqual([{ key: 'Authorization', value: 'Bearer own-row' }]);
  });

  it('an inherited OAuth 2.0 fails the invoke by name before the wire and carries the attribution', async () => {
    seedChain(makeCollection({ auths: [OAUTH] }), makeFolder());
    const rig = unaryTransport();
    const snapshot = await executeGrpcInvoke(makeGrpcRequest({ auth: { type: 'inherit' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      spec: SPEC,
    });
    expect(snapshot.error).toBe(
      "Inherited OAuth 2.0 from Collection 'API' › Corp SSO cannot be applied to a gRPC call.",
    );
    expect(rig.calls()).toBe(0);
    expect(snapshot.auth).toEqual({
      type: 'oauth2',
      source: { level: 'collection', uid: 'rcol0001', name: 'API', entryUid: 'oauth001', entryName: 'Corp SSO' },
    });
  });
});
