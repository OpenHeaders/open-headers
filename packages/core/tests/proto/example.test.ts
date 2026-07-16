/**
 * Example-message synthesis — "Use Example Message" ground truth.
 *
 * Pins the Phase B synthesis contract: deterministic zero-ish
 * scalars (64-bit as strings), one sample entry per repeated field
 * and map, the first arm per oneof, first declared enum value,
 * well-known canonical JSON samples, cycle cuts to `{}`, and
 * unresolved fields omitted. Every example must ENCODE cleanly —
 * synthesis output is composer input.
 */

import {
  buildRegistry,
  encodeMessage,
  ProtoCodecError,
  type ProtoRegistry,
  parseProto,
  synthesizeExampleMessage,
} from '@openheaders/core/proto';
import { describe, expect, it } from 'vitest';

const registryOf = (source: string): ProtoRegistry =>
  buildRegistry([{ path: 'openheaders/example.proto', census: parseProto(source) }]);

const BOOK = `syntax = "proto3";
package openheaders.library.v1;

import "google/protobuf/timestamp.proto";

message Book {
  string id = 1;
  repeated string authors = 2;
  Genre genre = 3;
  google.protobuf.Timestamp published_at = 4;
  map<string, string> labels = 5;
  map<int64, Review> reviews_by_id = 6;
  uint64 print_run = 7;

  oneof availability {
    bool in_stock = 8;
    google.protobuf.Timestamp restock_at = 9;
  }

  message Review {
    string reviewer = 1;
    int32 stars = 2;
  }
}

enum Genre {
  GENRE_UNSPECIFIED = 0;
  FICTION = 1;
}
`;

describe('synthesizeExampleMessage', () => {
  it('synthesizes the full canonical-JSON shape for a message', () => {
    const registry = registryOf(BOOK);
    expect(synthesizeExampleMessage(registry, 'openheaders.library.v1.Book')).toEqual({
      id: '',
      authors: [''],
      genre: 'GENRE_UNSPECIFIED',
      publishedAt: '2026-01-01T00:00:00Z',
      labels: { key: '' },
      reviewsById: { '0': { reviewer: '', stars: 0 } },
      printRun: '0',
      inStock: false,
    });
  });

  it('produces examples the codec can encode', () => {
    const registry = registryOf(BOOK);
    const example = synthesizeExampleMessage(registry, 'openheaders.library.v1.Book');
    expect(() => encodeMessage(registry, 'openheaders.library.v1.Book', example)).not.toThrow();
  });

  it('cuts recursive message cycles to an empty object', () => {
    const registry = registryOf(`syntax = "proto3";
package openheaders.graph;
message Node { string name = 1; Node next = 2; }
`);
    expect(synthesizeExampleMessage(registry, 'openheaders.graph.Node')).toEqual({
      name: '',
      next: {},
    });
  });

  it('samples well-known types in their canonical JSON forms', () => {
    const registry = registryOf(`syntax = "proto3";
package openheaders.wk;
import "google/protobuf/duration.proto";
import "google/protobuf/struct.proto";
import "google/protobuf/wrappers.proto";
message Sampler {
  google.protobuf.Duration ttl = 1;
  google.protobuf.Struct meta = 2;
  google.protobuf.Value free = 3;
  google.protobuf.Int64Value big = 4;
}
`);
    expect(synthesizeExampleMessage(registry, 'openheaders.wk.Sampler')).toEqual({
      ttl: '1s',
      meta: {},
      free: null,
      big: '0',
    });
  });

  it('omits unresolved fields and throws on unknown types', () => {
    const registry = registryOf(`syntax = "proto3";
package openheaders.gap;
message Holder { string id = 1; Missing thing = 2; }
`);
    expect(synthesizeExampleMessage(registry, 'openheaders.gap.Holder')).toEqual({ id: '' });
    expect(() => synthesizeExampleMessage(registry, 'openheaders.gap.Nope')).toThrowError(ProtoCodecError);
  });
});
