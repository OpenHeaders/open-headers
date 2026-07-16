/**
 * `.proto` census parser — the gRPC spec plane's structural read.
 *
 * Pins the Phase A contract: package / imports / message trees /
 * enums / services parse with declaration offsets, rpc entries carry
 * the four streaming shapes from their `stream` keywords, option and
 * reserved statements are consumed without interpretation, and proto2
 * documents are read-tolerated. Malformed input throws
 * `ProtoParseError` with the position in the message.
 */

import { ProtoParseError, parseProto } from '@openheaders/core/proto';
import { describe, expect, it } from 'vitest';

const BOOK_SERVICE = `syntax = "proto3";

package openheaders.library.v1;

import "google/protobuf/timestamp.proto";
import public "openheaders/common.proto";

option java_package = "io.openheaders.library.v1";

// The four call shapes over one catalog.
service BookService {
  rpc GetBook(GetBookRequest) returns (Book);
  rpc ListBooks(ListBooksRequest) returns (stream Book) {
    option deprecated = false;
  }
  rpc AddBooks(stream AddBookRequest) returns (AddBooksSummary);
  rpc Chat(stream ChatMessage) returns (stream ChatMessage);
}

message Book {
  reserved 9, 20 to 30;
  reserved "legacy_isbn";

  string id = 1;
  string title = 2 [json_name = "bookTitle"];
  repeated string authors = 3;
  Genre genre = 4;
  google.protobuf.Timestamp published_at = 5;
  map<string, string> labels = 6;

  oneof availability {
    bool in_stock = 7;
    google.protobuf.Timestamp restock_at = 8;
  }

  message Review {
    string reviewer = 1;
    Rating rating = 2;

    enum Rating {
      RATING_UNSPECIFIED = 0;
      LIKED = 1;
      DISLIKED = 2;
    }
  }

  repeated Review reviews = 10;
}

enum Genre {
  GENRE_UNSPECIFIED = 0;
  FICTION = 1;
  REFERENCE = 2;
}

message GetBookRequest {
  string id = 1;
}

message ListBooksRequest {
  optional Genre genre = 1;
  uint32 page_size = 2;
}

message AddBookRequest {
  Book book = 1;
}

message AddBooksSummary {
  uint32 added = 1;
}

message ChatMessage {
  string text = 1;
}
`;

describe('parseProto', () => {
  it('reads syntax, package, and imports with modifiers', () => {
    const census = parseProto(BOOK_SERVICE);
    expect(census.syntax).toBe('proto3');
    expect(census.packageName).toBe('openheaders.library.v1');
    expect(census.packageOffset).toBe(BOOK_SERVICE.indexOf('package '));
    expect(census.imports.map((i) => [i.path, i.modifier])).toEqual([
      ['google/protobuf/timestamp.proto', 'none'],
      ['openheaders/common.proto', 'public'],
    ]);
  });

  it('parses services into rpc entries with the four streaming shapes', () => {
    const census = parseProto(BOOK_SERVICE);
    expect(census.services).toHaveLength(1);
    const service = census.services[0];
    expect(service.name).toBe('BookService');
    expect(service.fullName).toBe('openheaders.library.v1.BookService');
    expect(service.rpcs.map((r) => [r.name, r.streaming])).toEqual([
      ['GetBook', 'unary'],
      ['ListBooks', 'server-streaming'],
      ['AddBooks', 'client-streaming'],
      ['Chat', 'bidi-streaming'],
    ]);
    const chat = service.rpcs[3];
    expect(chat.inputType).toBe('ChatMessage');
    expect(chat.outputType).toBe('ChatMessage');
    expect(chat.clientStreaming).toBe(true);
    expect(chat.serverStreaming).toBe(true);
    expect(service.rpcs[0].offset).toBe(BOOK_SERVICE.indexOf('rpc GetBook'));
  });

  it('parses message fields with labels, maps, oneofs, and qualified types', () => {
    const census = parseProto(BOOK_SERVICE);
    const book = census.messages.find((m) => m.name === 'Book');
    expect(book).toBeDefined();
    if (book === undefined) return;
    expect(book.fullName).toBe('openheaders.library.v1.Book');

    const byName = new Map(book.fields.map((f) => [f.name, f]));
    expect(byName.get('authors')?.label).toBe('repeated');
    expect(byName.get('genre')?.type).toBe('Genre');
    expect(byName.get('published_at')?.type).toBe('google.protobuf.Timestamp');
    expect(byName.get('labels')?.mapKeyType).toBe('string');
    expect(byName.get('labels')?.type).toBe('string');
    expect(byName.get('title')?.number).toBe(2);

    expect(book.oneofs.map((o) => o.name)).toEqual(['availability']);
    expect(byName.get('in_stock')?.oneofName).toBe('availability');
    expect(byName.get('restock_at')?.oneofName).toBe('availability');
    expect(byName.get('id')?.oneofName).toBeNull();
  });

  it('nests messages and enums with qualified full names', () => {
    const census = parseProto(BOOK_SERVICE);
    const book = census.messages.find((m) => m.name === 'Book');
    const review = book?.messages[0];
    expect(review?.fullName).toBe('openheaders.library.v1.Book.Review');
    expect(review?.enums[0].fullName).toBe('openheaders.library.v1.Book.Review.Rating');
    expect(review?.enums[0].values.map((v) => [v.name, v.number])).toEqual([
      ['RATING_UNSPECIFIED', 0],
      ['LIKED', 1],
      ['DISLIKED', 2],
    ]);
    expect(census.enums.map((e) => e.name)).toEqual(['Genre']);
  });

  it('carries declaration offsets that point at each node', () => {
    const census = parseProto(BOOK_SERVICE);
    expect(census.services[0].offset).toBe(BOOK_SERVICE.indexOf('service BookService'));
    const book = census.messages.find((m) => m.name === 'Book');
    expect(book?.offset).toBe(BOOK_SERVICE.indexOf('message Book'));
    const genre = census.enums[0];
    expect(genre.offset).toBe(BOOK_SERVICE.indexOf('enum Genre'));
    expect(genre.values[1].offset).toBe(BOOK_SERVICE.indexOf('FICTION'));
  });

  it('tolerates a proto2 document with required labels, groups, and extend', () => {
    const census = parseProto(`syntax = "proto2";
package openheaders.legacy;

message Envelope {
  required string id = 1;
  optional int32 weight = 2 [default = 10];
  repeated group Attachment = 3 {
    optional string name = 1;
  }
  extensions 100 to max;
}

extend Envelope {
  optional string extra = 101;
}
`);
    expect(census.syntax).toBe('proto2');
    const envelope = census.messages[0];
    expect(envelope.fields.map((f) => [f.name, f.label, f.type])).toEqual([
      ['id', 'required', 'string'],
      ['weight', 'optional', 'int32'],
      ['Attachment', 'repeated', 'group'],
    ]);
  });

  it('consumes aggregate options and negative enum values', () => {
    const census = parseProto(`syntax = "proto3";
option (custom.thing) = { nested: { flag: true } list: [1, 2] };

enum Signed {
  option allow_alias = true;
  ZERO = 0;
  MINUS = -1;
}
`);
    expect(census.enums[0].values.map((v) => v.number)).toEqual([0, -1]);
  });

  it('parses an empty-but-valid document', () => {
    const census = parseProto('syntax = "proto3";\n');
    expect(census.packageName).toBeNull();
    expect(census.messages).toEqual([]);
    expect(census.services).toEqual([]);
  });

  it('throws ProtoParseError with a position on malformed input', () => {
    expect(() => parseProto('message {')).toThrowError(ProtoParseError);
    expect(() => parseProto('service S { rpc Foo(Bar) return (Baz); }')).toThrowError(/returns/);
    expect(() => parseProto('message M { string name = ; }')).toThrowError(/line 1/);
    expect(() => parseProto('message M { string name = 1 }')).toThrowError(ProtoParseError);
    expect(() => parseProto('grpc Foo {}')).toThrowError(/Unknown declaration/);
  });

  it('throws on unterminated strings and comments', () => {
    expect(() => parseProto('import "unclosed;')).toThrowError(/Unterminated string/);
    expect(() => parseProto('/* never closed')).toThrowError(/Unterminated block comment/);
  });
});
