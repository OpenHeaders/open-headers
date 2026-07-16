/**
 * Proto schema registry — resolution over a spec's parsed file set.
 *
 * Pins the Phase B registry contract: message/enum indexing by full
 * name, reference resolution through the proto scoping rules
 * (innermost nesting outward, leading-dot absolute, cross-file),
 * built-in well-known types satisfying `google/protobuf/*` imports,
 * service rpc type resolution, and the issue ledger — unresolved
 * types, missing imports, duplicate names, and invalid map keys are
 * REPORTED, never thrown.
 */

import { buildRegistry, jsonNameOf, type ProtoSourceFile, parseProto } from '@openheaders/core/proto';
import { describe, expect, it } from 'vitest';

const fileOf = (path: string, source: string): ProtoSourceFile => ({ path, census: parseProto(source) });

const LIBRARY = `syntax = "proto3";
package openheaders.library.v1;

import "google/protobuf/timestamp.proto";
import "openheaders/common.proto";

service BookService {
  rpc GetBook(GetBookRequest) returns (Book);
  rpc Chat(stream ChatMessage) returns (stream ChatMessage);
}

message GetBookRequest {
  string id = 1;
}

message ChatMessage {
  string text = 1;
}

message Book {
  string id = 1;
  Genre genre = 2;
  google.protobuf.Timestamp published_at = 3;
  openheaders.common.Audit audit = 4;
  .openheaders.library.v1.Book.Review top_review = 5;
  map<string, string> labels = 6;
  repeated string authors = 7;
  optional uint32 page_count = 8;

  message Review {
    string reviewer = 1;
    Genre rating_genre = 2;

    enum Genre {
      GENRE_UNSPECIFIED = 0;
      LIKED = 1;
    }
  }
}

enum Genre {
  GENRE_UNSPECIFIED = 0;
  FICTION = 1;
}
`;

const COMMON = `syntax = "proto3";
package openheaders.common;

message Audit {
  string actor = 1;
}
`;

describe('buildRegistry', () => {
  it('indexes messages, enums, and services from the file set', () => {
    const registry = buildRegistry([
      fileOf('openheaders/library.proto', LIBRARY),
      fileOf('openheaders/common.proto', COMMON),
    ]);
    expect(registry.messages.has('openheaders.library.v1.Book')).toBe(true);
    expect(registry.messages.has('openheaders.library.v1.Book.Review')).toBe(true);
    expect(registry.messages.has('openheaders.common.Audit')).toBe(true);
    expect(registry.enums.has('openheaders.library.v1.Genre')).toBe(true);
    expect(registry.services.map((s) => s.fullName)).toEqual(['openheaders.library.v1.BookService']);
    expect(registry.issues).toEqual([]);
  });

  it('resolves field references across scopes, files, and the leading dot', () => {
    const registry = buildRegistry([
      fileOf('openheaders/library.proto', LIBRARY),
      fileOf('openheaders/common.proto', COMMON),
    ]);
    const book = registry.messages.get('openheaders.library.v1.Book');
    expect(book).toBeDefined();
    if (book === undefined) return;
    const byName = new Map(book.fields.map((f) => [f.name, f]));
    expect(byName.get('genre')?.type).toEqual({ kind: 'enum', enum: 'openheaders.library.v1.Genre' });
    expect(byName.get('published_at')?.type).toEqual({ kind: 'message', message: 'google.protobuf.Timestamp' });
    expect(byName.get('audit')?.type).toEqual({ kind: 'message', message: 'openheaders.common.Audit' });
    expect(byName.get('top_review')?.type).toEqual({ kind: 'message', message: 'openheaders.library.v1.Book.Review' });
    expect(byName.get('labels')?.mapKey).toBe('string');
    expect(byName.get('labels')?.type).toEqual({ kind: 'scalar', scalar: 'string' });
    expect(byName.get('authors')?.repeated).toBe(true);
    expect(byName.get('page_count')?.optional).toBe(true);
  });

  it('prefers the innermost scope when names shadow', () => {
    const registry = buildRegistry([fileOf('openheaders/library.proto', LIBRARY)]);
    const review = registry.messages.get('openheaders.library.v1.Book.Review');
    const rating = review?.fields.find((f) => f.name === 'rating_genre');
    expect(rating?.type).toEqual({ kind: 'enum', enum: 'openheaders.library.v1.Book.Review.Genre' });
  });

  it('derives proto JSON names from field names', () => {
    const registry = buildRegistry([fileOf('openheaders/library.proto', LIBRARY)]);
    const book = registry.messages.get('openheaders.library.v1.Book');
    const published = book?.fields.find((f) => f.name === 'published_at');
    expect(published?.jsonName).toBe('publishedAt');
    expect(jsonNameOf('rating_genre_v2')).toBe('ratingGenreV2');
  });

  it('resolves service rpc request and response types', () => {
    const registry = buildRegistry([
      fileOf('openheaders/library.proto', LIBRARY),
      fileOf('openheaders/common.proto', COMMON),
    ]);
    const service = registry.services[0];
    expect(service.rpcs.map((r) => [r.name, r.streaming, r.inputType, r.outputType])).toEqual([
      ['GetBook', 'unary', 'openheaders.library.v1.GetBookRequest', 'openheaders.library.v1.Book'],
      ['Chat', 'bidi-streaming', 'openheaders.library.v1.ChatMessage', 'openheaders.library.v1.ChatMessage'],
    ]);
  });

  it('builds in the well-known types without files', () => {
    const registry = buildRegistry([]);
    expect(registry.messages.has('google.protobuf.Timestamp')).toBe(true);
    expect(registry.messages.has('google.protobuf.Struct')).toBe(true);
    expect(registry.messages.has('google.protobuf.Any')).toBe(true);
    expect(registry.enums.has('google.protobuf.NullValue')).toBe(true);
  });

  it('reports an unresolved type and keeps the field as unresolved', () => {
    const registry = buildRegistry([
      fileOf(
        'openheaders/gap.proto',
        `syntax = "proto3";
package openheaders.gap;
message Holder { Missing thing = 1; }
`,
      ),
    ]);
    expect(registry.issues).toContainEqual({
      kind: 'unresolved-type',
      reference: 'Missing',
      scope: 'openheaders.gap.Holder',
    });
    const holder = registry.messages.get('openheaders.gap.Holder');
    expect(holder?.fields[0].type).toEqual({ kind: 'unresolved', reference: 'Missing' });
  });

  it('reports missing imports but accepts google/protobuf ones', () => {
    const registry = buildRegistry([
      fileOf(
        'openheaders/api.proto',
        `syntax = "proto3";
package openheaders.api;
import "google/protobuf/duration.proto";
import "openheaders/absent.proto";
`,
      ),
    ]);
    expect(registry.issues).toEqual([
      { kind: 'missing-import', reference: 'openheaders/absent.proto', scope: 'openheaders/api.proto' },
    ]);
  });

  it('reports duplicate full names and keeps the first definition', () => {
    const first = `syntax = "proto3";
package openheaders.dup;
message Thing { string a = 1; }
`;
    const second = `syntax = "proto3";
package openheaders.dup;
message Thing { string b = 1; }
`;
    const registry = buildRegistry([fileOf('a.proto', first), fileOf('b.proto', second)]);
    expect(registry.issues).toContainEqual({ kind: 'duplicate-name', reference: 'openheaders.dup.Thing', scope: '' });
    expect(registry.messages.get('openheaders.dup.Thing')?.fields[0].name).toBe('a');
  });

  it('reports an invalid map key and marks the field unresolved', () => {
    const registry = buildRegistry([
      fileOf(
        'openheaders/badmap.proto',
        `syntax = "proto3";
package openheaders.badmap;
message Holder { map<float, string> weights = 1; }
`,
      ),
    ]);
    expect(registry.issues).toContainEqual({
      kind: 'invalid-map-key',
      reference: 'map<float, string>',
      scope: 'openheaders.badmap.Holder',
    });
    const holder = registry.messages.get('openheaders.badmap.Holder');
    expect(holder?.fields[0].type.kind).toBe('unresolved');
    expect(holder?.fields[0].mapKey).toBeNull();
  });

  it('reports unresolved rpc types as null on the service', () => {
    const registry = buildRegistry([
      fileOf(
        'openheaders/svc.proto',
        `syntax = "proto3";
package openheaders.svc;
message Ping { string msg = 1; }
service Echo { rpc Send(Ping) returns (Pong); }
`,
      ),
    ]);
    const rpc = registry.services[0].rpcs[0];
    expect(rpc.inputType).toBe('openheaders.svc.Ping');
    expect(rpc.outputType).toBeNull();
    expect(registry.issues).toContainEqual({
      kind: 'unresolved-type',
      reference: 'Pong',
      scope: 'openheaders.svc.Echo',
    });
  });
});
