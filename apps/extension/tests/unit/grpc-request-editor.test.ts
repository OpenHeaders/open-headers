/**
 * Unit tests for the gRPC editor's pure derivation modules:
 *
 *   - `method-selector.ts` — registry-fed grouped options with the S1
 *     call-shape glyph metadata, unresolved-reference surfacing (never
 *     a crash), and the "Use Example Message" synthesis plumbing.
 *   - `draft.ts` — draft ⇄ entity projections whose fingerprints drive
 *     derived dirty (form-vs-canonical equality).
 *   - `local-tree-builder.ts` — both request kinds sharing the
 *     collection tree.
 */

import type { Collection, GrpcRequest, Spec } from '@openheaders/core/types';
import { buildRequestCollectionTrees } from '@openheaders/ui/shared/local-tree-builder';
import {
  buildGrpcRequestUpdates,
  canonicalGrpcRequestProjection,
  draftFromGrpcRequest,
  metadataToRows,
  rowsToMetadata,
} from '@openheaders/ui/workbench/components/grpc-request-editor/draft';
import {
  deriveGrpcMethods,
  findMethodOption,
  GRPC_STREAMING_GLYPHS,
  synthesizeExampleText,
} from '@openheaders/ui/workbench/components/grpc-request-editor/method-selector';
import { describe, expect, it } from 'vitest';

const LIBRARY_PROTO = [
  'syntax = "proto3";',
  'package library.v1;',
  '',
  'message Book { string title = 1; int32 page_count = 2; }',
  'message ListBooksRequest { string shelf = 1; }',
  'message BookStream { repeated Book books = 1; }',
  '',
  'service Library {',
  '  rpc CreateBook(Book) returns (Book);',
  '  rpc ListBooks(ListBooksRequest) returns (stream Book);',
  '  rpc UploadBooks(stream Book) returns (BookStream);',
  '  rpc Chat(stream Book) returns (stream Book);',
  '}',
  '',
  'service Audit {',
  '  rpc Log(Book) returns (Book);',
  '}',
  '',
].join('\n');

const spec = (content: string, overrides: Partial<Spec> = {}): Spec => ({
  schemaVersion: 5,
  uid: 'spec0001',
  path: 'specs/library-spec0001',
  name: 'Library API',
  format: 'protobuf',
  rootFileUid: 'file0001',
  files: [{ uid: 'file0001', fileName: 'index.proto', content }],
  ...overrides,
});

describe('deriveGrpcMethods', () => {
  it('groups rpcs by service with streaming metadata', () => {
    const derivation = deriveGrpcMethods(spec(LIBRARY_PROTO));
    expect(derivation.groups.map((g) => g.service)).toEqual(['library.v1.Library', 'library.v1.Audit']);
    const library = derivation.groups[0];
    expect(library.options.map((o) => [o.rpc, o.streaming])).toEqual([
      ['CreateBook', 'unary'],
      ['ListBooks', 'server-streaming'],
      ['UploadBooks', 'client-streaming'],
      ['Chat', 'bidi-streaming'],
    ]);
    expect(derivation.issues).toEqual([]);
    expect(derivation.parseFailures).toEqual([]);
  });

  it('carries one glyph per call shape', () => {
    expect(GRPC_STREAMING_GLYPHS).toEqual({
      unary: '→',
      'server-streaming': '⇊',
      'client-streaming': '⇈',
      'bidi-streaming': '⇅',
    });
  });

  it('surfaces unresolved references as issues, never a crash', () => {
    const broken = [
      'syntax = "proto3";',
      'package library.v1;',
      'service Library { rpc Get(MissingRequest) returns (MissingReply); }',
      '',
    ].join('\n');
    const derivation = deriveGrpcMethods(spec(broken));
    expect(derivation.groups).toHaveLength(1);
    expect(derivation.issues.length).toBeGreaterThan(0);
    expect(derivation.groups[0].options[0].inputType).toBeNull();
  });

  it('reports unparseable files on parseFailures and derives the rest', () => {
    const derivation = deriveGrpcMethods(
      spec(LIBRARY_PROTO, {
        files: [
          { uid: 'file0001', fileName: 'index.proto', content: LIBRARY_PROTO },
          { uid: 'file0002', fileName: 'broken.proto', content: 'syntax = "proto3"; message {' },
        ],
      }),
    );
    expect(derivation.parseFailures.map((f) => f.path)).toEqual(['broken.proto']);
    expect(derivation.groups).toHaveLength(2);
  });
});

describe('findMethodOption + synthesizeExampleText', () => {
  it('resolves a persisted method ref to its derived option', () => {
    const derivation = deriveGrpcMethods(spec(LIBRARY_PROTO));
    const option = findMethodOption(derivation, { service: 'library.v1.Library', rpc: 'ListBooks' });
    expect(option?.streaming).toBe('server-streaming');
    expect(option?.inputType).toBe('library.v1.ListBooksRequest');
  });

  it('returns null for a method the spec no longer declares', () => {
    const derivation = deriveGrpcMethods(spec(LIBRARY_PROTO));
    expect(findMethodOption(derivation, { service: 'library.v1.Library', rpc: 'Vanished' })).toBeNull();
  });

  it('synthesizes the selected rpc input type into pretty JSON', () => {
    const derivation = deriveGrpcMethods(spec(LIBRARY_PROTO));
    const text = synthesizeExampleText(derivation, { service: 'library.v1.Library', rpc: 'CreateBook' });
    expect(text).not.toBeNull();
    const parsed = JSON.parse(text ?? '') as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(['pageCount', 'title']);
  });

  it('returns null example when the input type is unresolved', () => {
    const broken = [
      'syntax = "proto3";',
      'package library.v1;',
      'service Library { rpc Get(MissingRequest) returns (MissingReply); }',
      '',
    ].join('\n');
    const derivation = deriveGrpcMethods(spec(broken));
    expect(synthesizeExampleText(derivation, { service: 'library.v1.Library', rpc: 'Get' })).toBeNull();
  });
});

describe('grpc draft projections', () => {
  const entity: GrpcRequest = {
    schemaVersion: 5,
    uid: 'grpc0001',
    path: 'requests/library-grpc0001',
    name: 'Create Book',
    url: 'grpc.openheaders.io:443',
    tls: false,
    method: { service: 'library.v1.Library', rpc: 'CreateBook' },
    message: '{"title": "The Library"}',
    metadata: [{ uid: 'meta0001', key: 'x-api-key', value: '{{vault.api_key}}', enabled: true }],
    specLink: { specUid: 'spec0001' },
    timeoutMs: 30_000,
  };

  it('round-trips entity → draft → updates to the canonical projection', () => {
    const updates = buildGrpcRequestUpdates(draftFromGrpcRequest(entity));
    expect(updates).toEqual(canonicalGrpcRequestProjection(entity));
    expect(updates.url).toBe(entity.url);
    expect(updates.tls).toBe(false);
    expect(updates.metadata).toEqual(entity.metadata);
  });

  it('drops empty-key metadata rows and blank descriptions on save', () => {
    const rows = metadataToRows([{ uid: 'meta0001', key: 'x-api-key', value: 'v' }]);
    rows.push({ uid: 'meta0002', key: '', value: 'ignored', description: '', enabled: true });
    const pairs = rowsToMetadata(rows);
    expect(pairs).toEqual([{ uid: 'meta0001', key: 'x-api-key', value: 'v', description: undefined, enabled: true }]);
  });

  it('normalizes absent auth and sslVerification to concrete form values — clearing round-trips', () => {
    const draft = draftFromGrpcRequest(entity);
    expect(draft.auth).toEqual({ type: 'none' });
    expect(draft.sslVerification).toBe(true);
    // The save patch always carries both, so a cleared bearer lands as
    // {type:'none'} rather than an undefined the update batch skips.
    const updates = buildGrpcRequestUpdates(draft);
    expect(updates.auth).toEqual({ type: 'none' });
    expect(updates.sslVerification).toBe(true);
  });

  it('round-trips a bearer credential and a verify-off knob through the projections', () => {
    const secured: GrpcRequest = {
      ...entity,
      auth: { type: 'bearer', token: '{{vault.api_token}}' },
      sslVerification: false,
    };
    const updates = buildGrpcRequestUpdates(draftFromGrpcRequest(secured));
    expect(updates).toEqual(canonicalGrpcRequestProjection(secured));
    expect(updates.auth).toEqual({ type: 'bearer', token: '{{vault.api_token}}' });
    expect(updates.sslVerification).toBe(false);
  });
});

describe('buildRequestCollectionTrees with grpc requests', () => {
  it('emits both request kinds as leaves of the shared tree', () => {
    const collection: Collection = {
      schemaVersion: 5,
      uid: 'col00001',
      path: 'requests/api',
      name: 'API',
      variables: [],
      pinnedEnvironmentIds: [],
      defaultEnvironmentId: null,
    };
    const grpc: GrpcRequest = {
      schemaVersion: 5,
      uid: 'grpc0001',
      path: 'requests/api/create-book-grpc0001',
      name: 'Create Book',
      url: '',
      message: '',
      metadata: [],
    };
    const trees = buildRequestCollectionTrees([collection], [], [], [grpc]);
    expect(trees[0].tree).toEqual([
      { type: 'grpc-request', uid: 'grpc0001', name: 'Create Book', path: 'requests/api/create-book-grpc0001' },
    ]);
  });
});
