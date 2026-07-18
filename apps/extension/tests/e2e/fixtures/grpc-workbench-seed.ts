/**
 * Seed builder for the grpc-workbench spec — run under tsx (the core
 * schemas are TS source the Playwright loader can't resolve), prints a
 * JSON map of daemon storage values to stdout.
 *
 * Every entity is built as a literal and then validated by the REAL
 * core valibot schema, so a schema change fails this script loudly
 * instead of seeding a shape the daemon would silently reject.
 *
 * Two protobuf specs drive the generation legs: the playground
 * BookService (single service — the flat-landing law) and an inline
 * two-service suite (folder-per-service law). The seeded collection
 * carries a ready-to-invoke GetBook + WatchBooks pair for the Docs and
 * Save Response legs.
 *
 * Ports ride env: OH_E2E_GRPC_PORT (h2c probe). The workspace id rides
 * OH_E2E_WORKSPACE_ID (learned from the booted daemon before seeding).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CollectionSchema, GrpcRequestSchema, SpecSchema } from '@openheaders/core/schemas';
import type { Collection, GrpcRequest, Spec } from '@openheaders/core/types';
import { toFolderName } from '@openheaders/core/utils';
import * as v from 'valibot';

const grpcPort = Number(process.env.OH_E2E_GRPC_PORT ?? 3330);
const workspaceId = process.env.OH_E2E_WORKSPACE_ID;
if (!workspaceId) throw new Error('OH_E2E_WORKSPACE_ID is required');

const PROTO_PATH = fileURLToPath(
  new URL('../../../../../playground/fixtures/grpc/book_service.proto', import.meta.url),
);

const BOOK_SPEC_UID = 'e2espec1';
const BOOK_SPEC_FILE_UID = 'e2efile1';
const SHELF_SPEC_UID = 'e2espec2';
const SHELF_SPEC_FILE_UID = 'e2efile2';
const COLLECTION_UID = 'e2ecol01';

// Two services in one file — the generation modal must folder them.
const SHELF_SUITE_PROTO = `syntax = "proto3";

package openheaders.e2e;

service LibraryService {
  rpc GetShelf(ShelfRequest) returns (Shelf);
}

service ShelfService {
  rpc ListShelves(ShelfRequest) returns (Shelf);
}

message ShelfRequest {
  string name = 1;
}

message Shelf {
  string name = 1;
  int32 book_count = 2;
}
`;

const bookSpec: Spec = v.parse(SpecSchema, {
  schemaVersion: 5,
  uid: BOOK_SPEC_UID,
  path: `specs/${toFolderName('BookService', BOOK_SPEC_UID)}`,
  name: 'BookService',
  format: 'protobuf',
  rootFileUid: BOOK_SPEC_FILE_UID,
  files: [{ uid: BOOK_SPEC_FILE_UID, fileName: 'book_service.proto', content: readFileSync(PROTO_PATH, 'utf8') }],
});

const shelfSpec: Spec = v.parse(SpecSchema, {
  schemaVersion: 5,
  uid: SHELF_SPEC_UID,
  path: `specs/${toFolderName('ShelfSuite', SHELF_SPEC_UID)}`,
  name: 'ShelfSuite',
  format: 'protobuf',
  rootFileUid: SHELF_SPEC_FILE_UID,
  files: [{ uid: SHELF_SPEC_FILE_UID, fileName: 'shelf_suite.proto', content: SHELF_SUITE_PROTO }],
});

const collection: Collection = v.parse(CollectionSchema, {
  schemaVersion: 5,
  uid: COLLECTION_UID,
  path: `requests/${toFolderName('Probe Books', COLLECTION_UID)}`,
  name: 'Probe Books',
  variables: [],
});

const SERVICE = 'openheaders.playground.v1.BookService';

function grpcRequest(uid: string, name: string, rpc: string, message: string): GrpcRequest {
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
    specLink: { specUid: BOOK_SPEC_UID },
  });
}

const grpcRequests: GrpcRequest[] = [
  grpcRequest('e2egrpc1', 'GetBook', 'GetBook', '{"name":"books/1"}'),
  grpcRequest('e2egrpc2', 'WatchBooks', 'WatchBooks', '{"shelf":"books","count":3,"intervalMs":50}'),
];

const values: Record<string, unknown> = {
  [`oh.ws.${workspaceId}.specs`]: [bookSpec, shelfSpec],
  [`oh.ws.${workspaceId}.requestCollections`]: [collection],
  [`oh.ws.${workspaceId}.grpcRequests`]: grpcRequests,
};

process.stdout.write(JSON.stringify(values));
