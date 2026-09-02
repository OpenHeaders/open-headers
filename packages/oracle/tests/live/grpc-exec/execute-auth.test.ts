/**
 * gRPC invoke executor — the session credential leg: an own bearer,
 * and an INHERITED credential resolved over the ancestor pool chain
 * (the tree-slot walk against a real oracle), composed onto the
 * `authorization` metadata pair (an api-key rides its own key) at the
 * same resolve pass user rows ride; an explicit user row with the
 * same key wins; a resolved type outside the gRPC mask fails the
 * invoke by NAME before the wire; the settled snapshot carries the
 * attribution. The widened mask: an inherited OAuth 2.0 entry
 * attaches the store bundle (renewed through the host hook when
 * expired) and a JWT Bearer entry mints a verifiable token per
 * invoke; the query placements and a DPoP binding — nothing a
 * metadata pair can carry — refuse by name.
 */

import { createHmac } from 'node:crypto';
import type { OAuth2TokenBundle } from '@openheaders/core/oauth';
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
const tokenStore = vi.hoisted(() => ({
  getTokenBundle: vi.fn<(credentialRef: string, workspaceId?: string) => Promise<OAuth2TokenBundle | null>>(
    async () => null,
  ),
}));
vi.mock('../../../src/entity/oauth-token-store', () => ({
  getTokenBundle: (...args: [string, string?]) => tokenStore.getTokenBundle(...args),
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
const OAUTH2_CONFIG = {
  type: 'oauth2' as const,
  credentialRef: 'oauth2-cred-abc12345',
  flow: 'client-credentials' as const,
  tokenEndpoint: 'https://idp.openheaders.io/token',
  clientId: 'grpc-client',
  scopes: [],
};
const OAUTH: AuthPoolEntry = { uid: 'oauth001', name: 'Corp SSO', config: OAUTH2_CONFIG };
const JWT: AuthPoolEntry = {
  uid: 'jwt00001',
  name: 'Signer',
  config: {
    type: 'jwt',
    algorithm: 'HS256',
    secret: 'oh-jwt-secret',
    privateKey: '',
    payload: '{"sub":"grpc-call"}',
    addTo: 'header',
    expiresInSeconds: 60,
  },
};

const bundle = (accessToken: string, expiresAt: number | null = null): OAuth2TokenBundle => ({
  accessToken,
  tokenType: 'Bearer',
  expiresAt,
  issuedAt: 0,
});

/** Verify an HS256 compact JWT under the secret; returns its claims. */
function verifyHs256(jwt: string, secret: string): Record<string, unknown> {
  const [head, body, sig] = jwt.split('.');
  expect(createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url')).toBe(sig);
  return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
}

beforeEach(() => {
  oracle = null;
  requestCollections.mockReturnValue([]);
  requestFolders.mockReturnValue([]);
  tokenStore.getTokenBundle.mockReset();
  tokenStore.getTokenBundle.mockResolvedValue(null);
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

  it('an inherited OAuth 2.0 entry attaches the store bundle as the authorization pair; no bundle attaches nothing', async () => {
    seedChain(makeCollection({ auths: [OAUTH] }), makeFolder());
    tokenStore.getTokenBundle.mockResolvedValue(bundle('at-1'));
    const rig = unaryTransport();
    const snapshot = await executeGrpcInvoke(makeGrpcRequest({ auth: { type: 'inherit' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      spec: SPEC,
    });
    expect(rig.wire().metadata).toEqual([{ key: 'authorization', value: 'Bearer at-1' }]);
    expect(tokenStore.getTokenBundle).toHaveBeenCalledWith('oauth2-cred-abc12345', undefined);
    expect(snapshot.requestMetadata).toEqual([{ key: 'authorization', value: 'Bearer at-1' }]);
    expect(snapshot.auth).toEqual({
      type: 'oauth2',
      source: { level: 'collection', uid: 'rcol0001', name: 'API', entryUid: 'oauth001', entryName: 'Corp SSO' },
    });

    tokenStore.getTokenBundle.mockResolvedValue(null);
    const bare = unaryTransport();
    await executeGrpcInvoke(makeGrpcRequest({ auth: { type: 'inherit' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: bare.transport,
      spec: SPEC,
    });
    expect(bare.wire().metadata).toEqual([]);
    expect(tokenStore.getTokenBundle).toHaveBeenLastCalledWith('oauth2-cred-abc12345', undefined);
  });

  it('an expired renewable bundle renews through the host hook before the invoke', async () => {
    seedChain(makeCollection({ auths: [OAUTH] }), makeFolder());
    tokenStore.getTokenBundle.mockResolvedValue(bundle('stale', 1_000));
    const refreshOAuth = vi.fn(async () => bundle('fresh'));
    const rig = unaryTransport();
    await executeGrpcInvoke(makeGrpcRequest({ auth: { type: 'inherit' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      spec: SPEC,
      refreshOAuth,
    });
    expect(refreshOAuth).toHaveBeenCalledWith(OAUTH2_CONFIG);
    expect(rig.wire().metadata).toEqual([{ key: 'authorization', value: 'Bearer fresh' }]);
  });

  it('an inherited JWT Bearer mints a verifiable token per invoke onto the authorization pair', async () => {
    seedChain(makeCollection({ auths: [JWT] }), makeFolder());
    const before = Math.floor(Date.now() / 1000);
    const rig = unaryTransport();
    const snapshot = await executeGrpcInvoke(makeGrpcRequest({ auth: { type: 'inherit' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      spec: SPEC,
    });
    const [pair] = rig.wire().metadata;
    expect(pair.key).toBe('authorization');
    expect(pair.value.startsWith('Bearer ')).toBe(true);
    const claims = verifyHs256(pair.value.slice('Bearer '.length), 'oh-jwt-secret');
    expect(claims.sub).toBe('grpc-call');
    expect(claims.iat).toBeGreaterThanOrEqual(before);
    expect(claims.exp).toBe((claims.iat as number) + 60);
    expect(snapshot.auth?.type).toBe('jwt');
  });

  it('the query placements and a DPoP binding refuse by name before the wire, attribution stamped', async () => {
    const refusals: Array<[AuthPoolEntry, string]> = [
      [
        { uid: 'jwt00001', name: 'Signer', config: { ...JWT.config, addTo: 'query' } as AuthPoolEntry['config'] },
        "Inherited JWT Bearer in query from Collection 'API' › Signer cannot be applied to a gRPC call.",
      ],
      [
        { uid: 'oauth001', name: 'Corp SSO', config: { ...OAUTH2_CONFIG, sendAs: 'query' } },
        "Inherited OAuth 2.0 in query from Collection 'API' › Corp SSO cannot be applied to a gRPC call.",
      ],
      [
        { uid: 'oauth001', name: 'Corp SSO', config: { ...OAUTH2_CONFIG, tokenBinding: 'dpop' } },
        "Inherited OAuth 2.0 bound to a DPoP key from Collection 'API' › Corp SSO cannot be applied to a gRPC call.",
      ],
      [
        {
          uid: 'aws00001',
          name: 'Gateway',
          config: {
            type: 'aws-sigv4',
            accessKeyId: 'a',
            secretAccessKey: 's',
            service: '',
            region: '',
            addTo: 'query',
          },
        },
        "Inherited AWS Signature v4 from Collection 'API' › Gateway cannot be applied to a gRPC call.",
      ],
    ];
    for (const [entry, error] of refusals) {
      seedChain(makeCollection({ auths: [entry] }), makeFolder());
      const rig = unaryTransport();
      const snapshot = await executeGrpcInvoke(makeGrpcRequest({ auth: { type: 'inherit' } }), {
        workspaceId: null,
        environmentId: undefined,
        transport: rig.transport,
        spec: SPEC,
      });
      expect(snapshot.error).toBe(error);
      expect(rig.calls()).toBe(0);
      expect(snapshot.auth?.type).toBe(entry.config.type);
    }
    expect(tokenStore.getTokenBundle).not.toHaveBeenCalled();
  });
});
