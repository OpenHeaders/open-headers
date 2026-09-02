/**
 * Seed builder for the session-auth-desktop spec — run under tsx (the
 * core schemas are TS source the Playwright loader can't resolve),
 * prints a JSON map of desktop storage values to stdout.
 *
 * Every entity is built as a literal and then validated by the REAL
 * core valibot schema, so a schema change fails this script loudly
 * instead of seeding a shape the app would silently reject.
 *
 * One collection carrying the auth POOL the session tabs inherit from
 * — the widened mask's types: an OAuth 2.0 client-credentials entry
 * against the playground IdP (the default), a JWT Bearer entry in
 * header and in query mode, an AWS SigV4 entry in query mode (the
 * signed URL) and one in header mode (the refusal), an api-key in
 * query — with one WebSocket request per entry against the ws-probe
 * and three gRPC requests against the h2c gRPC probe (the BookService
 * spec seeded beside them).
 *
 * Ports ride OH_E2E_WS_PROBE_PORT / OH_E2E_GRPC_PORT, the IdP origin
 * OH_E2E_PLAYGROUND; the workspace id rides OH_E2E_WORKSPACE_ID.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CollectionSchema, GrpcRequestSchema, SpecSchema, WebSocketRequestSchema } from '@openheaders/core/schemas';
import type { AuthPoolEntry, Collection, GrpcRequest, Spec, WebSocketRequest } from '@openheaders/core/types';
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

const COLLECTION_UID = 'e2esacol';
const SPEC_UID = 'e2esaspc';
const SPEC_FILE_UID = 'e2esafil';
const PROBE_URL = `ws://127.0.0.1:${probePort}/net/ws-probe`;
const SERVICE = 'openheaders.playground.v1.BookService';

/** The pool's material — the spec carries the same literals (it
 *  cannot import this module: the core schemas are TS source the
 *  Playwright loader can't resolve). */
const SESSION_AUTH_POOL = {
  oauth: {
    uid: 'e2esaoa1',
    credentialRef: 'oauth2-cred-e2esa001',
    config: {
      type: 'oauth2',
      credentialRef: 'oauth2-cred-e2esa001',
      flow: 'client-credentials',
      tokenEndpoint: `${playground}/api/oauth/token`,
      clientId: 'oh-client-id',
      clientSecret: 'oh-client-secret',
      scopes: ['read'],
    },
  },
  jwtSecret: 'oh-e2e-session-jwt-secret',
  jwtSubject: 'session-auth-e2e',
  jwtLifetimeSeconds: 120,
  awsAccessKeyId: 'AKIDEXAMPLE',
  awsSecretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
  apiKeyValue: 'e2e-partner-key',
} as const;

const entries: AuthPoolEntry[] = [
  { uid: SESSION_AUTH_POOL.oauth.uid, name: 'Corp SSO', config: SESSION_AUTH_POOL.oauth.config },
  {
    uid: 'e2esajw1',
    name: 'Signer',
    config: {
      type: 'jwt',
      algorithm: 'HS256',
      secret: SESSION_AUTH_POOL.jwtSecret,
      privateKey: '',
      payload: JSON.stringify({ sub: SESSION_AUTH_POOL.jwtSubject }),
      addTo: 'header',
      expiresInSeconds: SESSION_AUTH_POOL.jwtLifetimeSeconds,
    },
  },
  {
    uid: 'e2esajw2',
    name: 'Signer (query)',
    config: {
      type: 'jwt',
      algorithm: 'HS256',
      secret: SESSION_AUTH_POOL.jwtSecret,
      privateKey: '',
      payload: JSON.stringify({ sub: SESSION_AUTH_POOL.jwtSubject }),
      addTo: 'query',
    },
  },
  {
    uid: 'e2esaaw1',
    name: 'Gateway',
    config: {
      type: 'aws-sigv4',
      accessKeyId: SESSION_AUTH_POOL.awsAccessKeyId,
      secretAccessKey: SESSION_AUTH_POOL.awsSecretAccessKey,
      service: 'execute-api',
      region: 'us-east-1',
      addTo: 'query',
    },
  },
  {
    uid: 'e2esaaw2',
    name: 'Gateway (header)',
    config: {
      type: 'aws-sigv4',
      accessKeyId: SESSION_AUTH_POOL.awsAccessKeyId,
      secretAccessKey: SESSION_AUTH_POOL.awsSecretAccessKey,
      service: 'execute-api',
      region: 'us-east-1',
    },
  },
  {
    uid: 'e2esaak1',
    name: 'Partner',
    config: { type: 'api-key', key: 'api_key', value: SESSION_AUTH_POOL.apiKeyValue, in: 'query' },
  },
];

const collection: Collection = v.parse(CollectionSchema, {
  schemaVersion: 5,
  uid: COLLECTION_UID,
  path: `requests/${toFolderName('Session Auth', COLLECTION_UID)}`,
  name: 'Session Auth',
  variables: [],
  auths: entries,
  defaultAuthUid: SESSION_AUTH_POOL.oauth.uid,
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

function websocketRequest(uid: string, name: string, authUid?: string): WebSocketRequest {
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
    auth: { type: 'inherit', ...(authUid !== undefined ? { authUid } : {}) },
  });
}

function grpcRequest(uid: string, name: string, authUid?: string): GrpcRequest {
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
    auth: { type: 'inherit', ...(authUid !== undefined ? { authUid } : {}) },
  });
}

const websocketRequests: WebSocketRequest[] = [
  websocketRequest('e2esaws1', 'OAuth session'),
  websocketRequest('e2esaws2', 'JWT session', 'e2esajw1'),
  websocketRequest('e2esaws3', 'JWT query session', 'e2esajw2'),
  websocketRequest('e2esaws4', 'Signed URL session', 'e2esaaw1'),
  websocketRequest('e2esaws5', 'Signed header session', 'e2esaaw2'),
  websocketRequest('e2esaws6', 'Partner key session', 'e2esaak1'),
];

const grpcRequests: GrpcRequest[] = [
  grpcRequest('e2esagr1', 'GetBook OAuth'),
  grpcRequest('e2esagr2', 'GetBook JWT', 'e2esajw1'),
  grpcRequest('e2esagr3', 'GetBook JWT query', 'e2esajw2'),
];

const values: Record<string, unknown> = {
  [`oh.ws.${workspaceId}.specs`]: [spec],
  [`oh.ws.${workspaceId}.requestCollections`]: [collection],
  [`oh.ws.${workspaceId}.websocketRequests`]: websocketRequests,
  [`oh.ws.${workspaceId}.grpcRequests`]: grpcRequests,
};
process.stdout.write(JSON.stringify(values));
