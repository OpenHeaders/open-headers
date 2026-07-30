/**
 * Unit tests for the gRPC editor's pure derivation modules:
 *
 *   - `method-selector.ts` — registry-fed grouped options with the S1
 *     call-shape glyph metadata, unresolved-reference surfacing (never
 *     a crash), the "Use Example Message" synthesis plumbing, and the
 *     selector's value routing (method / link-spec / import-proto).
 *   - `spec-scaffold.ts` — the imported-.proto spec seed the selector's
 *     import action mints.
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
import { humanizeGrpcStatus } from '@openheaders/ui/workbench/components/grpc-request-editor/GrpcResponseErrorState';
import {
  deriveGrpcMethods,
  findMethodOption,
  GRPC_IMPORT_PROTO_VALUE,
  GRPC_SPEC_LINK_VALUE_PREFIX,
  GRPC_STREAMING_ARROWS,
  parseGrpcSelectValue,
  synthesizeExampleText,
} from '@openheaders/ui/workbench/components/grpc-request-editor/method-selector';
import { createImportedProtoSpecSeed } from '@openheaders/ui/workbench/components/specs/spec-scaffold';
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

  it('carries one arrow pair per call shape, double-struck on the streaming side', () => {
    expect(GRPC_STREAMING_ARROWS).toEqual({
      unary: '↑↓',
      'server-streaming': '↑⇓',
      'client-streaming': '⇑↓',
      'bidi-streaming': '⇑⇓',
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

describe('parseGrpcSelectValue', () => {
  it('routes a method key to its service/rpc ref', () => {
    expect(parseGrpcSelectValue('library.v1.Library/ListBooks')).toEqual({
      kind: 'method',
      method: { service: 'library.v1.Library', rpc: 'ListBooks' },
    });
  });

  it('routes a spec-link value to its uid', () => {
    expect(parseGrpcSelectValue(`${GRPC_SPEC_LINK_VALUE_PREFIX}spec0001`)).toEqual({
      kind: 'link-spec',
      specUid: 'spec0001',
    });
  });

  it('routes the import action', () => {
    expect(parseGrpcSelectValue(GRPC_IMPORT_PROTO_VALUE)).toEqual({ kind: 'import-proto' });
  });

  it('returns null on malformed values', () => {
    expect(parseGrpcSelectValue('no-slash')).toBeNull();
    expect(parseGrpcSelectValue('/leading')).toBeNull();
    expect(parseGrpcSelectValue('trailing/')).toBeNull();
    expect(parseGrpcSelectValue(GRPC_SPEC_LINK_VALUE_PREFIX)).toBeNull();
  });
});

describe('createImportedProtoSpecSeed', () => {
  it('lands the source verbatim as the root file under its original name', () => {
    const seed = createImportedProtoSpecSeed('book_service', 'book_service.proto', LIBRARY_PROTO);
    expect(seed.format).toBe('protobuf');
    expect(seed.name).toBe('book_service');
    expect(seed.files).toHaveLength(1);
    expect(seed.files[0].fileName).toBe('book_service.proto');
    expect(seed.files[0].content).toBe(LIBRARY_PROTO);
    expect(seed.rootFileUid).toBe(seed.files[0].uid);
  });

  it('mints a derivable spec — methods group straight from the imported file', () => {
    const seed = createImportedProtoSpecSeed('library', 'library.proto', LIBRARY_PROTO);
    const derivation = deriveGrpcMethods(spec(LIBRARY_PROTO, { files: seed.files, rootFileUid: seed.rootFileUid }));
    expect(derivation.groups.map((g) => g.service)).toEqual(['library.v1.Library', 'library.v1.Audit']);
    expect(derivation.parseFailures).toEqual([]);
  });
});

describe('humanizeGrpcStatus', () => {
  it('prettifies status names and falls back to bare codes', () => {
    expect(humanizeGrpcStatus(3)).toBe('Invalid argument');
    expect(humanizeGrpcStatus(4)).toBe('Deadline exceeded');
    expect(humanizeGrpcStatus(14)).toBe('Unavailable');
    expect(humanizeGrpcStatus(42)).toBe('42');
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

  it('normalizes absent description to an empty string — clearing docs round-trips', () => {
    const draft = draftFromGrpcRequest(entity);
    expect(draft.description).toBe('');
    expect(buildGrpcRequestUpdates(draft).description).toBe('');
    const documented: GrpcRequest = { ...entity, description: '# Create Book\nCreates one book.' };
    const updates = buildGrpcRequestUpdates(draftFromGrpcRequest(documented));
    expect(updates).toEqual(canonicalGrpcRequestProjection(documented));
    expect(updates.description).toBe('# Create Book\nCreates one book.');
  });

  it('round-trips the Unix-socket knob; absent stays undefined so the save patch skips it', () => {
    expect(draftFromGrpcRequest(entity).unixSocketPath).toBeUndefined();
    expect(buildGrpcRequestUpdates(draftFromGrpcRequest(entity)).unixSocketPath).toBeUndefined();
    const socketed: GrpcRequest = { ...entity, unixSocketPath: '/var/run/openheaders/grpc.sock' };
    const updates = buildGrpcRequestUpdates(draftFromGrpcRequest(socketed));
    expect(updates).toEqual(canonicalGrpcRequestProjection(socketed));
    expect(updates.unixSocketPath).toBe('/var/run/openheaders/grpc.sock');
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
