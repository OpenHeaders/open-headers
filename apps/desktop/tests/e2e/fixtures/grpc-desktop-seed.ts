/**
 * Seed builder for the grpc-desktop spec — run under tsx (the core
 * schemas are TS source the Playwright loader can't resolve), prints a
 * JSON map of desktop storage values to stdout.
 *
 * Every entity is built as a literal and then validated by the REAL
 * core valibot schema, so a schema change fails this script loudly
 * instead of seeding a shape the app would silently reject.
 *
 * One request per D-leg of the combined live pass: unary happy path,
 * trailers-only NOT_FOUND, INVALID_ARGUMENT, deadline (timeoutMs below
 * the probe's delay), server stream, client stream, bidi, and a
 * vanished-method request whose rpc the spec never declared (the D8
 * unresolved-group gate).
 *
 * The probe port rides OH_E2E_GRPC_PORT (the playground's h2c gRPC
 * probe — 3130 when the Playwright webServer boots it). The workspace
 * id rides OH_E2E_WORKSPACE_ID (learned from the booted app before
 * seeding).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CollectionSchema, GrpcRequestSchema, SpecSchema } from '@openheaders/core/schemas';
import type { Collection, GrpcRequest, Spec } from '@openheaders/core/types';
import { toFolderName } from '@openheaders/core/utils';
import * as v from 'valibot';

const grpcPort = Number(process.env.OH_E2E_GRPC_PORT ?? 3130);
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
  grpcRequest('e2egrpd1', 'GetBook', 'GetBook', '{"name":"books/1"}'),
  grpcRequest('e2egrpd2', 'GetBookMissing', 'GetBook', '{"name":"books/missing"}'),
  grpcRequest('e2egrpd3', 'GetBookEmpty', 'GetBook', '{"name":""}'),
  grpcRequest('e2egrpd4', 'DelayedBook', 'DelayedBook', '{"name":"books/1","delayMs":3000}', { timeoutMs: 1000 }),
  grpcRequest('e2egrpd5', 'WatchBooks', 'WatchBooks', '{"shelf":"books","count":3,"intervalMs":50}'),
  grpcRequest('e2egrpd6', 'UploadBooks', 'UploadBooks', '{"book":{"name":"books/e2e-1"}}'),
  grpcRequest('e2egrpd7', 'Chat', 'Chat', '{"author":"e2e","text":"hello"}'),
  grpcRequest('e2egrpd8', 'RemovedRpc', 'RemovedRpc', '{}'),
];

const values: Record<string, unknown> = {
  [`oh.ws.${workspaceId}.specs`]: [spec],
  [`oh.ws.${workspaceId}.requestCollections`]: [collection],
  [`oh.ws.${workspaceId}.grpcRequests`]: grpcRequests,
};

process.stdout.write(JSON.stringify(values));
