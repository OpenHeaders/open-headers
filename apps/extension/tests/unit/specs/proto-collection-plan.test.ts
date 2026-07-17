/**
 * Proto collection generation plan (GRPC_CLIENT_PLAN.md Phase G). Pins:
 *   - one GrpcRequest per rpc named after it, method ref + ids-only
 *     specLink on the seed, example message pre-filled;
 *   - services group in declaration order; the method count aggregates
 *     across services;
 *   - an rpc whose input type does not resolve still plans (message
 *     omitted — the editor's Use Example Message stays one click away);
 *   - unparseable files surface on parseFailures while parsed files
 *     still plan.
 */

import type { Spec } from '@openheaders/core/types';
import { buildProtoCollectionPlan } from '@openheaders/ui/workbench/components/specs/proto-collection-plan';
import { describe, expect, it } from 'vitest';

const BOOKS_PROTO = [
  'syntax = "proto3";',
  'package library.v1;',
  '',
  'message GetBookRequest { string name = 1; }',
  'message Book { string name = 1; string title = 2; }',
  'message WatchBooksRequest { int32 count = 1; }',
  '',
  'service Library {',
  '  rpc GetBook(GetBookRequest) returns (Book);',
  '  rpc WatchBooks(WatchBooksRequest) returns (stream Book);',
  '}',
  '',
  'service Shelf {',
  '  rpc GetBook(GetBookRequest) returns (Book);',
  '}',
  '',
].join('\n');

function makeSpec(overrides: Partial<Spec> = {}): Spec {
  return {
    schemaVersion: 5,
    uid: 'spc00001',
    path: 'specs/books-spc00001',
    name: 'Books API',
    format: 'protobuf',
    rootFileUid: 'fil00001',
    files: [{ uid: 'fil00001', fileName: 'index.proto', content: BOOKS_PROTO }],
    ...overrides,
  };
}

describe('buildProtoCollectionPlan', () => {
  it('plans one request per rpc with method, specLink, and example message on the seed', () => {
    const plan = buildProtoCollectionPlan(makeSpec());
    expect(plan.methodCount).toBe(3);
    expect(plan.services.map((s) => s.service)).toEqual(['library.v1.Library', 'library.v1.Shelf']);
    const [library] = plan.services;
    expect(library?.requests.map((r) => r.name)).toEqual(['GetBook', 'WatchBooks']);
    const getBook = library?.requests[0];
    expect(getBook?.seed.method).toEqual({ service: 'library.v1.Library', rpc: 'GetBook' });
    expect(getBook?.seed.specLink).toEqual({ specUid: 'spc00001' });
    expect(JSON.parse(getBook?.seed.message ?? '')).toEqual({ name: '' });
  });

  it('omits the message when the rpc input type does not resolve', () => {
    const content = [
      'syntax = "proto3";',
      'package library.v1;',
      'message Book { string name = 1; }',
      'service Library {',
      '  rpc GetBook(missing.Request) returns (Book);',
      '}',
    ].join('\n');
    const plan = buildProtoCollectionPlan(makeSpec({ files: [{ uid: 'fil00001', fileName: 'index.proto', content }] }));
    expect(plan.methodCount).toBe(1);
    expect(plan.services[0]?.requests[0]?.seed.message).toBeUndefined();
    expect(plan.issues.length).toBeGreaterThan(0);
  });

  it('surfaces unparseable files while parsed files still plan', () => {
    const plan = buildProtoCollectionPlan(
      makeSpec({
        files: [
          { uid: 'fil00001', fileName: 'index.proto', content: BOOKS_PROTO },
          { uid: 'fil00002', fileName: 'broken.proto', content: 'service {' },
        ],
      }),
    );
    expect(plan.methodCount).toBe(3);
    expect(plan.parseFailures.map((f) => f.path)).toEqual(['broken.proto']);
  });

  it('plans empty for a document with no services', () => {
    const plan = buildProtoCollectionPlan(
      makeSpec({
        files: [{ uid: 'fil00001', fileName: 'index.proto', content: 'syntax = "proto3";\nmessage Empty {}\n' }],
      }),
    );
    expect(plan.methodCount).toBe(0);
    expect(plan.services).toEqual([]);
  });
});
