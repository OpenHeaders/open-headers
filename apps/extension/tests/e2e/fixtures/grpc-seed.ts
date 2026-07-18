/**
 * Seed builder for the grpc-forwarded spec — run under tsx (the core
 * schemas are TS source the Playwright loader can't resolve), prints a
 * JSON map of daemon storage values to stdout.
 *
 * Every entity is built as a literal and then validated by the REAL
 * core valibot schema, so a schema change fails this script loudly
 * instead of seeding a shape the daemon would silently reject.
 *
 * The daemon hydrates its entity caches straight from these
 * `oh.ws.<id>.*` slots (plain entity arrays — the canonical persisted
 * form), and the joined extension replicates them down the WS pipe.
 *
 * Ports ride env: OH_E2E_GRPC_PORT (h2c probe) and
 * OH_E2E_GRPC_TLS_PORT (the self-signed terminator for the E8 leg).
 * The workspace id rides OH_E2E_WORKSPACE_ID (learned from the booted
 * daemon before seeding).
 *
 * The bearer legs use LITERAL tokens — template resolution on the
 * forwarded path is unit-pinned in the daemon handler matrix; the e2e
 * asserts which credential actually reached the wire via the probe's
 * `x-echo-authorization` mirror.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CollectionSchema, GrpcRequestSchema, SpecSchema } from '@openheaders/core/schemas';
import type { Collection, GrpcRequest, Spec } from '@openheaders/core/types';
import { toFolderName } from '@openheaders/core/utils';
import * as v from 'valibot';

const grpcPort = Number(process.env.OH_E2E_GRPC_PORT ?? 3230);
const tlsPort = Number(process.env.OH_E2E_GRPC_TLS_PORT ?? 3231);
const workspaceId = process.env.OH_E2E_WORKSPACE_ID;
if (!workspaceId) throw new Error('OH_E2E_WORKSPACE_ID is required');

const PROTO_PATH = fileURLToPath(
  new URL('../../../../../playground/fixtures/grpc/book_service.proto', import.meta.url),
);

const SPEC_UID = 'e2espec1';
const SPEC_FILE_UID = 'e2efile1';
const COLLECTION_UID = 'e2ecol01';

const spec: Spec = v.parse(SpecSchema, {
  schemaVersion: 5,
  uid: SPEC_UID,
  path: `specs/${toFolderName('BookService', SPEC_UID)}`,
  name: 'BookService',
  format: 'protobuf',
  rootFileUid: SPEC_FILE_UID,
  files: [{ uid: SPEC_FILE_UID, fileName: 'book_service.proto', content: readFileSync(PROTO_PATH, 'utf8') }],
});

const collection: Collection = v.parse(CollectionSchema, {
  schemaVersion: 5,
  uid: COLLECTION_UID,
  path: `requests/${toFolderName('Probe Books', COLLECTION_UID)}`,
  name: 'Probe Books',
  variables: [],
});

const SERVICE = 'openheaders.playground.v1.BookService';

function grpcRequest(
  uid: string,
  name: string,
  rpc: string,
  message: string,
  extra: Partial<GrpcRequest> = {},
): GrpcRequest {
  return v.parse(GrpcRequestSchema, {
    schemaVersion: 5,
    uid,
    path: `${collection.path}/${toFolderName(name, uid)}`,
    name,
    url: `127.0.0.1:${grpcPort}`,
    tls: false,
    method: { service: SERVICE, rpc },
    message,
    metadata: [],
    specLink: { specUid: SPEC_UID },
    ...extra,
  });
}

const grpcRequests: GrpcRequest[] = [
  grpcRequest('e2egrpc1', 'GetBook', 'GetBook', '{"name":"books/1"}'),
  grpcRequest('e2egrpc2', 'WatchBooks', 'WatchBooks', '{"shelf":"books","count":3,"intervalMs":50}'),
  grpcRequest('e2egrpc3', 'WatchBooksSlow', 'WatchBooks', '{"shelf":"books","count":40,"intervalMs":250}'),
  grpcRequest('e2egrpc4', 'UploadBooks', 'UploadBooks', '{"book":{"name":"books/e2e-1"}}'),
  grpcRequest('e2egrpc5', 'Chat', 'Chat', '{"author":"e2e","text":"hello"}'),
  grpcRequest('e2egrpc6', 'GetBookAuth', 'GetBook', '{"name":"books/1"}', {
    auth: { type: 'bearer', token: 'e2e-secret-token' },
  }),
  grpcRequest('e2egrpc7', 'GetBookAuthRow', 'GetBook', '{"name":"books/1"}', {
    auth: { type: 'bearer', token: 'e2e-secret-token' },
    metadata: [{ uid: 'e2emeta1', key: 'authorization', value: 'Bearer explicit-row-wins', enabled: true }],
  }),
  grpcRequest('e2egrpc8', 'GetBookTls', 'GetBook', '{"name":"books/1"}', {
    url: `127.0.0.1:${tlsPort}`,
    tls: true,
  }),
];

const values: Record<string, unknown> = {
  [`oh.ws.${workspaceId}.specs`]: [spec],
  [`oh.ws.${workspaceId}.requestCollections`]: [collection],
  [`oh.ws.${workspaceId}.grpcRequests`]: grpcRequests,
};

process.stdout.write(JSON.stringify(values));
