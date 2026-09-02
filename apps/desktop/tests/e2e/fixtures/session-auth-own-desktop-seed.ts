/**
 * Seed builder for the session-auth-own-desktop spec — run under tsx
 * (the core schemas are TS source the Playwright loader can't
 * resolve), prints a JSON map of desktop storage values to stdout.
 *
 * Every entity is built as a literal and then validated by the REAL
 * core valibot schema, so a schema change fails this script loudly
 * instead of seeding a shape the app would silently reject — here the
 * widened own-auth schemas: the session requests carry their OWN
 * configs (an OAuth 2.0 client-credentials config against the
 * playground IdP, a JWT Bearer in header mode, an api-key in query
 * mode) under a collection with NO pool, so nothing above the request
 * could have supplied the credential. Two WebSocket requests against
 * the ws-probe, three gRPC requests against the h2c gRPC probe (the
 * BookService spec seeded beside them).
 *
 * Ports ride OH_E2E_WS_PROBE_PORT / OH_E2E_GRPC_PORT, the IdP origin
 * OH_E2E_PLAYGROUND; the workspace id rides OH_E2E_WORKSPACE_ID.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CollectionSchema, GrpcRequestSchema, SpecSchema, WebSocketRequestSchema } from '@openheaders/core/schemas';
import type { Collection, GrpcAuth, GrpcRequest, Spec, WebSocketAuth, WebSocketRequest } from '@openheaders/core/types';
import { toFolderName } from '@openheaders/core/utils';
import * as v from 'valibot';

const probePort = Number(process.env.OH_E2E_WS_PROBE_PORT ?? 3000);
const grpcPort = Number(process.env.OH_E2E_GRPC_PORT ?? 3130);
const playground = process.env.OH_E2E_PLAYGROUND ?? 'http://127.0.0.1:3000';
const workspaceId = process.env.OH_E2E_WORKSPACE_ID;
if (!workspaceId) throw new Error('OH_E2E_WORKSPACE_ID is required');

const PROTO_PATH = fileURLToPath(
  new URL('../../../../../playground/fixtures/grpc/book_service.proto', import.meta.url),
);

const COLLECTION_UID = 'e2eowcol';
const SPEC_UID = 'e2eowspc';
const SPEC_FILE_UID = 'e2eowfil';
const PROBE_URL = `ws://127.0.0.1:${probePort}/net/ws-probe`;
const SERVICE = 'openheaders.playground.v1.BookService';

/** The requests' own material — the spec carries the same literals
 *  (it cannot import this module: the core schemas are TS source the
 *  Playwright loader can't resolve). */
const OWN_AUTH = {
  oauth: {
    type: 'oauth2',
    credentialRef: 'oauth2-cred-e2eown01',
    flow: 'client-credentials',
    tokenEndpoint: `${playground}/api/oauth/token`,
    clientId: 'oh-client-id',
    clientSecret: 'oh-client-secret',
    scopes: ['read'],
  },
  jwt: {
    type: 'jwt',
    algorithm: 'HS256',
    secret: 'oh-e2e-own-jwt-secret',
    privateKey: '',
    payload: JSON.stringify({ sub: 'session-auth-own-e2e' }),
    addTo: 'header',
    expiresInSeconds: 120,
  },
  apiKeyQuery: { type: 'api-key', key: 'api_key', value: 'e2e-own-key', in: 'query' },
} as const satisfies Record<string, GrpcAuth | WebSocketAuth>;

const collection: Collection = v.parse(CollectionSchema, {
  schemaVersion: 5,
  uid: COLLECTION_UID,
  path: `requests/${toFolderName('Own Auth', COLLECTION_UID)}`,
  name: 'Own Auth',
  variables: [],
});

const spec: Spec = v.parse(SpecSchema, {
  schemaVersion: 5,
  uid: SPEC_UID,
  path: `specs/${toFolderName('BookService', SPEC_UID)}`,
  name: 'BookService',
  format: 'protobuf',
  rootFileUid: SPEC_FILE_UID,
  files: [{ uid: SPEC_FILE_UID, fileName: 'book_service.proto', content: readFileSync(PROTO_PATH, 'utf8') }],
});

function websocketRequest(uid: string, name: string, auth: WebSocketAuth): WebSocketRequest {
  return v.parse(WebSocketRequestSchema, {
    schemaVersion: 5,
    uid,
    path: `${collection.path}/${toFolderName(name, uid)}`,
    name,
    url: PROBE_URL,
    flavor: 'raw',
    subprotocols: [],
    headers: [],
    params: [],
    message: '',
    messageFormat: 'text',
    auth,
  });
}

function grpcRequest(uid: string, name: string, auth: GrpcAuth): GrpcRequest {
  return v.parse(GrpcRequestSchema, {
    schemaVersion: 5,
    uid,
    path: `${collection.path}/${toFolderName(name, uid)}`,
    name,
    url: `127.0.0.1:${grpcPort}`,
    tls: false,
    method: { service: SERVICE, rpc: 'GetBook' },
    message: '{"name":"books/1"}',
    metadata: [],
    specLink: { specUid: SPEC_UID },
    auth,
  });
}

const websocketRequests: WebSocketRequest[] = [
  websocketRequest('e2eowws1', 'Own OAuth session', OWN_AUTH.oauth),
  websocketRequest('e2eowws2', 'Own JWT session', OWN_AUTH.jwt),
];

const grpcRequests: GrpcRequest[] = [
  grpcRequest('e2eowgr1', 'GetBook own OAuth', OWN_AUTH.oauth),
  grpcRequest('e2eowgr2', 'GetBook own JWT', OWN_AUTH.jwt),
  grpcRequest('e2eowgr3', 'GetBook own query key', OWN_AUTH.apiKeyQuery),
];

const values: Record<string, unknown> = {
  [`oh.ws.${workspaceId}.specs`]: [spec],
  [`oh.ws.${workspaceId}.requestCollections`]: [collection],
  [`oh.ws.${workspaceId}.websocketRequests`]: websocketRequests,
  [`oh.ws.${workspaceId}.grpcRequests`]: grpcRequests,
};
process.stdout.write(JSON.stringify(values));
