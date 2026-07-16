/**
 * gRPC response-message views — the Response tab's display-side decode
 * ladder over an executed invoke's captured frames: schema-driven
 * canonical JSON when the linked spec resolves the rpc's response
 * type, the structural field-number view when it doesn't (or the
 * bytes don't match), raw base64 when neither decodes, and the honest
 * degradations (compressed frame, empty reply). Plus the
 * output-type resolution helper the ladder keys off.
 */

import { buildRegistry, encodeMessage, parseProto } from '@openheaders/core/proto';
import type { ExecutedGrpcSnapshot } from '@openheaders/core/types';
import { encodeBase64Bytes } from '@openheaders/core/utils';
import {
  deriveGrpcMessageView,
  grpcOutputTypeOf,
  printStructural,
} from '@openheaders/ui/workbench/components/grpc-request-editor/response-decode';
import { describe, expect, it } from 'vitest';

const PROTO = `syntax = "proto3";
package library.v1;
service Library {
  rpc GetBook(GetBookRequest) returns (Book);
}
message GetBookRequest { string name = 1; }
message Book { string title = 1; int64 pages = 2; }
`;

const REGISTRY = buildRegistry([{ path: 'index.proto', census: parseProto(PROTO) }]);
const METHOD = { service: 'library.v1.Library', rpc: 'GetBook' };

function snapshotWith(frames: ExecutedGrpcSnapshot['messages']): ExecutedGrpcSnapshot {
  return {
    httpStatus: 200,
    headers: [],
    trailers: [{ key: 'grpc-status', value: '0' }],
    grpcStatus: 0,
    grpcStatusSource: 'trailers',
    messages: frames,
    bodyTruncated: false,
    bodyBytes: 0,
    durationMs: 12,
    error: null,
  };
}

describe('grpcOutputTypeOf', () => {
  it('resolves the selected rpc response type and null for drift', () => {
    expect(grpcOutputTypeOf(REGISTRY, METHOD)).toBe('library.v1.Book');
    expect(grpcOutputTypeOf(REGISTRY, { service: 'library.v1.Library', rpc: 'Vanished' })).toBeNull();
    expect(grpcOutputTypeOf(null, METHOD)).toBeNull();
    expect(grpcOutputTypeOf(REGISTRY, undefined)).toBeNull();
  });
});

describe('deriveGrpcMessageView', () => {
  const bookBytes = encodeMessage(REGISTRY, 'library.v1.Book', { title: 'Wire Ceremony', pages: '412' });

  it('decodes schema-driven canonical JSON when the type resolves', () => {
    const view = deriveGrpcMessageView(
      snapshotWith([{ dataBase64: encodeBase64Bytes(bookBytes), compressed: false }]),
      REGISTRY,
      'library.v1.Book',
    );
    if (view.kind !== 'schema') throw new Error(`expected schema view, got ${view.kind}`);
    expect(JSON.parse(view.text)).toEqual({ title: 'Wire Ceremony', pages: '412' });
  });

  it('falls back to the structural view without a resolved type', () => {
    const view = deriveGrpcMessageView(
      snapshotWith([{ dataBase64: encodeBase64Bytes(bookBytes), compressed: false }]),
      REGISTRY,
      null,
    );
    if (view.kind !== 'structural') throw new Error(`expected structural view, got ${view.kind}`);
    expect(view.text).toContain('Wire Ceremony');
  });

  it('degrades to raw base64 when the bytes decode as neither', () => {
    // 0xFF is no valid protobuf tag — the structural decode rejects it.
    const junk = new Uint8Array([0xff, 0xff, 0xff]);
    const view = deriveGrpcMessageView(
      snapshotWith([{ dataBase64: encodeBase64Bytes(junk), compressed: false }]),
      REGISTRY,
      'library.v1.Book',
    );
    expect(view).toEqual({ kind: 'raw', base64: encodeBase64Bytes(junk) });
  });

  it('reports compressed frames and empty replies as their own states', () => {
    expect(
      deriveGrpcMessageView(
        snapshotWith([{ dataBase64: encodeBase64Bytes(bookBytes), compressed: true }]),
        REGISTRY,
        'library.v1.Book',
      ),
    ).toEqual({ kind: 'compressed' });
    expect(deriveGrpcMessageView(snapshotWith([]), REGISTRY, 'library.v1.Book')).toEqual({ kind: 'none' });
  });
});

describe('printStructural', () => {
  it('prints nested objects and arrays as indented JSON-like text', () => {
    const text = printStructural({ a: [1, 'two', null], b: { c: true } });
    expect(text).toBe('{\n  "a": [\n    1,\n    "two",\n    null\n  ],\n  "b": {\n    "c": true\n  }\n}');
  });

  it('prints empty containers inline', () => {
    expect(printStructural({})).toBe('{}');
    expect(printStructural([])).toBe('[]');
  });
});
