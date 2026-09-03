/**
 * Seed builder for the session-scripts-grpc-desktop spec — run under
 * tsx (the core schemas are TS source the Playwright loader can't
 * resolve), prints a JSON map of desktop storage values to stdout.
 *
 * Every entity is built as a literal and then validated by the REAL
 * core valibot schema, so a schema change fails this script loudly
 * instead of seeding a shape the app would silently reject — here the
 * gRPC call script slots: the BookService spec, a collection carrying
 * a gRPC Before invoke slot (the ancestor level every request under
 * it composes ahead of its own — it sets the `authorization` metadata
 * the probe mirrors back as `x-echo-authorization`), and three gRPC
 * requests against the playground's h2c probe carrying their own
 * slots — the unary leg, the server-stream leg, the bidi leg.
 *
 * The probe port rides OH_E2E_GRPC_PORT; the workspace id rides
 * OH_E2E_WORKSPACE_ID.
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

const SPEC_UID = 'e2esgspc';
const SPEC_FILE_UID = 'e2esgfil';
const COLLECTION_UID = 'e2esgcol';

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
  path: `requests/${toFolderName('Scripted Books', COLLECTION_UID)}`,
  name: 'Scripted Books',
  variables: [],
  // The collection's Before invoke runs ahead of every request's own —
  // it sets the authorization metadata the probe mirrors back, so the
  // echoed pair proves the ancestor level rewrote the call.
  scripts: { 'grpc-before-invoke': `oh.setMetadata('authorization', 'Bearer scripted-by-collection');` },
});

const SERVICE = 'openheaders.playground.v1.BookService';

function grpcRequest(
  uid: string,
  name: string,
  rpc: string,
  message: string,
  scripts: NonNullable<GrpcRequest['scripts']>,
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
    scripts,
  });
}

const grpcRequests: GrpcRequest[] = [
  // S1: unary — the request's own Before invoke composes after the
  // collection's and logs the call it saw; On message reads the
  // decoded reply; After response asserts on the status.
  grpcRequest('e2esgr01', 'Scripted GetBook', 'GetBook', '{"name":"books/1"}', {
    'grpc-before-invoke': `console.log('invoking', oh.invoke.method, oh.invoke.shape, oh.invoke.metadata.length);`,
    'grpc-on-message': `console.log('decoded', oh.message.direction, oh.message.value.title);`,
    'grpc-after-response': `await oh.test('status is OK', () => oh.expect(oh.response.status).toBe(0));
await oh.test('one reply', () => oh.expect(oh.response.received).toBe(1));`,
  }),
  // S2: server stream — On message runs on the ↑ request frame and on
  // every ↓ book; the marks interleave the timeline at their positions.
  grpcRequest('e2esgr02', 'Scripted WatchBooks', 'WatchBooks', '{"shelf":"books","count":3,"intervalMs":50}', {
    'grpc-on-message': `oh.session.frames = (oh.session.frames ?? 0) + 1;
console.log(oh.message.direction, oh.session.frames, oh.message.value && oh.message.value.name);`,
    'grpc-after-response': `await oh.test('four frames', () => oh.expect(oh.session.frames).toBe(4));`,
  }),
  // S3: bidi — the rider's send has no hook, On message counts both
  // directions; Stop mid-stream settles After response with the stop
  // recorded.
  grpcRequest('e2esgr03', 'Scripted Chat', 'Chat', '{"author":"e2e","text":"hello"}', {
    'grpc-on-message': `oh.session.frames = (oh.session.frames ?? 0) + 1;`,
    'grpc-after-response': `await oh.test('stopped by the user', () => oh.expect(oh.response.stopped).toBeTruthy());
await oh.test('echo arrived', () => oh.expect(oh.response.received).toBe(1));`,
  }),
];

const values: Record<string, unknown> = {
  [`oh.ws.${workspaceId}.specs`]: [spec],
  [`oh.ws.${workspaceId}.requestCollections`]: [collection],
  [`oh.ws.${workspaceId}.grpcRequests`]: grpcRequests,
};

process.stdout.write(JSON.stringify(values));
